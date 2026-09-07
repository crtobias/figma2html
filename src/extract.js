/** Un frame de Figma → un fragmento HTML medible. Port de `extract.py`.
 *
 * El modelo de salida es **posicionamiento absoluto**, no auto-layout reconstruido: cada nodo se
 * dibuja en las coordenadas exactas que Figma reporta (`absoluteBoundingBox`) relativas a su
 * padre. Es un documento de referencia para mirar y medir, no markup para producción —
 * reconstruir flex a partir del JSON adivina intenciones y termina pareciéndose menos al diseño.
 *
 * Los subárboles que son puro vector (íconos, logos) se colapsan en un solo `<img>`. Un nodo con
 * texto adentro nunca se colapsa: el texto tiene que quedar seleccionable y medible.
 */

const VECTORIALES = new Set(['VECTOR', 'LINE', 'ELLIPSE', 'REGULAR_POLYGON', 'STAR', 'BOOLEAN_OPERATION']);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Dos decimales, redondeando al par en el empate exacto — igual que el `round()` de Python.
 *  Con `Math.round` un x.xx5 cae para el otro lado y la caja queda 0,01 px corrida respecto de
 *  lo que reporta Figma; sobre miles de nodos eso es ruido que después no se sabe de dónde salió. */
const r2 = (n) => {
  const x = n * 100;
  const piso = Math.floor(x);
  const resto = x - piso;
  const ent = resto > 0.5 ? piso + 1 : resto < 0.5 ? piso : (piso % 2 === 0 ? piso : piso + 1);
  return ent / 100;
};

