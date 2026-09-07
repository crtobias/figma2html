/** La UI. El trabajo pesado va al worker; acá sólo se recogen datos y se arma el .zip. */
import { parseFileKey } from './figma.js';
import { TEXTOS, PIEZAS, IDIOMAS, idiomaPreferido } from './i18n.js';

/** Los links del pie. `repo` además alimenta el botón "Código" de la barra superior.
 *  Si clonás esto para publicar tu propia copia, es lo único que hay que cambiar. */
const AUTOR = 'Tobias González Arriola';
const ENLACES = {
  repo: 'https://github.com/crtobias/figma2html',
  GitHub: 'https://github.com/crtobias',
  LinkedIn: 'https://www.linkedin.com/in/tobias-gonzalez-arriola-0a2399273/',
  Portfolio: 'https://tobias-gonzalez-arriola.vercel.app/',
};

const $ = (s) => document.querySelector(s);
const log = (...a) => console.log('[f2h]', ...a);

// --- Idioma -----------------------------------------------------------------------------------
// La página se sirve ya traducida (/ en español, /en/ en inglés), así que esto no traduce en el
// arranque: sólo deja cambiar de idioma sin recargar y manda a la otra URL al visitante que cae
// en la que no le corresponde. Un buscador tiene que ver contenido estable en cada URL.

const IDIOMA_GUARDADO = 'figmatohtml:idioma';
const idiomaDeLaPagina = document.documentElement.lang === 'en' ? 'en' : 'es';
let idioma = idiomaDeLaPagina;

const rellenar = (texto, piezas) => texto.replace(/\{(\w+)\}/g, (_, k) => piezas[k] ?? `{${k}}`);

function traducir(nuevo) {
  const t = TEXTOS[nuevo];
  if (!t) return;
  idioma = nuevo;
  document.documentElement.lang = t['html.lang'];
  document.title = t['meta.title'];
  $('meta[name="description"]')?.setAttribute('content', t['meta.description']);

  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = t[el.dataset.i18n];
    if (v != null) el.textContent = v;
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const v = t[el.dataset.i18nPlaceholder];
    if (v != null) el.placeholder = v;
  }
  // Los párrafos con marcado adentro se arman acá: el texto trae {marcadores} y cada uno se
  // reemplaza por su etiqueta ya escapada. Nunca se interpola contenido de afuera.
  for (const el of document.querySelectorAll('[data-i18n-html]')) {
    const v = t[el.dataset.i18nHtml];
    if (v != null) el.innerHTML = rellenar(v, { api: '<code>api.figma.com</code>' });
  }
  for (const el of document.querySelectorAll('[data-i18n-token-p]')) {
    const v = t['token.p'];
    if (v != null) el.innerHTML = rellenar(v, Object.fromEntries(Object.entries(PIEZAS[nuevo]).map(([k, w]) => [k, `<em>${w}</em>`])));
  }
  pintarIdiomas();
  pintarLinks();
  if (frames.length) pintarLista();
}

function pintarIdiomas() {
  $('#idiomas').innerHTML = Object.entries(IDIOMAS)
    .map(([cod, etiqueta]) => `<button type="button" data-idioma="${cod}"${cod === idioma ? ' class="activo" aria-current="true"' : ''}>${etiqueta}</button>`)
    .join('');
}

$('#idiomas').addEventListener('click', (e) => {
  const cod = e.target.dataset.idioma;
  if (!cod || cod === idioma) return;
  localStorage.setItem(IDIOMA_GUARDADO, cod);
  // Cada idioma tiene su URL propia: se navega, así el link que comparta el visitante ya viene
  // en el idioma que estaba viendo.
  location.href = cod === 'en' ? '/en/' : '/';
});

// Quien llega desde afuera cae en la URL que su navegador pide, salvo que haya elegido a mano.
// El redirect corre una sola vez y sólo si el idioma correcto es el otro, para no rebotar.
(function elegirIdiomaAlEntrar() {
  let guardado = null;
  try { guardado = localStorage.getItem(IDIOMA_GUARDADO); } catch { /* modo privado */ }
  const quiere = idiomaPreferido(guardado, navigator.languages || [navigator.language]);
  if (quiere === idiomaDeLaPagina) return;
  const destino = quiere === 'en' ? '/en/' : '/';
  if (location.pathname !== destino) location.replace(destino + location.hash);
})();

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

function pintarLinks() {
  $('#links').innerHTML = Object.entries(ENLACES)
    .map(([texto, url]) => {
      const nombre = texto === 'repo' ? TEXTOS[idioma]['pie.repo'] : texto;
      return `<a href="${url}" target="_blank" rel="noopener">${nombre}</a>`;
    }).join('');
  $('[data-link="repo"]').href = ENLACES.repo;
  $('#autor').innerHTML = `${TEXTOS[idioma]['pie.autor']} <a href="${ENLACES.Portfolio}" target="_blank" rel="noopener">${AUTOR}</a>`;
}
pintarIdiomas();
pintarLinks();

// La cota del hero dice el tamaño REAL de la caja que envuelve al título. En una herramienta
// que se vende como "medí, no aproximes", un número escrito a mano sería la peor primera
// impresión posible — y además el bloque mide distinto en cada idioma y en cada ancho.
function medirTitulo() {
  const caja = document.querySelector('.medido');
  const cota = document.querySelector('.cota-h');
  const alto = document.querySelector('.cota-v');
  if (!caja || !cota) return;
  const r = caja.getBoundingClientRect();
  const w = Math.round(r.width);
  const h = Math.round(r.height);
  cota.textContent = `${w} × ${h}`;
  if (alto) alto.textContent = `↕ ${h}`;
}
medirTitulo();
addEventListener('resize', medirTitulo);
// Las fuentes llegan después del primer layout y cambian el ancho del título.
document.fonts?.ready.then(medirTitulo);

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

    // El peso del árbol es el mejor anticipo de si esto va a entrar en memoria: la geometría que
    // falta pedir suele pesar el doble, y todo convive en la pestaña al mismo tiempo. Por encima
    // del umbral conviene ir por tandas, así que en vez de exportar todo se abre el selector.
    const mb = d.bytes ? d.bytes / 1048576 : 0;
    const t = TEXTOS[idioma];
    estado('#estado', `${frames.length} ${t['estado.frames']} "${d.nombre}"${mb ? ` · ${mb.toFixed(0)} MB` : ''}`, 'bien');

    if (autoExportar && mb > 40) {
      autoExportar = false;
      $('#paso-elegir').classList.remove('oculto');
      pintarLista();
      estado('#estado', rellenar(t['estado.pesado'], { mb: mb.toFixed(0) }), 'aviso');
      $('#paso-elegir').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
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
