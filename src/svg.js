/** Los SVG de los íconos, dibujados **localmente** desde la geometría del archivo.
 * Port de `svgs-locales.py`.
 *
 * Por qué existe: `GET /v1/images` (el que renderiza nodos a SVG) es Tier 1 y su cuota se cuenta
 * por llamada — un asiento View/Collab tiene ~20 **al mes**. `GET /v1/files/:key/nodes?geometry=paths`
 * es otro endpoint, con otro presupuesto, y devuelve el path data de cada nodo vectorial. Con eso
 * el SVG se arma acá y Figma no tiene que renderizar nada.
 *
 * `extract.js` colapsa cada subárbol que es puro vector en un solo `<img>`. Este módulo
 * reconstruye ese mismo colapso: junta la geometría de todos los descendientes del nodo, cada una
 * desplazada por la posición de su caja respecto de la caja del nodo raíz.
 */

/** Cuatro decimales, redondeando al par en el empate exacto — igual que el `%.4f` de Python y
 *  que el `r2` de extract.js. `toFixed` redondea siempre para arriba y desplaza el path 0,0001. */
function r4(n) {
  const x = n * 1e4;
  const piso = Math.floor(x);
  const resto = x - piso;
  const ent = resto > 0.5 ? piso + 1 : resto < 0.5 ? piso : (piso % 2 === 0 ? piso : piso + 1);
  return ent / 1e4;
}
const g4 = r4;
/** Como el `%g` de Python: sin ceros de más. */
const gn = (n) => String(Number(Number(n).toPrecision(6)));

