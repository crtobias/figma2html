/** El `index.html` navegable que envuelve a los fragmentos. Port de `build.py` + `shell.html`.
 *
 * No interpreta el HTML de las pantallas: sólo ordena, concatena e inyecta.
 */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function construirIndice(pantallas, { titulo, subtitulo, fuentes = [] }) {
  // Se piden a Google Fonts sólo las familias que el archivo usa de verdad.
  const familias = [...new Set([...fuentes, 'Inter'])]
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  const fuentesUrl = `https://fonts.googleapis.com/css2?${familias}&display=swap`;
  // El índice respeta el orden del archivo: es el que eligió quien diseñó, y agrupar por
  // viewport lo rompería. Como desktop y mobile se alternan, el viewport va como etiqueta en
  // cada línea en vez de como encabezado — si no, "Desktop" y "Mobile" aparecen media docena
  // de veces cada uno y dejan de significar nada.
  const lineas = pantallas.map((p) => (
    `      <a href="#${p.slug}"><span class="wf-navVp wf-navVp-${p.viewport}"></span>${esc(p.name)}</a>`
  ));

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>

<!-- Las tipografías del diseño, para que el texto mida lo mismo que en Figma. Si el archivo
     usa otras, el navegador cae en la familia que el conversor escribió por nodo. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${esc(fuentesUrl)}" rel="stylesheet">

<style>
  /* Cada nodo de Figma se dibuja en su caja exacta, posicionada dentro de la de su padre.
     No hay flex reconstruido: el JSON da coordenadas absolutas y eso es lo que se respeta. */
  .wf-frame .wf-n { position: absolute; margin: 0; }
  .wf-frame img.wf-n { display: block; }

  /* Una caja de texto de Figma tiene alto propio y el texto se alinea adentro. 'display: flex'
     en columna + el 'justify-content' que pone el conversor reproduce ese alineado vertical;
     'pre-wrap' conserva los saltos de línea que el diseñador escribió a mano. */
  .wf-frame .wf-t { display: flex; flex-direction: column; white-space: pre-wrap; }

  :root {
    --wf-bg: #1b1d1f; --wf-surface: #26292c; --wf-line: #383c40;
    --wf-text: #e8eaec; --wf-muted: #9aa1a8; --wf-accent: #e67e22;
  }
  body { margin: 0; background: var(--wf-bg); color: var(--wf-text); font: 400 14px/1.5 Inter, system-ui, sans-serif; }

  .wf-nav {
    position: fixed; inset: 0 auto 0 0; width: 260px; overflow-y: auto;
    padding: 20px 16px 40px; background: var(--wf-surface);
    border-right: 1px solid var(--wf-line); z-index: 100;
  }
  .wf-nav h1 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
  .wf-nav p  { margin: 0 0 12px; font-size: 12px; color: var(--wf-muted); }
  .wf-leyenda { display: flex; align-items: center; gap: 6px; margin-bottom: 18px !important; font-size: 11px; }
  .wf-leyenda .wf-navVp { margin-left: 6px; }
  .wf-leyenda .wf-navVp:first-child { margin-left: 0; }
  .wf-nav a {
    display: flex; align-items: baseline; gap: 8px;
    padding: 7px 10px; border-radius: 6px; color: var(--wf-muted);
    text-decoration: none; font-size: 12.5px; line-height: 1.35;
  }
  /* Un punto por viewport: dice desktop o mobile sin gastar una línea de texto por pantalla. */
  .wf-navVp { flex: none; width: 6px; height: 6px; border-radius: 50%; }
  .wf-navVp-desktop { background: #6ea8fe; }
  .wf-navVp-mobile  { background: var(--wf-accent); }
  .wf-nav a:hover { background: rgba(255,255,255,.06); color: var(--wf-text); }
  .wf-nav a.is-current { background: rgba(230,126,34,.14); color: var(--wf-accent); }

  .wf-main { margin-left: 260px; padding: 24px 32px 120px; }
  .wf-screen { margin-bottom: 56px; scroll-margin-top: 24px; }
  .wf-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
  .wf-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .wf-head span { font-size: 12px; color: var(--wf-muted); font-variant-numeric: tabular-nums; }

  /* El frame se dibuja al ancho real de Figma y se escala con 'zoom' para que entre en pantalla.
     'zoom' y no 'transform: scale()' a propósito: scale no reflowea, deja el hueco del tamaño
     original y hay que compensarlo con márgenes negativos. */
  .wf-frame {
    position: relative; background: #f8f9fa; border: 1px solid var(--wf-line);
    border-radius: 8px; overflow: hidden; transform-origin: top left; zoom: var(--wf-zoom, 1);
  }
  [data-viewport="desktop"] .wf-frame { --wf-zoom: .62; }
  [data-viewport="mobile"]  .wf-frame { --wf-zoom: 1; }
  body[data-zoom="1"] .wf-frame { --wf-zoom: 1; }

  .wf-tools { position: fixed; top: 16px; right: 20px; z-index: 110; display: flex; gap: 8px; }
  .wf-tools button {
    padding: 7px 12px; border: 1px solid var(--wf-line); border-radius: 6px;
    background: var(--wf-surface); color: var(--wf-text);
    font: 500 12px Inter, system-ui, sans-serif; cursor: pointer;
  }
  .wf-tools button:hover { border-color: var(--wf-accent); color: var(--wf-accent); }

  @media print { .wf-nav, .wf-tools { display: none; } .wf-main { margin: 0; } }
</style>
</head>
<body>

<nav class="wf-nav">
  <h1>${esc(titulo)}</h1>
  <p>${esc(subtitulo)}</p>
  <p class="wf-leyenda">
    <span class="wf-navVp wf-navVp-desktop"></span> desktop
    <span class="wf-navVp wf-navVp-mobile"></span> mobile
  </p>
${lineas.join('\n')}
</nav>

<div class="wf-tools">
  <button type="button" data-action="zoom">Escala 1:1</button>
  <button type="button" data-action="outline">Ver cajas</button>
</div>

<main class="wf-main">
${pantallas.map((p) => p.html.trim()).join('\n\n')}
</main>

<script>
  // Marca en el índice la pantalla que se está mirando. Un observer y no un listener de scroll:
  // el scroll dispara decenas de veces por segundo y acá alcanza con saber qué sección entró.
  const enlaces = new Map([...document.querySelectorAll('.wf-nav a')].map((a) => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      const enlace = enlaces.get(entrada.target.id);
      if (enlace) enlace.classList.toggle('is-current', entrada.isIntersecting);
    }
  }, { rootMargin: '-10% 0px -80% 0px' });
  document.querySelectorAll('.wf-screen').forEach((s) => observer.observe(s));

  document.querySelector('.wf-tools').addEventListener('click', (e) => {
    const accion = e.target.dataset.action;
    if (accion === 'zoom') {
      const uno = document.body.dataset.zoom === '1';
      document.body.dataset.zoom = uno ? '' : '1';
      e.target.textContent = uno ? 'Escala 1:1' : 'Ajustar a pantalla';
    }
    if (accion === 'outline') {
      // Debug rápido de layout: pinta el borde de cada nodo que vino de Figma.
      document.body.classList.toggle('wf-outline');
      const id = 'wf-outline-css';
      if (document.getElementById(id)) return document.getElementById(id).remove();
      const style = document.createElement('style');
      style.id = id;
      style.textContent = '.wf-outline .wf-frame [data-node-id] { outline: 1px solid rgba(230,126,34,.35); }';
      document.head.append(style);
    }
  });
<\/script>
</body>
</html>
`;
}
