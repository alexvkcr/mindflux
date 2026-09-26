# Cartas optimizadas para el juego

Estas 52 imágenes PNG de 500 × 700 píxeles son las únicas cartas necesarias para
el juego. Los originales de alta resolución no se incluyen en el proyecto.

Para importar nuevas cartas desde una carpeta externa, ejecuta desde la raíz
del proyecto en Windows (no es necesario para compilar ni jugar):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/resize-playing-cards.ps1 -SourceDirectory 'D:\cartas'
```

El script acepta nombres como `A-spades.png` o `ace_of_spades.png` y escribe
las versiones reducidas en esta carpeta, sustituyendo las cartas correspondientes.
No modifica la carpeta de origen. Puedes elegir otra salida con `-OutputDirectory`.
Procesa una imagen cada vez y libera sus recursos inmediatamente para limitar
el uso de RAM. No uses esta carpeta como origen: reducir repetidamente las
versiones de juego no aporta calidad.

El juego descarga y decodifica solo las cartas distintas del siguiente bloque,
con hasta cuatro cargas simultáneas. Los `ImageBitmap` se comparten entre cartas
repetidas y se liberan al terminar el bloque o detener el juego.
