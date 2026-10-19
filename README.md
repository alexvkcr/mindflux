# mindflux

MindFlux es un proyecto experimental que reúne ejercicios y tecnologías orientadas a potenciar la lectura rápida, la comprensión y la memorización avanzada, inspirado en las enseñanzas y métodos de Ramón Campayo.

Los ejercicios de lectura separan el ritmo (bloques por minuto) del ancho de
referencia. Tres copias de «como» separadas por espacios ocupan 14 caracteres;
cuatro ocupan 19. La regla general es `5 × N − 1` caracteres para N palabras de
referencia. La lectura fija y la lectura por bloques en columnas conservan las
palabras completas del texto, aunque una palabra larga supere el ancho nominal.

La velocidad de referencia es `palabras de referencia × bloques/minuto`.
La velocidad del texto usa la media real de palabras por bloque de la obra
seleccionada; ambas son velocidades de presentación, no medidas de comprensión.
El nivel controla el mismo intervalo en lectura fija y en columnas. La lectura
fija dura 30 segundos y la de columnas hasta 45 segundos o el final del texto.
La pausa conserva el tiempo restante del bloque y de la sesión.

El tercer ejercicio, «Lectura guiada por páginas», abre un diálogo que ocupa toda
la pantalla y bloquea el scroll. Muestra un párrafo continuo por página, con una
negrita de alto contraste que avanza al ritmo elegido. Cada ciclo resalta palabras
completas dentro de una sola línea; una palabra larga se lee entera en su ciclo.
Cada línea tiene como máximo 1, 2 o 3 ciclos y el presupuesto de caracteres
seleccionado. Al cargar el texto y redimensionar se miden los glifos y la capacidad
del lector, desactivando combinaciones que no quepan. La altura disponible decide
las filas por página. El lector avanza automáticamente, permite Anterior, Pausa
y Siguiente y conserva la pausa al navegar. Cerrar o pulsar Escape detiene el
ejercicio y restaura el scroll. Solo se renderiza la página actual, también para
TXT grandes. Termina al acabar el texto, sin límite de 30 o 45 segundos.

Los tres ejercicios permiten cargar un TXT propio de hasta 10 MB (10 MiB), que
queda disponible al cambiar de juego durante la sesión. Se procesa en el
navegador. Se admiten UTF-8 y UTF-16 con BOM; se revisa el contenido completo con
decodificación estricta, firmas de otros formatos y detección de caracteres de
control. Los archivos vacíos, binarios o documentos de otro formato renombrados
como `.txt` se rechazan sin sustituir el texto cargado anteriormente.

Verificación del cálculo y del temporizador: `npm run test:reading`.
Pruebas visuales y de integración: [tests/browser/README.md](tests/browser/README.md).
