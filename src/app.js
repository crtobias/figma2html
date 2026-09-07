/** La UI. El trabajo pesado va al worker; acá sólo se recogen datos y se arma el .zip. */
import { parseFileKey } from './figma.js';

/** ⬇ TODO: completá con tus links. Es lo único que hay que tocar para publicar tu copia.
 *  `repo` además alimenta el botón "Código" de la barra superior. */
const ENLACES = {
  repo: 'https://github.com/TU-USUARIO/FigmaToHtml',
  GitHub: 'https://github.com/TU-USUARIO',
  LinkedIn: 'https://www.linkedin.com/in/TU-USUARIO',
  Portfolio: 'https://TU-PORTFOLIO.com',
};

const $ = (s) => document.querySelector(s);
const log = (...a) => console.log('[f2h]', ...a);

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

// Sin esto, un worker que ni siquiera llega a arrancar (un error de sintaxis en un módulo que
// importa, por ejemplo) deja la UI colgada para siempre en el último mensaje que alcanzó a
// mostrar: `postMessage` no falla, simplemente nadie contesta nunca.
worker.onerror = (e) => {
  console.error('[f2h] el worker no arrancó', e);
  const donde = exportando ? '#estado-3' : '#estado';
  estado(donde, `No arrancó el motor de conversión${e.message ? `: ${e.message}` : ''}. Mirá la consola.`, 'mal');
  $('#convertir').disabled = false;
  $('#exportar').disabled = false;
  $('#barra').classList.remove('indeterminada');
};

let frames = [];
let nombreArchivo = 'figma-export';
// Al pegar token y URL se exporta todo de una. El selector de pantallas es el desvío opcional.
let autoExportar = true;
// El panel con la barra recién aparece cuando hay una exportación en curso: mientras se baja el
// archivo no hay porcentaje que mostrar (un fetch no reporta avance) y una barra clavada en cero
// se lee como que algo se colgó.
let exportando = false;

$('#links').innerHTML = Object.entries(ENLACES)
  .map(([texto, url]) => {
    const nombre = texto === 'repo' ? 'Repositorio' : texto;
    return `<a href="${url}" target="_blank" rel="noopener">${nombre}</a>`;
  }).join('');
$('[data-link="repo"]').href = ENLACES.repo;

// El token se guarda sólo si el usuario lo pide, y sólo en su propio navegador.
const GUARDADO = 'figmatohtml:token';
const recordado = localStorage.getItem(GUARDADO);
if (recordado) { $('#token').value = recordado; $('#recordar').checked = true; }

const token = () => $('#token').value.trim();

function estado(sel, texto, clase = '') {
  const el = $(sel);
  el.textContent = texto;
  el.className = `estado ${clase}`;
}

function analizar() {
  const key = parseFileKey($('#url').value);
  if (!key) { estado('#estado', 'Esa URL no parece de un archivo de Figma.', 'mal'); return false; }
  if (!token()) { estado('#estado', 'Falta el token.', 'mal'); return false; }
  localStorage[$('#recordar').checked ? 'setItem' : 'removeItem'](GUARDADO, token());
  $('#convertir').disabled = true;
  estado('#estado', 'Bajando el archivo… puede tardar, son decenas de MB.', 'trabajando');
  log('analizar', key);
  worker.postMessage({ op: 'analizar', key, token: token() });
  return true;
}

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  autoExportar = true;
  analizar();
});

$('#elegir').addEventListener('click', (e) => {
  e.preventDefault();
  autoExportar = false;
  analizar();
});

// --- Selector opcional de pantallas -----------------------------------------------------------

const viewportDe = (f) => (f.width <= 500 ? 'mobile' : 'desktop');

function pintarLista() {
  const filtro = $('#filtro').value.toLowerCase();
  $('#lista').innerHTML = frames.map((f, i) => {
    const oculto = filtro && !f.name.toLowerCase().includes(filtro);
    const vp = viewportDe(f);
    return `<label class="fila${oculto ? ' oculto' : ''}">
      <input type="checkbox" data-i="${i}"${f.sel ? ' checked' : ''}>
      <span class="nombre">${f.name.replace(/</g, '&lt;')}</span>
      <span class="medida">${f.width}×${f.height}</span>
      <span class="vp vp-${vp}">${vp}</span>
    </label>`;
  }).join('');
  const n = frames.filter((f) => f.sel).length;
  $('#contador').textContent = `${n} de ${frames.length} seleccionadas`;
  $('#exportar').disabled = n === 0;
}

$('#lista').addEventListener('change', (e) => {
  if (e.target.dataset.i === undefined) return;
  frames[+e.target.dataset.i].sel = e.target.checked;
  pintarLista();
});
$('#filtro').addEventListener('input', pintarLista);

