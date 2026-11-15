# De la consulta al mapa del Explorador Lunar

El usuario indicó que una lista de coordenadas no era comprensible para visitantes comunes y pidió referencias gráficas en el mapa. Después confirmó que quería pulsar una exploración o un resultado para ir a su punto. Se integra ese recorrido sin cambiar el motor científico.

## Comportamiento actual

1. «Preparar búsqueda» interpreta la consulta y genera la propuesta. El Explorador cambia a «Mapa NASA», encuadra todos los candidatos y muestra números de referencia. Si hay región, dibuja su contorno y radio.
2. La caja de consulta muestra un resumen con iconos de puntos, fechas, Sol, Tierra y duración. Coordenadas, filtros y supuestos quedan bajo «Fechas, coordenadas y filtros», cerrado inicialmente.
3. El usuario puede pulsar los números del mapa para seleccionar un punto sin crear duplicados ni mover el encuadre. «Ver todos los puntos» restaura la vista completa después de zoom o paneo.
4. El botón «Comparar estos puntos» del mapa ejecuta exactamente el plan preparado. No vuelve a pedir a Gemini que lo interprete ni sustituye los candidatos por el catálogo.
5. Después del cálculo, los marcadores con resultado muestran cumplimiento o incumplimiento de filtros; la ficha usa iconos para luz, Tierra y ventana continua. Los candidatos sin detalle entre los resultados mostrados permanecen diferenciados, sin inventar métricas ni calificarlos como fallidos.
6. Pulsar una alternativa de comparación o una ventana disponible abre el mapa, centra su coordenada y la resalta. El punto propuesto también puede abrirse desde su botón dentro del detalle técnico. La navegación respeta la fecha y el resultado de la alternativa elegida.

Los números corresponden a los candidatos de esa consulta y se reutilizan en las alternativas. No representan identificadores NASA ni lugares aprobados. Un punto personalizado fuera del conjunto se distingue de los candidatos incluidos en el plan.

## Qué procede de NASA

- **Propuesta:** Gemini interpreta texto y filtros. Los puntos nuevos se generan por desplazamiento geodésico alrededor de un centro; aún no son recomendaciones calculadas.
- **Cálculo:** al comparar, JPL Horizons proporciona posiciones y LOLA proporciona terreno/horizonte. El motor calcula métricas, ventanas y cumplimiento; puede reutilizar efemérides NASA de la caché.
- **Imagen del mapa:** teselas de archivo Moon Trek NAC/LOLA, con cobertura indicada. No muestran las sombras de la fecha del análisis. La geometría de área y puntos usa coordenadas reales incluso donde la imagen no cubre la vista.

Esta separación responde a la pregunta del usuario sobre datos reales: la vista previa organiza la búsqueda; la evaluación posterior produce resultados con NASA. La posición generada y el color del marcador no certifican seguridad de alunizaje.

## Arquitectura del cambio

| Archivo | Responsabilidad |
| --- | --- |
| `frontend/src/AssistantSearch.tsx` | Vista previa visual, detalle desplegable, puntos enlazables y acción de cálculo reutilizable desde el mapa. |
| `frontend/src/App.tsx` | Comparte candidatos/región, coordina selección, desplazamiento al Explorador, apertura de resultados y peticiones de centrado. |
| `frontend/src/SurfaceMap.tsx` | Mapa interactivo, contorno, marcadores, leyenda, ficha y comparación. Seleccionar un marcador mantiene la vista; navegar desde un resultado centra su ubicación. |
| `frontend/src/queryMapGeometry.ts` | Contorno geodésico de la región sobre radio lunar de 1.737.400 m y encuadre de puntos/área en la proyección polar existente. |
| `frontend/src/query-map.css` | Estados visuales, selección, foco de teclado y distribución móvil. |
| `frontend/tests/query-map.e2e.mjs` | Recorrido real de nueve candidatos, cálculo y navegación desde propuesta/resultados. |

No se cambian contratos del backend ni algoritmos de iluminación/ranking. No se reescriben componentes Insights del colaborador. El conjunto de comparación manual conserva su límite de tres puntos; la búsqueda del asistente sigue evaluando su conjunto completo.

## Evidencia

Compilación correcta. Se ejecutó `node tests/query-map.e2e.mjs` con Gemini autenticado y motor NASA real, permitiendo caché: nueve puntos nuevos, radio 20 km, nueve evaluados y nueve opciones devueltas, sin fallos de datos.

El navegador comprobó encuadre completo, detalle técnico inicialmente cerrado, selección sin duplicar puntos ni mover la vista, botón de comparación del mapa, pulsación de propuesta y resultado con centrado y desplazamiento al mapa, teclado y móvil de 390 px sin desbordamiento ni errores JS. [Informe](../docs/VALIDACION_CONSULTA_EN_MAPA.json). También pasó el recorrido existente de generación de tres candidatos/dos alternativas. Las capturas están en `frontend/artifacts/`, local y excluido de Git.

No se atribuye a esta prueba una validación científica nueva ni una garantía de cobertura fotográfica en cualquier región. Continúan los límites del DEM, muestreo temporal, búsqueda regional y ventanas descritos en el estado vigente.
