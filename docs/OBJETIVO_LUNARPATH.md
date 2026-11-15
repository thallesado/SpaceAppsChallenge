# Objetivo del proyecto: LunarPath AI

## Problema y propuesta

Las misiones al polo sur lunar necesitan comparar rápidamente sitios y fechas bajo restricciones de iluminación, energía y comunicación directa con la Tierra. LunarPath AI será una aplicación web que permita configurar una misión, explorar regiones lunares, analizar escenarios con datos científicos y entender visualmente por qué un sitio o una fecha resulta más conveniente.

La experiencia combinará la propuesta educativa y de exploración 3D del equipo con el motor científico que ya existe en este repositorio. El recorrido principal será:

1. Definir fecha, duración y requisitos de la misión.
2. Explorar la Luna y seleccionar dos o tres sitios o coordenadas.
3. Calcular Sol, Tierra y horizonte local para cada escenario.
4. Comparar ventanas de iluminación y comunicación, energía estimada y restricciones.
5. Mostrar las condiciones en una vista de superficie sincronizada con la línea temporal.
6. Explicar los resultados y exportarlos con fuente, resolución y limitaciones.

## Fuentes y funciones

| Recurso | Función | Estado |
| --- | --- | --- |
| JPL Horizons | Efemérides topocéntricas del Sol y la Tierra | Integrado en FastAPI |
| NASA PDS LOLA | Elevación y perfil topográfico del horizonte | DEM de 240 m/píxel integrado para análisis regional |
| NASA Moon Trek | Cartografía georreferenciada y capas polares | La cartografía está incorporada en el asset visual; el visor ya no consulta teselas en ejecución |
| Blender | Luna y escenas 3D para exploración y explicación | GLB MOON_ME integrado en el visor; no es fuente de elevación científica |

Horizons, LOLA y Moon Trek son recursos diferentes. El modelo de Blender es una representación visual. Los cálculos de visibilidad deben continuar usando efemérides y topografía georreferenciada.

## Estado comprobado en el repositorio

- Backend FastAPI con contratos Pydantic, consulta a Horizons, caché SQLite, catálogo de sitios, horizonte LOLA, línea temporal, comparación, ranking, Mission Delta, energía preliminar, exportación CSV y explicaciones basadas en reglas.
- Frontend React/TypeScript con explorador conectado a `/api/v1`, selección por coordenadas, vista de terreno LOLA y modelo Blender MOON_ME integrado. La geometría del GLB es solo visual; los cálculos usan Horizons y topografía del backend.
- Los resultados científicos actuales son estimaciones para planificación y educación. La visibilidad directa de la Tierra no certifica un enlace de radio, y la simulación eléctrica no certifica el sistema de energía.

## Contrato del producto

- Una fuente de verdad temporal: intervalos `[inicio, fin)` determinan línea temporal, métricas, restricciones, ranking y exportación.
- Cada resultado declara sitio, fechas UTC, fuente de efemérides, fuente y resolución del relieve, paso temporal y rango de incertidumbre de los cambios.
- Se distinguen estados visibles y bloqueados. Si falta información necesaria, el estado debe ser desconocido y no contarse como visible ni como bloqueado.
- La interfaz identifica claramente los datos reales y los datos de demostración.
- Las coordenadas de regiones candidatas no se presentan como puntos de aterrizaje aprobados.
- El visor 3D recibe coordenadas, hora, orientación y resultados desde la API; su geometría no altera el resultado científico.

## Entrega prioritaria

**Demostración vertical:** seleccionar una región en el explorador, elegir fecha y duración, consultar FastAPI, visualizar Sol y Tierra respecto al horizonte, comparar al menos dos escenarios y explicar la recomendación. La exportación debe conservar fuentes y límites del análisis.

### Orden de implementación

1. **Coherencia temporal y validación científica.** La exploración densa del periodo y los intervalos compartidos ya están implementados. Falta cuantificar la sensibilidad a pasos inferiores al elegido, contrastar más casos de referencia de Horizons y medir el efecto de la resolución del DEM.
2. **Integración frontend–backend.** Unificar los contratos de escenario, sitio, muestras, métricas y errores; probar el recorrido sin depender de datos inventados.
3. **Cartografía Moon Trek.** El modelo visual Blender con cartografía integrada ya reemplaza las teselas WMTS en el visor. Mantener la atribución y validar la procedencia/resolución de los mapas integrados; la selección de coordenadas usa el GLB y el DEM del backend.
4. **Visualización Blender.** GLB integrado y sincronizado con selección de sitio y tiempo; revisar carga/performance del modelo y conservar la distinción entre relieve visual y fuente científica del análisis.
5. **Evaluación de misión y presentación.** Reglas explicables de energía y comunicación, comparación de alternativas, narrativa de demostración y exportación verificable.

### Criterios de aceptación de la demostración

- Dos sitios y una fecha producen resultados reales de Horizons y una comparación reproducible.
- Los valores de la línea temporal y las métricas coinciden con los mismos intervalos.
- El usuario puede ver cuándo y por qué un relieve bloquea el Sol o la Tierra.
- La vista 3D se sincroniza con los datos calculados y se identifica como visualización.
- Los errores de red, cobertura del DEM y datos ausentes se muestran sin convertirlos en resultados favorables.
- La presentación distingue precisión regional, aproximaciones de energía y trabajo futuro.

## Referencias de planificación

- Conversación del proyecto: [Propuesta LunarPath AI](https://chatgpt.com/c/6af8b4ab-2efc-83e9-8927-079608dc712f).
- Síntesis aportada por el equipo: `Texto colado.txt` adjunto a la conversación de trabajo.
- Documentación técnica local: [`backend/README.md`](../backend/README.md).
