# figma2html

**Medí el diseño. No lo aproximes.**

Convierte un archivo de Figma en HTML donde cada elemento está en su caja exacta —
ancho, alto, padding y gaps reales, listos para inspeccionar con las DevTools.

Corre **entero en el navegador**: no hay backend, y tu token de Figma nunca sale de tu máquina.

## Cómo funciona

1. `GET /v1/files/:key` → el árbol del archivo: posición, tamaño, color y texto de cada nodo.
2. Cada nodo se dibuja en un `<div>` con `position: absolute` y sus coordenadas exactas.
3. Los íconos se arman **localmente** desde `GET /v1/files/:key/nodes?geometry=paths`, que
   devuelve el path data de cada vector.
4. Todo se empaqueta en un `.zip` con el índice navegable ya armado.

### Por qué no toca `/v1/images`

`/v1/images` (el endpoint que renderiza nodos a SVG) es Tier 1 y **su cuota se cuenta por
llamada, no por nodo**: un asiento View/Collab tiene ~20 llamadas *al mes*. Una sola
extracción grande la agota y Figma contesta con un `Retry-After` de 90 horas.

`?geometry=paths` es otro endpoint, con otro presupuesto, y trae las curvas. Con eso el SVG
se construye en el navegador y Figma no tiene que renderizar nada.

## Para qué NO sirve

Lo que sale es un **documento de referencia para medir**, no markup para producción.
Reconstruir flex a partir del JSON adivina intenciones y termina pareciéndose *menos* al
diseño. Si querés código listo para pegar en tu app, usá el MCP de Figma.

## Correrlo

Es un sitio estático, pero usa ES modules y un Web Worker, así que necesita servirse por HTTP
(abrirlo con `file://` no funciona):

```bash
python3 -m http.server 8000
# después, http://localhost:8000
```

Para publicarlo alcanza con subir la carpeta a GitHub Pages, Netlify, Vercel o cualquier
hosting estático. No hay nada que configurar del lado del servidor.

## Publicar tu propia copia

Editá el objeto `ENLACES` arriba de [`src/app.js`](src/app.js) con tus links. Es lo único
que hay que tocar.

## El token

En Figma: avatar → **Settings** → **Security** → **Personal access tokens** →
*Generate new token*. Alcanza con el permiso **File content: Read only**.

El token se manda en el header `X-Figma-Token` desde el navegador del usuario.
`api.figma.com` responde con `access-control-allow-origin: *`, así que el pedido va directo
sin proxy. Si marcás "recordar", queda en el `localStorage` de tu navegador y en ningún otro
lado.

## Qué hay adentro

| Archivo | Qué hace |
|---|---|
| `src/figma.js` | Cliente de la REST API: bajar el archivo, la geometría y listar frames. |
| `src/extract.js` | Un frame → un fragmento HTML medible. |
| `src/svg.js` | Los íconos, dibujados desde la geometría vectorial. |
| `src/shell.js` | El `index.html` navegable que envuelve a los fragmentos. |
| `src/worker.js` | Orquesta todo fuera del hilo de la UI. |
| `src/app.js` | La interfaz y el armado del `.zip`. |

`extract.js` y `svg.js` son un port a JavaScript de dos scripts de Python que hacían lo mismo
desde la terminal; la salida de ambos es numéricamente idéntica, verificada frame por frame
sobre un archivo real de 80 pantallas y 1472 íconos.

## Salida

```
index.html      ← el índice navegable, con buscador, escala 1:1 y modo "ver cajas"
screens/        ← un fragmento HTML por pantalla
assets/         ← los íconos como SVG locales (las URLs de Figma vencen a los 7 días)
```

Cada elemento lleva `data-node-id`, `data-name` y `data-type`.

## Licencia

MIT.
