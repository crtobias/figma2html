/** Cliente de la REST API de Figma — corre en el browser del usuario.
 *
 * El token va en el header `X-Figma-Token` y nunca sale de esta máquina: `api.figma.com`
 * responde con `access-control-allow-origin: *`, así que el fetch se hace directo contra
 * Figma sin pasar por ningún servidor intermedio.
 *
 * Ninguna función de acá toca `/v1/images` a propósito: es el endpoint Tier 1 cuya cuota se
 * cuenta **por llamada** (~20 al mes en un asiento View/Collab). Los íconos se dibujan desde
 * la geometría vectorial que devuelve `/v1/files/:key/nodes?geometry=paths` (ver svg.js).
 */

/** El fileKey sale de la URL: figma.com/design/<fileKey>/<nombre>?node-id=… */
export function parseFileKey(entrada) {
  const limpio = (entrada || '').trim();
  if (!limpio) return null;
  const m = limpio.match(/figma\.com\/(?:file|design|board|proto)\/([A-Za-z0-9]{10,})/);
  if (m) return m[1];
  // También se acepta pegar el key pelado.
  return /^[A-Za-z0-9]{10,}$/.test(limpio) ? limpio : null;
}

async function pedirTexto(url, token) {
  const r = await fetch(url, { headers: { 'X-Figma-Token': token } });
  await revisar(r);
  return r.text();
}

async function pedir(url, token) {
  const r = await fetch(url, { headers: { 'X-Figma-Token': token } });
  await revisar(r);
  return r.json();
}

async function revisar(r) {
  if (r.status === 403) throw new Error('Token rechazado (403). Revisá que sea válido y tenga permiso "File content: Read only".');
  if (r.status === 404) throw new Error('Archivo no encontrado (404). Revisá la URL, o que tu cuenta tenga acceso a ese archivo.');
  if (r.status === 429) {
    const espera = r.headers.get('Retry-After');
    throw new Error(`Rate limit de Figma (429).${espera ? ` Retry-After: ${espera}s.` : ''}`);
  }
  if (!r.ok) throw new Error(`La API respondió ${r.status}.`);
}

/** El árbol completo, con geometría de cajas, fills, strokes, efectos y texto.
 *
 * Devuelve también cuántos bytes pesó: es el número con el que la interfaz decide si avisar que
 * el archivo es grande. Se lee del cuerpo y no del `Content-Length`, que viene comprimido y
 * miente por un factor de diez sobre lo que realmente ocupa en memoria.
 */
export async function getFile(fileKey, token) {
  const texto = await pedirTexto(`https://api.figma.com/v1/files/${fileKey}`, token);
  const doc = JSON.parse(texto);
  doc.__bytes = texto.length;
  return doc;
}

/** Igual que getFile pero acotado a unos nodos y **con las curvas**.
 *
 * `geometry=paths` es la clave: sin él la API devuelve cajas y colores pero ninguna curva. Con
 * él cada nodo trae `fillGeometry`/`strokeGeometry`, que son path data de SVG listos para usar.
 * Se pide en lotes porque la respuesta es pesada (decenas de MB en archivos grandes).
 */
export async function getGeometry(fileKey, ids, token, { onProgress } = {}) {
  // El lote va al MÁXIMO que aguante la URL, no al mínimo prudente: la cuota de Figma se cuenta
  // **por llamada, no por nodo**, así que partir 80 frames en tandas de 20 gasta 4 veces más
  // presupuesto que pedirlos todos juntos, para traer exactamente los mismos datos. Un id son
  // ~9 caracteres; 400 entran de sobra en el largo práctico de una query string.
  const lote = 400;
  const nodes = {};
  for (let i = 0; i < ids.length; i += lote) {
    const tanda = ids.slice(i, i + lote);
    const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${tanda.join(',')}&geometry=paths`;
    const r = await pedir(url, token);
    Object.assign(nodes, r.nodes || {});
    onProgress?.(Math.min(i + lote, ids.length), ids.length);
  }
  return { nodes };
}

/** Los frames exportables del archivo, en orden de lectura.
 *
 * Se baja por SECTION y GROUP: Figma deja meter los frames adentro de una sección, y mirar
 * sólo el primer nivel de la página los pierde en silencio. No se entra a un FRAME: los frames
 * anidados son parte del diseño de su padre, no pantallas sueltas.
 */
export function listarFrames(doc) {
  const salida = [];
  for (const page of doc.document.children || []) {
    const recorrer = (nodos) => {
      for (const n of nodos) {
        if (n.type === 'FRAME' || n.type === 'COMPONENT') {
          const b = n.absoluteBoundingBox;
          if (b?.width) salida.push({ id: n.id, name: n.name, page: page.name, width: Math.round(b.width), height: Math.round(b.height) });
        } else if (n.type === 'SECTION' || n.type === 'GROUP') {
          recorrer(n.children || []);
        }
      }
    };
    recorrer(page.children || []);
  }
  return salida;
}

/** Índice id → nodo, entrando a secciones y grupos igual que listarFrames. */
export function indexarFrames(doc) {
  const idx = new Map();
  for (const page of doc.document.children || []) {
    const recorrer = (nodos) => {
      for (const n of nodos) {
        idx.set(n.id, n);
        if (n.type === 'SECTION' || n.type === 'GROUP') recorrer(n.children || []);
      }
    };
    recorrer(page.children || []);
  }
  return idx;
}
