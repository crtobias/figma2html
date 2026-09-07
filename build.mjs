/** Genera `en/index.html` a partir de `index.html` y del diccionario de `src/i18n.js`.
 *
 * Por qué existe, en vez de traducir sólo con JavaScript: un buscador indexa lo que el servidor
 * manda. Si el inglés apareciera únicamente después de correr un script, la página competiría
 * por "figma to html" con contenido en español — que es donde está casi todo el volumen. Cada
 * idioma tiene su URL, con su <title>, su description y su hreflang.
 *
 * Uso:
 *   node build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTOS, PIEZAS } from './src/i18n.js';

const BASE = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(BASE, 'en');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rellenar = (texto, piezas) => texto.replace(/\{(\w+)\}/g, (_, k) => piezas[k] ?? `{${k}}`);

/** Reemplaza el contenido de los nodos marcados. Es una sustitución sobre el texto del archivo y
 *  no un parseo del DOM: alcanza porque el HTML lo escribimos nosotros y las marcas son únicas. */
function traducir(html, idioma) {
  const t = TEXTOS[idioma];
  let out = html;

  // Texto plano: <tag data-i18n="clave" …>lo que sea</tag>
  out = out.replace(
    /(<(\w+)([^>]*\bdata-i18n="([\w.]+)"[^>]*)>)([\s\S]*?)(<\/\2>)/g,
    (entero, apertura, tag, attrs, clave, _viejo, cierre) => (
      t[clave] != null ? `${apertura}${esc(t[clave])}${cierre}` : entero
    ),
  );

  // Placeholders
  out = out.replace(/placeholder="[^"]*"(\s+data-i18n-placeholder="([\w.]+)")/g,
    (entero, cola, clave) => (t[clave] != null ? `placeholder="${esc(t[clave])}"${cola}` : entero));

  // Párrafos con marcado adentro
  out = out.replace(/(<(\w+)([^>]*\bdata-i18n-html="([\w.]+)"[^>]*)>)([\s\S]*?)(<\/\2>)/g,
    (entero, apertura, tag, attrs, clave, _v, cierre) => (
      t[clave] != null
        ? `${apertura}${rellenar(esc(t[clave]), { api: '<code>api.figma.com</code>' })}${cierre}`
        : entero
    ));

  out = out.replace(/(<(\w+)([^>]*\bdata-i18n-token-p\b[^>]*)>)([\s\S]*?)(<\/\2>)/g,
    (entero, apertura, tag, attrs, _v, cierre) => {
      const piezas = Object.fromEntries(Object.entries(PIEZAS[idioma]).map(([k, w]) => [k, `<em>${esc(w)}</em>`]));
      return `${apertura}${rellenar(esc(t['token.p']), piezas)}${cierre}`;
    });

  // La cabecera: idioma, título, descripción y los metadatos sociales.
  out = out
    .replace(/<html lang="[^"]*">/, `<html lang="${t['html.lang']}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(t['meta.title'])}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(t['meta.description'])}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(t['meta.title'])}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(t['meta.description'])}$2`)
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${t['meta.ogLocale']}$2`)
    .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${esc(t['meta.ogAlt'])}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(t['meta.title'])}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(t['meta.description'])}$2`);

  // El JSON-LD también se traduce: es lo que lee el buscador para la ficha de resultado.
  out = out
    .replace(/("description": ")[^"]*(")/, `$1${esc(t['meta.description'])}$2`)
    .replace(/("inLanguage": ")[^"]*(")/, `$1${t['html.lang']}$2`)
    .replace(/("operatingSystem": ")[^"]*(")/, idioma === 'en' ? '$1Any device with a browser$2' : '$1Cualquiera con navegador$2');

  if (idioma === 'en') {
    out = out.replace(/("url": "https:\/\/figma2html\.online)\/"/, '$1/en/"');
    out = out
      .replace(/(<link rel="canonical" href="https:\/\/figma2html\.online)\/">/, '$1/en/">')
      .replace(/(<meta property="og:url" content="https:\/\/figma2html\.online)\/">/, '$1/en/">')
      // La página vive un nivel más abajo: los recursos se piden a la raíz.
      .replace(/(href|src)="src\//g, '$1="/src/')
      .replace(/href="src\/app\.css"/, 'href="/src/app.css"')
      .replace(/(og:image" content="https:\/\/figma2html\.online)\/og\.png/, '$1/og.png');
  }
  return out;
}

const fuente = fs.readFileSync(path.join(BASE, 'index.html'), 'utf8');
fs.mkdirSync(SALIDA, { recursive: true });
fs.writeFileSync(path.join(SALIDA, 'index.html'), traducir(fuente, 'en'));

// El sitemap lista las dos URLs, cada una declarando a la otra como alternativa.
fs.writeFileSync(path.join(BASE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://figma2html.online/</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://figma2html.online/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://figma2html.online/en/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://figma2html.online/en/"/>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://figma2html.online/en/</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://figma2html.online/"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://figma2html.online/en/"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://figma2html.online/en/"/>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`);

const en = fs.readFileSync(path.join(SALIDA, 'index.html'), 'utf8');
const sinTraducir = [...en.matchAll(/data-i18n="([\w.]+)"[^>]*>([^<]{3,})</g)]
  .filter(([, clave, txt]) => TEXTOS.en[clave] && txt.trim() !== TEXTOS.en[clave].trim());
console.log(`en/index.html · ${(en.length / 1024).toFixed(1)} KB · lang="${en.match(/<html lang="(\w+)"/)?.[1]}"`);
console.log(`nodos sin traducir: ${sinTraducir.length}`);
if (sinTraducir.length) console.log('  →', sinTraducir.slice(0, 5).map(([, k]) => k).join(', '));
console.log('sitemap.xml · 2 URLs');
