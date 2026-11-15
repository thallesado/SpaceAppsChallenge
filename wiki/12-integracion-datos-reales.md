# Integración local con datos reales

Actualización del 15 de noviembre de 2026. Integra módulos de Elkin `fbe2a7b` sobre nuestra aplicación con Blender `257c287`. Son cambios locales posteriores a las auditorías; sus hallazgos históricos no describen todos los arreglos actuales.

## Decisión del producto

La última indicación del usuario incorpora Moon Trek nuevamente. Se mantiene la Luna Blender como visor 3D y se añade un mapa NASA georreferenciado para seleccionar coordenadas. Las imágenes NAC y LOLA son productos de archivo: no representan las sombras de la fecha elegida.

El usuario elige un punto del catálogo, del mapa o por coordenadas; fija fecha y duración; analiza iluminación y comunicación; compara hasta tres puntos con inicios en días consecutivos; abre una alternativa y examina su ventana simultánea. El mapa, las tarjetas de ventanas y la selección compartida permiten ese recorrido sin un tutorial obligatorio.

## Qué se reutilizó y qué se integró

| Componente | Integración actual |
| --- | --- |
| LOLA de 20 m de Elkin | Descarga, lectura y malla detallada cuando existe cobertura completa. |
| Horizonte | Rayos cercanos con DEM de 20 m hasta 5 km; rayos lejanos con 240 m. Una misma altura física del observador. Cada azimut identifica fuente y distancia del obstáculo dominante. |
| Pendientes de Elkin | API y lectura regional a 240 m, con escala explícita; no mide obstáculos del tamaño del vehículo. |
| Moon Trek de Elkin | Mapa polar con paneo, zoom, coordenadas, escala, selección y aviso de cobertura parcial. |
| Sol y Tierra de Elkin | Recursos 3D reutilizados, dirección calculada con efemérides y posibilidad de enfocar cada cuerpo. Distancia visual simbólica. |
| Validaciones de Elkin | Scripts y productos reproducibles de resolución, DEM y posiciones SPICE/INPOP. |
| NASA Horizons | Posiciones reales del Sol y Tierra, con caché y errores explícitos. |
| Comparaciones | Reutilización del intervalo de efemérides por punto; días consecutivos, ventanas concretas y separación entre incumplimiento y fallo de datos. |
| Sensibilidad espacial | Centro y cuatro vecinos a distancia configurable; rangos deterministas de métricas. No son intervalos estadísticos de confianza. |

## Correcciones de la auditoría

La energía integra las duraciones reales entre muestras, incluido el tramo final. El ranking prioriza escenarios que cumplen y devuelve ningún ganador si ninguno cumple. La caché conserva coordenadas exactas. Las solicitudes de efemérides validan cuerpos e intervalos. El origen de los vectores usa la altura DEM del observador; el relieve cosmético del GLB no determina el horizonte científico.

Las respuestas incluyen procedencia, hashes de DEM, resolución, marco, método y paso temporal. Los informes JSON conservan esos metadatos; el CSV incluye coordenadas, altura, fuente y paso. Las transiciones siguen siendo estimaciones condicionadas por muestreo y terreno.

## Comprobación reproducible

Desde `backend`, ejecutar:

```powershell
.venv/Scripts/python scripts/download_lola.py --highres
.venv/Scripts/python -m pytest -q
.venv/Scripts/python scripts/verify_live.py
.venv/Scripts/python scripts/verify_integrated.py
```

El último comando requiere la API local en el puerto 8000. Su informe queda en [VALIDACION_INTEGRACION_REAL.json](../docs/VALIDACION_INTEGRACION_REAL.json); usa datos reales y puede reutilizar la caché de Horizons. La sensibilidad de ese informe utiliza horizonte de 1 km y se identifica expresamente: no valida sensibilidad del trazado completo de 250 km.

En frontend: `npm run build`, `node tests/explorer.e2e.mjs` y `node tests/failure-cases.mjs`. El recorrido de navegador verifica comparación, mapa NASA, fuentes y anchura móvil; no sustituye una prueba de rendimiento en hardware modesto.

Resultados ejecutados: compilación correcta; navegador con ocho alternativas reales, mapa NASA cargado con cobertura parcial, sin errores JavaScript y sin desbordamiento móvil; cuatro fallos simulados mostraron estados explícitos. La integración real verificó seis alternativas adicionales, cinco muestras de sensibilidad, malla fina de 10.201 puntos y catálogo de 336 capas de Moon Trek. Un resultado de visibilidad cero se conserva como dato válido, sin sustituirlo por una ventana favorable.

## Qué falta para nuestros objetivos

1. Validar ventanas completas de luz y enlace contra una implementación independiente. SPICE/INPOP verifica posiciones, no toda la cadena de ocultación por terreno.
2. Ampliar la sensibilidad espacial a una malla de vecinos y propagar su rango a cada transición y comparación; evitar declarar ganador cuando la separación sea menor que la variabilidad.
3. Configurar vehículos y vincular batería, consumo, generación y capacidad real del enlace con la recomendación. La corrección del integrador no constituye validación de un vehículo.
4. Añadir datos de obstáculos y textura NAC local con resolución suficiente para el tamaño del alunizador. La pendiente de 240 m y el DEM de 20 m no resuelven rocas ni certifican un lugar de descenso.
5. Medir FPS, memoria y tiempos en equipos modestos; reducir el paquete inicial del visor y probar dispositivos reales.

El resultado actual sirve para explorar y comparar condiciones geométricas preliminares. No calcula trayectoria de descenso, navegación, dispersión de aterrizaje ni seguridad operacional.