function color(pintura, opacidadNodo = 1) {
  const c = pintura.color || {};
  const [r, g, b] = ['r', 'g', 'b'].map((k) => Math.round((c[k] ?? 0) * 255));
  const a = Math.round((c.a ?? 1) * (pintura.opacity ?? 1) * opacidadNodo * 10000) / 10000;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** El primer relleno visible. Sólo SOLID: adivinar un gradiente sale peor que el color plano. */
function primeraPintura(pinturas, opacidad) {
  for (const p of pinturas || []) {
    if (p.visible === false) continue;
    if (p.type === 'SOLID') return color(p, opacidad);
  }
  return null;
}

/** Índice id → nodo sobre la respuesta de `/nodes?geometry=paths`. */
export function indexarGeometria(geo) {
  const idx = new Map();
  const walk = (n) => {
    idx.set(n.id, n);
    for (const c of n.children || []) walk(c);
  };
  for (const v of Object.values(geo.nodes || {})) if (v?.document) walk(v.document);
  return idx;
}

/** Identidad visual de un subárbol: de qué componente sale, de qué tamaño, y la geometría y los
 *  colores exactos de todos sus descendientes. Dos nodos con la misma firma se dibujan igual,
 *  aunque sean instancias distintas en pantallas distintas — sirve para generar el SVG una sola
 *  vez y reusar el string en los cientos de repeticiones que tiene un archivo real. */
export function firma(n) {
  const bb = n.absoluteBoundingBox || {};
  const partes = [n.componentId || n.type, `${bb.width}x${bb.height}`];
  const rec = (x) => {
    for (const g of [...(x.fillGeometry || []), ...(x.strokeGeometry || [])]) partes.push(g.path || '');
    for (const f of [...(x.fills || []), ...(x.strokes || [])]) {
      const c = f.color || {};
      partes.push(`${f.type}:${c.r},${c.g},${c.b},${f.opacity}`);
    }
    partes.push(String(x.rotation));
    for (const c of x.children || []) rec(c);
  };
  rec(n);
  return partes.join('|');
}

/** Los `<path>` de un nodo, ya colocados en el espacio del SVG.
 *
 * La geometría que Figma devuelve está en coordenadas locales del nodo, **sin rotar**, con su
 * esquina en (0,0). El `absoluteBoundingBox`, en cambio, ya está rotado: es la caja alineada a
 * los ejes que envuelve a la forma girada. Así que hay dos pasos, y el orden importa: primero se
 * desplaza la geometría a donde va la caja, después se la gira alrededor del centro de esa caja.
 *
 * El giro llega acumulado desde los ancestros: rotar un contenedor rota lo que tiene adentro, y
 * la geometría del hijo viene sin ninguna de las dos rotaciones aplicadas.
 */
function pathsDe(nodo, ox, oy, opacidad, giro = 0) {
  const salida = [];
  const caja = nodo.absoluteBoundingBox;
  if (!caja) return salida;
  const dx = caja.x - ox;
  const dy = caja.y - oy;
  const partes = [];
  if (giro) {
    // SVG toma grados y sentido horario; Figma da radianes antihorarios.
    const grados = (-giro * 180) / Math.PI;
    const cx = dx + caja.width / 2;
    const cy = dy + caja.height / 2;
    partes.push(`rotate(${r4(grados)} ${r4(cx)} ${r4(cy)})`);
  }
  if (dx || dy) partes.push(`translate(${g4(dx)} ${g4(dy)})`);
  const mover = partes.length ? ` transform="${partes.join(' ')}"` : '';

  const relleno = primeraPintura(nodo.fills, opacidad);
  for (const g of nodo.fillGeometry || []) {
    if (!g.path) continue;
    const regla = g.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero';
    salida.push(`<path d="${g.path}" fill="${relleno || 'none'}" fill-rule="${regla}"${mover}/>`);
  }

  // El trazo también viene como geometría rellenable: Figma ya lo convirtió en contorno, así que
  // se pinta con `fill` y el color del stroke — no con `stroke`/`stroke-width`.
  const trazo = primeraPintura(nodo.strokes, opacidad);
  for (const g of nodo.strokeGeometry || []) {
    if (!g.path) continue;
    const regla = g.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero';
    salida.push(`<path d="${g.path}" fill="${trazo || 'none'}" fill-rule="${regla}"${mover}/>`);
  }
  return salida;
}

/** El SVG completo de un subárbol, o `null` si no hay nada que dibujar. */
export function construir(raiz) {
  const caja = raiz.absoluteBoundingBox;
  if (!caja?.width || !caja?.height) return null;
  const { x: ox, y: oy, width: w, height: h } = caja;

  const piezas = [];
  const recortes = [];

  const recorrer = (n, opacidad, giro, recorte) => {
    if (n.visible === false) return;
    const op = opacidad * (n.opacity ?? 1);
    // `rotation` es la del nodo respecto de su padre: se suma bajando por el árbol.
    const g = giro + (n.rotation || 0);

    const propias = pathsDe(n, ox, oy, op, g);
    if (propias.length) {
      const grupo = recorte ? `<g clip-path="url(#${recorte})">` : '';
      piezas.push(grupo + propias.join('') + (grupo ? '</g>' : ''));
    }

    // Un contenedor con `clipsContent` recorta a sus hijos a su propia caja. Sin esto, un ícono
    // que asoma del frame se dibuja entero y la caja del `<img>` queda chica.
    let hijosRecorte = recorte;
    if (n.clipsContent && n.children?.length) {
      const cja = n.absoluteBoundingBox;
      if (cja) {
        const cid = `c${recortes.length}`;
        recortes.push(`<clipPath id="${cid}"><rect x="${g4(cja.x - ox)}" y="${g4(cja.y - oy)}" width="${gn(cja.width)}" height="${gn(cja.height)}"/></clipPath>`);
        hijosRecorte = cid;
      }
    }

    for (const c of n.children || []) recorrer(c, op, g, hijosRecorte);
  };

  recorrer(raiz, 1, 0, null);
  if (!piezas.length) return null;
  const defs = recortes.length ? `<defs>${recortes.join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${gn(w)}" height="${gn(h)}" viewBox="0 0 ${gn(w)} ${gn(h)}" fill="none">${defs}${piezas.join('')}</svg>`;
}

/** `ids` → `{ svgs: Map(id → texto), vacios, ausentes }`.
 *
 * Cada nodo se dibuja entero, sin reusar el SVG de otro con la misma `firma`: dos instancias del
 * mismo componente pueden tener sus hijos a fracciones de pixel distintas del origen, y el
 * `translate` de cada `<path>` sale de esa resta. Reusar el string movía íconos 0,01 px.
 */
export function generarSvgs(ids, idx, { onProgress } = {}) {
  const svgs = new Map();
  const vacios = [];
  const ausentes = [];
  let hechos = 0;
  for (const id of ids) {
    const nodo = idx.get(id);
    if (!nodo) { ausentes.push(id); continue; }
    const svg = construir(nodo);
    if (!svg) { vacios.push(id); continue; }
    svgs.set(id, svg);
    onProgress?.(++hechos, ids.length);
  }
  return { svgs, vacios, ausentes };
}
