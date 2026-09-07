/** Los textos de la página, en los dos idiomas.
 *
 * Este archivo es la única fuente: `build.mjs` lo lee para generar la versión estática en inglés
 * (/en/), y el navegador lo usa para cambiar de idioma sin recargar. Las claves salen de los
 * atributos `data-i18n` del HTML.
 *
 * Por qué dos URLs y no sólo un botón: un buscador indexa lo que el servidor manda. Si el inglés
 * existiera únicamente después de que corra un script, la página competiría por "figma to html"
 * con contenido en español — que es justo donde está casi todo el volumen de búsqueda.
 */

export const IDIOMAS = { es: 'ES', en: 'EN' };

export const TEXTOS = {
  es: {
    'html.lang': 'es',
    'meta.title': 'figma2html — medí el diseño, no lo aproximes',
    'meta.description': 'Convertí un archivo de Figma en HTML con las medidas exactas de cada nodo. Corre entero en tu navegador: tu token nunca sale de tu máquina.',
    'meta.ogLocale': 'es_AR',
    'meta.ogAlt': 'Medí el diseño. No lo aproximes.',

    'nav.como': 'Cómo funciona',
    'nav.privacidad': 'Privacidad',
    'nav.codigo': 'Código',

    'hero.kicker': 'Open source · corre en tu navegador',
    'hero.titulo1': 'Medí el diseño.',
    'hero.titulo2': 'No lo aproximes.',
    'hero.bajada': 'Convertí cualquier archivo de Figma en HTML donde cada elemento está en su caja exacta. Abrís las DevTools y leés el ancho, el alto y el padding reales — en vez de sacarlos a ojo.',
    'hero.sello1': 'Tu token no sale de tu máquina',
    'hero.sello2': 'No gasta tu cuota de Figma',

    'form.urlLabel': 'URL del archivo de Figma',
    'form.urlPlaceholder': 'figma.com/design/AbC123…',
    'form.tokenLabel': 'Tu token personal de Figma',
    'form.tokenAyuda': '¿De dónde saco el token? →',
    'form.boton': 'Convertir a HTML',
    'form.recordar': 'Recordar el token acá',
    'form.elegir': 'elegir pantallas →',
    'form.privacidad': 'Esta página es HTML estático. El pedido va de tu navegador directo a {api} — no hay servidor en el medio.',

    'elegir.titulo': 'Elegí qué exportar',
    'elegir.filtro': 'Filtrar por nombre…',
    'elegir.todos': 'Todos',
    'elegir.ninguno': 'Ninguno',
    'elegir.desktop': 'Desktop',
    'elegir.mobile': 'Mobile',
    'elegir.boton': 'Exportar las seleccionadas',

    'pasos.1t': 'Baja el árbol',
    'pasos.1p': 'Posición, tamaño, color y texto de cada nodo, tal como los reporta Figma.',
    'pasos.2t': 'Dibuja cada caja',
    'pasos.2p': 'En posición absoluta, con las coordenadas exactas. Sin flex adivinado.',
    'pasos.3t': 'Te da un .zip',
    'pasos.3p': 'Índice navegable, una pantalla por archivo y los íconos como SVG locales.',

    'cuota.titulo': 'No te agota la cuota de Figma',
    'cuota.p1a': 'El endpoint que renderiza imágenes cuenta su cuota ',
    'cuota.p1b': 'por llamada, no por ícono',
    'cuota.p1c': ': una cuenta gratuita tiene unas 20 al mes. Una sola extracción grande la quema entera.',
    'cuota.p2': 'Esta herramienta nunca lo toca. Pide la geometría vectorial —otro endpoint, otro presupuesto— y arma los SVG en tu navegador.',
    'cuota.espera': '↑ 90 horas de espera',
    'cuota.usa': '↑ lo que usa esta herramienta',

    'features.titulo': 'Qué te llevás',
    'features.1t': 'Medidas exactas',
    'features.1p': 'Cada nodo en las coordenadas que reporta Figma. Nada redondeado a una grilla de 8.',
    'features.2t': 'Inspeccionable',
    'features.2pa': 'Cada elemento lleva ',
    'features.2pb': ' y su nombre de capa. Buscá cualquier cosa en las DevTools.',
    'features.3t': 'Íconos que no vencen',
    'features.3p': 'Los SVG quedan locales en el .zip. Las URLs de assets de Figma se caen a los 7 días.',
    'features.4t': 'Índice navegable',
    'features.4p': 'Todas las pantallas en una página, con buscador, escala 1:1 y un modo "ver cajas".',

    'token.titulo': 'De dónde sale el token',
    'token.p': 'En Figma: tu avatar → {settings} → pestaña {security} → {tokens} → {generate}. Alcanza con el permiso {permiso}.',

    'no.titulo': 'Para qué NO sirve',
    'no.p': 'Lo que sale es un documento de referencia para medir, no markup para producción. Si querés código listo para pegar en tu app, usá el MCP de Figma: interpreta el diseño y te devuelve componentes. Esto hace lo contrario a propósito — te da el hecho crudo.',

    'pie.nota': 'Sin backend · sin analytics · sin cookies.',
    'pie.repo': 'Repositorio',
  },

  en: {
    'html.lang': 'en',
    'meta.title': 'Figma to HTML — export any Figma file to measurable HTML',
    'meta.description': 'Export a Figma file to HTML with every node at its exact size and position. Runs entirely in your browser: your Figma token never leaves your machine.',
    'meta.ogLocale': 'en_US',
    'meta.ogAlt': 'Measure the design. Don’t eyeball it.',

    'nav.como': 'How it works',
    'nav.privacidad': 'Privacy',
    'nav.codigo': 'Source',

    'hero.kicker': 'Open source · runs in your browser',
    'hero.titulo1': 'Measure the design.',
    'hero.titulo2': 'Don’t eyeball it.',
    'hero.bajada': 'Export any Figma file to HTML where every element sits in its exact box. Open DevTools and read the real width, height and padding — instead of guessing them.',
    'hero.sello1': 'Your token never leaves your machine',
    'hero.sello2': 'Won’t burn your Figma quota',

    'form.urlLabel': 'Figma file URL',
    'form.urlPlaceholder': 'figma.com/design/AbC123…',
    'form.tokenLabel': 'Your Figma personal access token',
    'form.tokenAyuda': 'Where do I get a token? →',
    'form.boton': 'Export to HTML',
    'form.recordar': 'Remember the token here',
    'form.elegir': 'pick screens →',
    'form.privacidad': 'This page is static HTML. The request goes straight from your browser to {api} — there is no server in between.',

    'elegir.titulo': 'Pick what to export',
    'elegir.filtro': 'Filter by name…',
    'elegir.todos': 'All',
    'elegir.ninguno': 'None',
    'elegir.desktop': 'Desktop',
    'elegir.mobile': 'Mobile',
    'elegir.boton': 'Export selected',

    'pasos.1t': 'Reads the file tree',
    'pasos.1p': 'Position, size, color and text of every node, exactly as Figma reports them.',
    'pasos.2t': 'Draws every box',
    'pasos.2p': 'Absolutely positioned, at the exact coordinates. No guessed flexbox.',
    'pasos.3t': 'Hands you a .zip',
    'pasos.3p': 'A browsable index, one file per screen, and the icons as local SVGs.',

    'cuota.titulo': 'It won’t burn your Figma quota',
    'cuota.p1a': 'The image-rendering endpoint counts its quota ',
    'cuota.p1b': 'per call, not per icon',
    'cuota.p1c': ': a free account gets about 20 a month. A single large export burns the whole thing.',
    'cuota.p2': 'This tool never touches it. It asks for the vector geometry —a different endpoint, a different budget— and builds the SVGs in your browser.',
    'cuota.espera': '↑ a 90-hour wait',
    'cuota.usa': '↑ what this tool uses',

    'features.titulo': 'What you get',
    'features.1t': 'Exact measurements',
    'features.1p': 'Every node at the coordinates Figma reports. Nothing snapped to an 8px grid.',
    'features.2t': 'Inspectable',
    'features.2pa': 'Every element carries ',
    'features.2pb': ' and its layer name. Find anything straight from DevTools.',
    'features.3t': 'Icons that don’t expire',
    'features.3p': 'The SVGs live inside the .zip. Figma’s own asset URLs die after 7 days.',
    'features.4t': 'Browsable index',
    'features.4p': 'Every screen on one page, with search, 1:1 scale and an outline mode.',

    'token.titulo': 'Where the token comes from',
    'token.p': 'In Figma: your avatar → {settings} → {security} tab → {tokens} → {generate}. The {permiso} scope is enough.',

    'no.titulo': 'What it is NOT for',
    'no.p': 'What comes out is a reference document to measure against, not production markup. If you want code to paste into your app, use the Figma MCP: it interprets the design and gives you components. This does the opposite on purpose — it gives you the raw fact.',

    'pie.nota': 'No backend · no analytics · no cookies.',
    'pie.repo': 'Repository',
  },
};

/** Palabras sueltas que van dentro de una frase (los {marcadores} de arriba). */
export const PIEZAS = {
  es: { settings: 'Settings', security: 'Security', tokens: 'Personal access tokens', generate: 'Generate new token', permiso: 'File content: Read only' },
  en: { settings: 'Settings', security: 'Security', tokens: 'Personal access tokens', generate: 'Generate new token', permiso: 'File content: Read only' },
};

/** El idioma a mostrar: lo que el visitante eligió, o lo que dice su navegador. */
export function idiomaPreferido(guardado, idiomasNavegador = []) {
  if (guardado && TEXTOS[guardado]) return guardado;
  // `navigator.languages` viene ordenado por preferencia. Español en cualquier variante
  // (es, es-AR, es-419) cae en español; todo lo demás, en inglés.
  for (const l of idiomasNavegador) {
    const base = String(l).toLowerCase().split('-')[0];
    if (TEXTOS[base]) return base;
  }
  return 'en';
}
