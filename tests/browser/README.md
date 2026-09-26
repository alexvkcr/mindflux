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

La prueba verifica bloques de 5 y 50, continuidad del conteo, tiempos entre
presentaciones, ausencia de solicitudes durante la exposición, presupuesto y
liberación de bitmaps, reinicio con caché, reintento de errores y cancelación.
Los bytes medidos corresponden a píxeles de los bitmaps vivos, no a la memoria
total del proceso de Chrome ni de la GPU.

Pruebas unitarias sin navegador:

```powershell
node --experimental-strip-types --test tests/*.test.mjs
```