$('.barra-lista').addEventListener('click', (e) => {
  const modo = e.target.dataset.sel;
  if (!modo) return;
  for (const f of frames) {
    if (modo === 'todos') f.sel = true;
    else if (modo === 'ninguno') f.sel = false;
    else f.sel = viewportDe(f) === modo;
  }
  pintarLista();
});

$('#exportar').addEventListener('click', () => exportar(frames.filter((f) => f.sel).map((f) => f.id)));

function exportar(ids) {
  log('exportar', ids.length, 'frames');
  exportando = true;
  $('#exportar').disabled = true;
  $('#paso-listo').classList.remove('oculto');
  $('#resultado').innerHTML = '';
  $('#barra').style.width = '0%';
  $('#paso-listo').scrollIntoView({ behavior: 'smooth', block: 'center' });
  worker.postMessage({ op: 'exportar', ids, token: token(), titulo: nombreArchivo });
}

// --- Empaquetado -------------------------------------------------------------------------------

async function empaquetar(d) {
  log('empaquetando', d.pantallas.length, 'pantallas y', d.svgs.length, 'íconos');
  estado('#estado-3', 'Comprimiendo el .zip…', 'trabajando');
  const zip = new JSZip();
  zip.file('index.html', d.index);
  const screens = zip.folder('screens');
  for (const p of d.pantallas) screens.file(`${p.slug}.html`, p.html);
  const assets = zip.folder('assets');
  for (const [nombre, svg] of d.svgs) assets.file(`${nombre}.svg`, svg);
  zip.file('LEEME.txt',
    'Abrí index.html en el navegador.\n\n'
    + 'screens/ — un fragmento HTML por pantalla, con las medidas exactas de Figma.\n'
    + 'assets/  — los íconos, dibujados desde la geometría vectorial del archivo.\n\n'
    + 'Cada elemento lleva data-node-id, data-name y data-type: inspeccionalo con las\n'
    + 'DevTools para leer el tamaño y la posición reales de cualquier caja.\n');

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (m) => { $('#barra').style.width = `${92 + m.percent * 0.08}%`; },
  );

  $('#barra').classList.remove('indeterminada');
  const url = URL.createObjectURL(blob);
  const nombre = `${nombreArchivo.replace(/[^\w-]+/g, '-').toLowerCase()}-html.zip`;
  const mb = (blob.size / 1024 / 1024).toFixed(1);
  $('#barra').style.width = '100%';
  estado('#estado-3', '');
  $('#resultado').innerHTML = `
    <a class="primario descarga" href="${url}" download="${nombre}">Descargar ${nombre} · ${mb} MB</a>
    <p class="ayuda">
      ${d.pantallas.length} pantallas · ${d.svgs.length} íconos.
      Descomprimí y abrí <code>index.html</code>.
      ${d.aviso.vacios ? `<br>${d.aviso.vacios} nodos quedaron vacíos: son imágenes o máscaras, que no tienen geometría vectorial que dibujar.` : ''}
    </p>`;
}

// --- Mensajes del worker -----------------------------------------------------------------------

worker.onmessage = async ({ data: d }) => {
  if (d.tipo !== 'progreso') log('←', d.tipo, d.mensaje || '');
  if (d.tipo === 'error') {
    exportando = false;
    $('#barra').classList.remove('indeterminada');
    $('#convertir').disabled = false;
    $('#exportar').disabled = false;
    const enProgreso = !$('#paso-listo').classList.contains('oculto');
    return estado(enProgreso ? '#estado-3' : '#estado', d.mensaje, 'mal');
  }

  if (d.tipo === 'frames') {
    $('#convertir').disabled = false;
    nombreArchivo = d.nombre || 'figma-export';
    frames = d.frames.map((f) => ({ ...f, sel: true }));
    if (!frames.length) return estado('#estado', 'No encontré frames en ese archivo.', 'mal');
    estado('#estado', `${frames.length} frames en "${d.nombre}"`, 'bien');
    if (autoExportar) return exportar(frames.map((f) => f.id));
    $('#paso-elegir').classList.remove('oculto');
    pintarLista();
    $('#paso-elegir').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (d.tipo === 'progreso') {
    // Antes de exportar, lo que hay para contar es la bajada del archivo: va en el formulario.
    if (!exportando) return estado('#estado', d.texto, 'trabajando');
    $('#paso-listo').classList.remove('oculto');
    estado('#estado-3', d.texto, 'trabajando');
    // Sin porcentaje la barra corre en modo indeterminado en vez de quedarse quieta.
    $('#barra').classList.toggle('indeterminada', d.pct == null);
    if (d.pct != null) $('#barra').style.width = `${d.pct}%`;
  }

  if (d.tipo === 'listo') await empaquetar(d);
};
