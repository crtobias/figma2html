/** La misma pantalla, como componente de React con SCSS.
 *
 * Sale de la misma `describir()` que el HTML, no de reescribir el HTML ya emitido: si una
 * salida se generara traduciendo la otra, cualquier arreglo tendría que acordarse de las dos, y
 * el día que no se acuerde dejarían de coincidir sin que nadie se entere.
 *
 * Los estilos van a SCSS y no a `style={{}}` en el JSX por una razón práctica: el atributo
 * inline no se puede pisar desde una hoja de estilos sin `!important`, así que un componente con
 * todo inline es exacto pero imposible de retocar. Con una clase por nodo, quien recibe esto
 * abre el .scss y cambia lo que necesite.
 */

/** `desk-vendedor-panel-de-comercio` → `VendedorPanelDeComercio`.
 *
 * `usados` es obligatorio y no un adorno: el prefijo del viewport se descarta para que el
 * nombre se lea bien, y sin desambiguar, la versión mobile y la desktop de una misma pantalla
 * caen en el mismo nombre y una pisa a la otra al escribir el archivo. Pasó exactamente eso con
 * "Punto de venta / Nueva venta", y el síntoma fue un componente que renderizaba otra pantalla.
 */
export function nombreComponente(slug, usados) {
  const limpio = slug.replace(/^(desk|mob)-/, '');
  const camel = limpio.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  // Un componente no puede empezar con un dígito, y React exige mayúscula inicial.
  let nombre = /^[A-Za-z]/.test(camel) ? camel : `Pantalla${camel}`;

  if (!usados) return nombre;
  if (usados.has(nombre)) {
    // Primero se intenta con el viewport, que es lo que suele distinguirlas y se lee natural.
    nombre += slug.startsWith('mob-') ? 'Mobile' : 'Desktop';
    const conViewport = nombre;
    let n = 2;
    while (usados.has(nombre)) nombre = `${conViewport}${n++}`;
  }
  usados.add(nombre);
  return nombre;
}

const escJsx = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/** El texto de un nodo va dentro de `{'…'}`: así las llaves, los saltos y los signos que JSX
 *  interpreta viajan como texto literal y no como marcado. */
const literal = (s) => `{${JSON.stringify(String(s ?? ''))}}`;

/** Una clase por nodo, estable y legible: `n-43-2590`. El id de Figma ya es único. */
const claseDe = (id) => `n-${id.replaceAll(':', '-').replaceAll(';', '_')}`;

/** Recorre la descripción y junta, por un lado el árbol JSX, por el otro las reglas SCSS. */
function recorrer(d, reglas, nivel) {
  const sangria = '  '.repeat(nivel);
  const clase = claseDe(d.id);
  const attrs = `className="wf-n ${clase}${d.forma === 'texto' ? ' wf-t' : ''}"`
    + ` data-node-id="${d.id}" data-name={${JSON.stringify(d.nombre)}} data-type="${d.tipo}"`;

  reglas.push({ clase, css: d.css });

  if (d.forma === 'img') {
    return `${sangria}<img ${attrs} src={\`\${assets}/${d.archivo.replace('assets/', '')}\`} alt={${JSON.stringify(d.nombre)}} />\n`;
  }
  if (d.forma === 'texto') {
    return `${sangria}<div ${attrs}>${literal(d.texto)}</div>\n`;
  }
  if (!d.hijos.length) return `${sangria}<div ${attrs} />\n`;
  const hijos = d.hijos.map((k) => recorrer(k, reglas, nivel + 1)).join('');
  return `${sangria}<div ${attrs}>\n${hijos}${sangria}</div>\n`;
}

/** Un frame descrito → `{ jsx, scss, componente }`. */
export function componenteDeFrame({ nombre, slug, nodeId, ancho, alto, fondo, hijos, usados }) {
  const componente = nombreComponente(slug, usados);
  const reglas = [];
  const cuerpo = hijos.map((d) => recorrer(d, reglas, 4)).join('');

  const jsx = `// ${nombre}
// Generado por figma2html.online — https://github.com/crtobias/figma2html
//
// Cada caja está en la posición y el tamaño exactos que reporta Figma. Los estilos viven en el
// .scss de al lado, con una clase por nodo, para que se puedan retocar sin pelear con estilos
// inline. \`assets\` es la ruta donde estén los SVG (por defecto, la carpeta assets/ del export).

import './${componente}.scss';

export default function ${componente}({ assets = '/assets' }) {
  return (
    <section className="wf-screen" id="${slug}" data-node-id="${nodeId}" data-viewport="${ancho <= 500 ? 'mobile' : 'desktop'}">
      <div className="wf-frame ${componente}">
${cuerpo}      </div>
    </section>
  );
}
`;

  // El SCSS anida bajo la clase del componente: así dos pantallas del mismo export no se pisan
  // aunque compartan un nodo con el mismo id (pasa con las instancias de un componente).
  const cuerpoScss = reglas.map(({ clase, css }) => (
    `  .${clase} {\n${css.map((r) => `    ${r};`).join('\n')}\n  }`
  )).join('\n\n');

  const scss = `// ${nombre}
// Generado por figma2html.online

@use 'base';

.${componente} {
  width: ${ancho}px;
  height: ${alto}px;
  background: ${fondo};

${cuerpoScss}
}
`;

  return { componente, jsx, scss };
}

/** Las reglas compartidas por todas las pantallas. Son las mismas que usa el índice HTML. */
export const BASE_SCSS = `// Reglas compartidas por todas las pantallas exportadas.
// Generado por figma2html.online

// Cada nodo de Figma se dibuja en su caja exacta, posicionada dentro de la de su padre.
// No hay flex reconstruido: el JSON da coordenadas absolutas y eso es lo que se respeta.
.wf-n {
  position: absolute;
  margin: 0;
}

img.wf-n {
  display: block;
}

// Una caja de texto de Figma tiene alto propio y el texto se alinea adentro. \`display: flex\`
// en columna + el \`justify-content\` que pone el conversor reproduce ese alineado vertical;
// \`pre-wrap\` conserva los saltos de línea que escribió quien diseñó.
.wf-t {
  display: flex;
  flex-direction: column;
  white-space: pre-wrap;
}

.wf-frame {
  position: relative;
  overflow: hidden;
}
`;

export const LEEME_JSX = `# Pantallas en React

Cada pantalla es un componente con su hoja \`.scss\` al lado. Salen de la misma descripción de
nodos que el HTML de la carpeta de arriba, así que miden exactamente lo mismo.

## Usarlos

\`\`\`jsx
import PanelDeComercio from './screens/PanelDeComercio.jsx';

<PanelDeComercio assets="/assets" />
\`\`\`

La prop \`assets\` es la ruta donde estén los SVG. Copiá la carpeta \`assets/\` del export a donde
tu proyecto sirva estáticos (en Vite, \`public/\`) y pasá esa ruta.

## Qué necesitás

- Un proyecto con React y soporte de SCSS. En Vite alcanza con \`npm i -D sass\`.
- Nada más: no hay dependencias en tiempo de ejecución.

## Cómo están hechos

Posición absoluta, con las coordenadas exactas de Figma — no auto-layout reconstruido.
Reconstruir flex a partir del JSON adivina intenciones y termina pareciéndose menos al diseño.
Sirve para medir y para arrancar una pantalla; no es markup listo para producción.

Los estilos van en el \`.scss\` y no en \`style={{}}\` a propósito: un estilo inline no se puede
pisar desde una hoja sin \`!important\`, así que sería exacto pero imposible de retocar.
`;
