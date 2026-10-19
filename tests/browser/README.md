# Hi-Lo: comprobación de carga y reproducción en Chrome

`hi-lo-mobile.mjs` usa Playwright y Chrome con ventana móvil de 390 × 844,
densidad 2×, caché vacía, límite de red y CPU ralentizada. No sustituye una prueba
en un teléfono físico.

Ejecutar contra la compilación de producción: el modo de desarrollo de React
ejecuta dos veces los efectos iniciales y duplica el primer dibujo instrumentado.

```powershell
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5188 --strictPort
```

En otro terminal, con Playwright disponible (puede instalarse fuera del proyecto):

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/ruta/node_modules/playwright/index.mjs'
$env:CHROME_PATH = 'C:/ruta/chrome.exe'
node tests/browser/hi-lo-mobile.mjs
```

Opcional: `TEST_URL` cambia la URL por defecto `http://127.0.0.1:5188/mindflux/`.
Sin `CHROME_PATH` se utiliza el Chromium instalado por Playwright.

Para Mesa Hi-Lo, con el mismo servidor y variables:

```powershell
node tests/browser/hi-lo-table.mjs
```

Comprueba controles editables, jugadores, mesas simultáneas de 40 cartas, tiempos,
cuenta acumulada, las tres respuestas, red lenta, reintentos, parada y liberación
de memoria. `SCREENSHOT_PATH` permite guardar una captura de la mesa móvil.
Ejecuta los scripts uno después de otro para limitar el consumo de RAM.

La prueba verifica bloques de 5 y 50, continuidad del conteo, tiempos entre
presentaciones, ausencia de solicitudes durante la exposición, presupuesto y
liberación de bitmaps, reinicio con caché, reintento de errores y cancelación.
Los bytes medidos corresponden a píxeles de los bitmaps vivos, no a la memoria
total del proceso de Chrome ni de la GPU.

Pruebas unitarias sin navegador:

```powershell
node --experimental-strip-types --test tests/*.test.mjs
```

Para Tabla Schulte y Tablas Schulte continuas, con el mismo servidor de producción
y `PLAYWRIGHT_MODULE` / `CHROME_PATH`:

```powershell
node tests/browser/schulte.mjs
```

Comprueba el diálogo a pantalla completa, el bloqueo del scroll, la cancelación
con la cruceta y Escape, la restauración de posición y foco, las cuentas atrás de
3 segundos, los resultados independientes y sus medias, las cinco cuadrículas
en horizontal, las respuestas con teclado y una sesión completa de 15 tableros.
Usa el reloj virtual de Playwright para las cuentas atrás. `SCREENSHOT_PREFIX`
permite guardar capturas en vertical y horizontal.

Para lectura fija y lectura en columnas:

```powershell
npm run test:reading
node --experimental-strip-types tests/browser/reading.mjs
```

El navegador comprueba que haya un único conjunto de controles, que el ritmo no
cambie al ampliar el bloque y que las velocidades se calculen según el ancho de
referencia y el texto. Verifica el orden de los bloques, la pausa sin pérdida de
exposición, los límites de 30 y 45 segundos, el reinicio y la limpieza al salir.
Comprueba las tres obras y los cinco anchos en ventanas de 1280 × 900, 320 × 640
y 667 × 375, incluyendo recortes, desbordamiento horizontal y tamaño de fuente.
`SCREENSHOT_PREFIX` guarda capturas de ambos ejercicios en escritorio y móvil.

Para «Lectura guiada por páginas», con el mismo servidor y las mismas
variables de entorno de Playwright:

```powershell
node --experimental-strip-types tests/browser/guided-reading.mjs
```

Comprueba las tres obras y todas las combinaciones habilitadas de ancho y ciclos
por línea en escritorio, móvil y horizontal. Verifica pantalla completa, ausencia
de scroll, límites físicos y de caracteres, una sola línea por ciclo, palabras
completas y resaltado de alto contraste. Recorre automáticamente todas las páginas
y comprueba la cobertura exacta del texto, Anterior y Siguiente, pausa y tiempo de
exposición al navegar. Redimensiona con la lectura pausada para verificar el ajuste
de opciones y conservación de la posición. Cerrar y Escape restauran el scroll y
cancelan el temporizador. `SCREENSHOT_PREFIX` guarda una captura del lector móvil.

Para la carga de TXT en los tres ejercicios:

```powershell
node --experimental-strip-types tests/browser/reading-upload.mjs
```

Comprueba la conservación del archivo al cambiar de ejercicio, UTF-8 y UTF-16,
el texto mostrado como letras aunque contenga etiquetas, los controles durante
la ejecución y el rechazo de archivos vacíos, extensiones incorrectas, binarios
renombrados, codificación inválida y controles después de un prefijo de texto.
Carga un archivo de exactamente 10 MiB en los tres juegos y verifica el avance,
la paginación de la lectura guiada, el exceso de tamaño y la eliminación del TXT.
