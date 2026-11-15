# Evolución del proyecto

[Índice](README.md) · [Síntesis de conversación](fuentes/conversacion.md)

Los cinco commits encontrados pertenecen al 14 de noviembre de 2026 según sus fechas de autor, con offsets diferentes. Se mantiene **el orden de ascendencia Git**, no se ordena la historia por relojes de distintas máquinas. Los pasos de conversación anteriores a un commit no tienen una hora exacta verificable en este registro.

| Commit | Cambio observado | Relación con lo conversado |
| --- | --- | --- |
| [`9e70dfb`](https://github.com/thallesado/SpaceAppsChallenge/commit/9e70dfb) | Frontend React/Vite, demo, backend FastAPI y cliente Horizons inicial. | Se decidió reutilizar esta base en lugar de empezar otro proyecto. Había contratos frontend/backend diferentes y comparación demo. |
| [`30ead17`](https://github.com/thallesado/SpaceAppsChallenge/commit/30ead17) | Horizonte LOLA, línea temporal/refinamiento, caché SQLite, catálogo, ranking, delta, energía, diagnóstico y adaptador frontend. | El equipo amplió el motor mientras se desarrollaban integraciones locales. Se revisó antes de fusionar. |
| [`506f881`](https://github.com/thallesado/SpaceAppsChallenge/commit/506f881) | Distancia predeterminada de horizonte aumentada a 250 km, con límites hasta 300 km. | Se integró como parte del main más reciente; no es validación multirresolución. |
| [`41efb24`](https://github.com/thallesado/SpaceAppsChallenge/commit/41efb24) | Integra APIs NASA, búsqueda de fechas, malla local, Three.js con teselas Moon Trek, componentes Insights y pruebas. | Materializa el explorador propuesto, combina trabajo local/remoto y el reparto 70/30. Se publicó en el nuevo repositorio solicitado. |
| [`257c287`](https://github.com/thallesado/SpaceAppsChallenge/commit/257c287) | Sustituye globo/textura en ejecución por GLB Blender; cambia raycasting, anclajes y documentación. | Es la entrega posterior de colegas y el corte de esta auditoría. Los adaptadores WMTS permanecen, pero el globo ya no los consume. |

## Decisiones tomadas en la conversación

1. **Investigar primero.** El usuario pidió conocer el reto y los datos disponibles antes de diseñar el producto.
2. **Dos o tres recursos NASA con una función real.** Se eligieron Horizons, Moon Trek y LOLA/PGDA; se aclaró que instrumento, misión y archivos no son APIs independientes.
3. **Utilidad comprensible.** Se definió comparar oportunidades bajo requisitos para usuarios nuevos, no mostrar únicamente datos científicos sueltos.
4. **Recomendaciones explicables.** Se prefirieron filtros, ventanas y reglas antes de aprendizaje automático.
5. **Varias pantallas/vistas.** La primera imagen era una referencia ficticia de una pantalla; después se propuso inicio, configuración, exploración, comparación y detalle. No confundir esa propuesta con cinco rutas implementadas: hoy la navegación principal usa pestañas y paneles.
6. **Reutilizar código existente.** Se clonó el repositorio de ELkin2624 y se comparó el backend local con main antes de integrarlo.
7. **Tres dimensiones con datos reales.** Se construyó un visor propio alimentado inicialmente por Moon Trek y por la malla LOLA; no se incrustó todo el portal NASA.
8. **Trabajo paralelo por propiedad de archivos.** Insights quedó aislado para la otra IA; backend/visor/integración quedaron en la línea principal. Se incorporó su entrega sin reescribir sus componentes.
9. **Publicar y continuar en otro repositorio.** El usuario autorizó subir a `thallesado/SpaceAppsChallenge`. `spaceapps` es ese remoto; `origin` conserva el de ELkin2624. No asumir que `origin/main` es ahora el destino principal.
10. **Auditar antes de ampliar.** El plan recibido añade multirresolución/incertidumbre. Esta wiki verifica su base antes de convertirlo en tareas implementadas.

## Qué no está demostrado por el historial

No aparece un commit que instale un DEM operativo de 20 m, una malla específica hasta 87,5° S, un informe con diferencia de 11,12° en de Gerlache ni JSON científicos asociados. El GLB no contiene una ficha de procedencia científica suficiente para deducir esos productos. Es posible que esos cambios estén en otra rama/equipo; hace falta el commit y los archivos concretos.

Los resultados históricos de pruebas y navegador se conservan en documentos anteriores como evidencia de su momento. La verificación de esta auditoría se registra por separado para evitar trasladar automáticamente garantías entre commits.
