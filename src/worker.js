/** Todo el trabajo pesado, fuera del hilo principal.
 *
 * Un archivo real son decenas de MB de JSON y miles de nodos: parsearlo y recorrerlo en el hilo
 * de la UI congela la página varios segundos. Acá el token entra por mensaje, se usa para hablar
 * con Figma y nunca se guarda en ningún lado.
 */
import { getFile, getGeometry, listarFrames, indexarFrames } from './figma.js';
import { extraerFrame, slugify, viewportDe } from './extract.js';
import { indexarGeometria, generarSvgs } from './svg.js';
import { construirIndice } from './shell.js';

let doc = null;      // la respuesta de /v1/files, cacheada entre "analizar" y "exportar"
let fileKey = null;

const avisar = (texto, pct) => postMessage({ tipo: 'progreso', texto, pct });
const log = (...a) => console.log('[f2h:worker]', ...a);
log('worker arrancado');

async function analizar({ key, token }) {
  fileKey = key;
  avisar('Bajando el árbol del archivo…');
  const t0 = performance.now();
  doc = await getFile(key, token);
  log(`archivo "${doc.name}" bajado en ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  const frames = listarFrames(doc);
  log(frames.length, 'frames encontrados');
  postMessage({ tipo: 'frames', nombre: doc.name, frames, bytes: doc.__bytes });
}

/** Las familias tipográficas que el archivo usa, para pedirle a Google Fonts sólo esas. */
function fuentesUsadas(nodo, salida = new Set()) {
  if (nodo.style?.fontFamily) salida.add(nodo.style.fontFamily);
  for (const c of nodo.children || []) fuentesUsadas(c, salida);
  return salida;
}

async function exportar({ ids, token, titulo }) {
  const idx = indexarFrames(doc);
  const usados = new Set();

  // 1. Los fragmentos HTML. Es puro recorrido del JSON que ya tenemos: no toca la red.
  avisar('Convirtiendo frames a HTML…', 5);
  const pantallas = [];
  const fuentes = new Set();
  const imagenes = new Set();
  for (const [i, id] of ids.entries()) {
    const frame = idx.get(id);
    if (!frame) continue;
    const viewport = viewportDe(Math.round(frame.absoluteBoundingBox.width));
    // Dos frames pueden llamarse igual — Figma lo permite. El sufijo evita que uno pise al otro.
    let slug = slugify(frame.name, viewport);
    if (usados.has(slug)) {
      let n = 2;
      while (usados.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    usados.add(slug);

    const r = extraerFrame(frame, { slug, viewport });
    r.imagenes.forEach((x) => imagenes.add(x));
    fuentesUsadas(frame, fuentes);
    pantallas.push({ slug, name: frame.name, viewport, html: r.html });
    avisar(`Convirtiendo frames a HTML… ${i + 1}/${ids.length}`, 5 + (25 * (i + 1)) / ids.length);
  }

  // 2. La geometría vectorial, para dibujar los íconos sin gastar la cuota de /v1/images.
  avisar('Pidiendo la geometría de los vectores…', 30);
  const geo = await getGeometry(fileKey, ids, token, {
    onProgress: (hechos, total) => avisar(`Pidiendo la geometría… ${hechos}/${total} frames`, 30 + (35 * hechos) / total),
  });

  log(imagenes.size, 'subárboles vectoriales para dibujar');
  avisar('Dibujando los SVG…', 65);
  const gidx = indexarGeometria(geo);
  const { svgs, vacios, ausentes } = generarSvgs([...imagenes], gidx, {
    onProgress: (hechos, total) => {
      if (hechos % 100 === 0) avisar(`Dibujando los SVG… ${hechos}/${total}`, 65 + (25 * hechos) / total);
    },
  });

  // 3. El índice navegable.
  avisar('Armando el índice…', 92);
  const index = construirIndice(pantallas, {
    titulo: titulo || doc.name,
    subtitulo: `${pantallas.length} pantallas extraídas de Figma tal cual, el ${new Date().toISOString().slice(0, 10)}.`,
    fuentes: [...fuentes],
  });

  postMessage({
    tipo: 'listo',
    index,
    pantallas: pantallas.map(({ slug, html }) => ({ slug, html })),
    svgs: [...svgs].map(([id, svg]) => [id.replaceAll(':', '-'), svg]),
    aviso: { vacios: vacios.length, ausentes: ausentes.length },
  });
}

onmessage = async (e) => {
  try {
    if (e.data.op === 'analizar') await analizar(e.data);
    if (e.data.op === 'exportar') await exportar(e.data);
  } catch (err) {
    console.error('[f2h:worker]', err);
    postMessage({ tipo: 'error', mensaje: err.message || String(err) });
  }
};