function color(c, opacity = 1) {
  const [r, g, b] = ['r', 'g', 'b'].map((k) => Math.round((c[k] ?? 0) * 255));
  const a = Math.round((c.a ?? 1) * opacity * 1000) / 1000;
  return a >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`;
}

/** Primer fill sólido visible. Los degradados y las imágenes se ignoran a propósito: un
 *  degradado mal aproximado engaña más que un fondo liso. */
function relleno(node) {
  for (const f of node.fills || []) {
    if (f.visible === false) continue;
    if (f.type === 'SOLID') return color(f.color, f.opacity ?? 1);
  }
  return null;
}

function borde(node) {
  for (const s of node.strokes || []) {
    if (s.visible === false) continue;
    if (s.type === 'SOLID') {
      const w = node.strokeWeight || 1;
      return `${w}px solid ${color(s.color, s.opacity ?? 1)}`;
    }
  }
  return null;
}

function radio(node) {
  if (node.rectangleCornerRadii) return node.rectangleCornerRadii.map((v) => `${v}px`).join(' ');
  return node.cornerRadius ? `${node.cornerRadius}px` : null;
}

function sombra(node) {
  const partes = [];
  for (const e of node.effects || []) {
    if (e.visible === false) continue;
    if (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW') continue;
    const o = e.offset || { x: 0, y: 0 };
    const interior = e.type === 'INNER_SHADOW' ? 'inset ' : '';
    partes.push(`${interior}${o.x}px ${o.y}px ${e.radius ?? 0}px ${color(e.color)}`);
  }
  return partes.join(', ') || null;
}

function estiloTexto(node) {
  const s = node.style || {};
  const fam = `${s.fontFamily || 'Inter'}, system-ui, sans-serif`;
  const css = [
    `font-family: ${fam}`,
    `font-size: ${s.fontSize ?? 14}px`,
    `font-weight: ${s.fontWeight ?? 400}`,
  ];
  if (s.italic) css.push('font-style: italic');
  if (s.lineHeightPx) css.push(`line-height: ${r2(s.lineHeightPx)}px`);
  if (s.letterSpacing) css.push(`letter-spacing: ${r2(s.letterSpacing)}px`);
  if (s.textCase === 'UPPER') css.push('text-transform: uppercase');
  if (s.textDecoration === 'UNDERLINE') css.push('text-decoration: underline');
  css.push(`color: ${relleno(node) || '#000'}`);
  css.push(`text-align: ${(s.textAlignHorizontal || 'LEFT').toLowerCase()}`);
  // El alto de la caja de texto de Figma es el de la caja, no el del renglón: se centra
  // verticalmente según lo que diga el nodo para que el texto caiga donde cae en el diseño.
  const vertical = { TOP: 'flex-start', CENTER: 'center', BOTTOM: 'flex-end' };
  css.push(`justify-content: ${vertical[s.textAlignVertical] || 'flex-start'}`);
  return css.join('; ');
}

const tieneTexto = (n) => n.type === 'TEXT' || (n.children || []).some(tieneTexto);
const tieneVector = (n) => VECTORIALES.has(n.type) || (n.children || []).some(tieneVector);

/** ¿Este subárbol se dibuja como un solo SVG? Sí cuando no hay texto adentro y hay al menos un
 *  vector: íconos, logos, líneas divisorias, switches. */
const esImagen = (n) => !tieneTexto(n) && tieneVector(n);

function caja(node, ox, oy) {
  const b = node.absoluteBoundingBox;
  if (!b || b.width == null) return null;
  return [r2(b.x - ox), r2(b.y - oy), r2(b.width), r2(b.height)];
}

/** Un nodo, descrito una sola vez: qué es, en qué caja va y con qué estilos.
 *
 * Existe para que el HTML y el JSX no se traduzcan uno al otro sino que salgan los dos de acá.
 * Si el JSX se generara reescribiendo el HTML ya emitido, cualquier arreglo en uno tendría que
 * acordarse del otro, y el día que no se acuerde las dos salidas dejan de coincidir en silencio.
 *
 * `ox/oy` es la esquina superior izquierda del **padre**, no la del frame: cada caja es
 * `position: absolute` dentro de la anterior, así que sus hijos ya parten de su esquina. Restar
 * siempre el origen del frame sumaría el desplazamiento del padre en cada nivel y el contenido
 * se iría en diagonal.
 */
export function describir(node, ox, oy, imagenes) {
  if (node.visible === false) return null;
  const c = caja(node, ox, oy);
  if (!c) return null;
  const [x, y, w, h] = c;

  const css = [`left: ${x}px`, `top: ${y}px`, `width: ${w}px`, `height: ${h}px`];
  if ((node.opacity ?? 1) !== 1) css.push(`opacity: ${node.opacity}`);
  const s = sombra(node);
  if (s) css.push(`box-shadow: ${s}`);

  const base = { id: node.id, nombre: node.name || '', tipo: node.type };

  if (esImagen(node)) {
    imagenes.add(node.id);
    return { ...base, forma: 'img', css, archivo: `assets/${node.id.replaceAll(':', '-')}.svg` };
  }

  if (node.type === 'TEXT') {
    css.push(estiloTexto(node));
    return { ...base, forma: 'texto', css, texto: node.characters || '' };
  }

  const bg = relleno(node);
  if (bg) css.push(`background: ${bg}`);
  const b = borde(node);
  if (b) {
    css.push(`border: ${b}`);
    // Figma dibuja el borde centrado o por fuera de la caja; el navegador siempre por dentro.
    // `box-sizing: border-box` es la aproximación que no corre el contenido un pixel.
    css.push('box-sizing: border-box');
  }
  const rad = radio(node);
  if (rad) css.push(`border-radius: ${rad}`);
  if (node.clipsContent) css.push('overflow: hidden');

  const bb = node.absoluteBoundingBox;
  const hijos = (node.children || [])
    .map((k) => describir(k, bb.x, bb.y, imagenes))
    .filter(Boolean);
  return { ...base, forma: 'caja', css, hijos };
}

/** La descripción de un nodo, en HTML. */
function render(node, ox, oy, imagenes, nivel = 1) {
  const d = describir(node, ox, oy, imagenes);
  return d ? emitirHtml(d, nivel) : '';
}

function emitirHtml(d, nivel) {
  const sangria = '  '.repeat(nivel);
  const estilo = d.css.join('; ');
  const attrs = `data-node-id="${esc(d.id)}" data-name="${esc(d.nombre)}" data-type="${d.tipo}"`;

  if (d.forma === 'img') {
    return `${sangria}<img class="wf-n" ${attrs} style="${estilo}" src="${d.archivo}" alt="${esc(d.nombre)}">\n`;
  }
  if (d.forma === 'texto') {
    return `${sangria}<div class="wf-n wf-t" ${attrs} style="${estilo}">${esc(d.texto)}</div>\n`;
  }
  const hijos = d.hijos.map((k) => emitirHtml(k, nivel + 1)).join('');
  return `${sangria}<div class="wf-n" ${attrs} style="${estilo}">\n${hijos}${sangria}</div>\n`;
}

/** Un frame → `{ html, imagenes, descripcion }`.
 *
 * `imagenes` son los ids de los subárboles colapsados a SVG. `descripcion` es el árbol de nodos
 * ya resuelto, que es lo que consume el generador de React para no volver a interpretar nada. */
export function extraerFrame(frame, { slug, viewport }) {
  const b = frame.absoluteBoundingBox;
  const w = Math.round(b.width);
  const h = Math.round(b.height);
  const imagenes = new Set();
  const descripcion = (frame.children || [])
    .map((c) => describir(c, b.x, b.y, imagenes))
    .filter(Boolean);
  const cuerpo = descripcion.map((d) => emitirHtml(d, 3)).join('');
  const fondo = relleno(frame) || '#ffffff';

  const html = `<section class="wf-screen" id="${slug}" data-node-id="${frame.id}" data-viewport="${viewport}" data-width="${w}">
  <header class="wf-head">
    <h2>${esc(frame.name)}</h2>
    <span>${w}×${h} · node ${frame.id}</span>
  </header>
  <div class="wf-frame" style="width: ${w}px; height: ${h}px; background: ${fondo}">
${cuerpo}  </div>
</section>
`;
  return { html, imagenes: [...imagenes], width: w, height: h, descripcion, fondo };
}

/** El nombre de archivo y el ancla en el índice. */
export function slugify(nombre, viewport) {
  const base = String(nombre)
    .replace(/^(mobile|desktop)\s*\/\s*/i, '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\//g, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${viewport === 'mobile' ? 'mob' : 'desk'}-${base || 'frame'}`;
}

/** Un frame de 500px o menos de ancho se muestra a escala 1:1; el resto se achica. */
export const viewportDe = (ancho) => (ancho <= 500 ? 'mobile' : 'desktop');
