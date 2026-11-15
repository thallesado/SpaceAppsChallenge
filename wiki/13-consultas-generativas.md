# Búsquedas personalizadas con Gemini

La caja «¿Qué quieres explorar?» interpreta sitios, coordenadas, fechas y condiciones en lenguaje natural. Presenta un plan y sus supuestos antes de ejecutar. «Buscar opciones con datos NASA» utiliza el motor existente, no cifras del modelo. Se reutilizan comparación, ranking, ventanas, errores de cobertura y selección de resultados. Los puntos aparecen en el globo y, dentro del encuadre, numerados en el mapa NASA.

## Configuración

Crear o editar `backend/.env` y añadir:

```dotenv
GEMINI_API_KEY=tu_clave_personal
GEMINI_MODEL=gemini-3.1-flash-lite
```

Reiniciar el backend y recargar la página. No poner la clave en React, en variables `VITE_`, en consultas ni en Git. `.env` está ignorado. La clave se obtiene en [Google AI Studio](https://aistudio.google.com/apikey). Las APIs NASA utilizadas mantienen su configuración independiente.

El modelo es configurable. El adaptador usa [generateContent](https://ai.google.dev/api/generate-content) con [salida JSON estructurada](https://ai.google.dev/gemini-api/docs/structured-output). Solo envía a Google el texto de la consulta, la fecha de referencia, el punto actual y el catálogo regional; no envía los archivos DEM ni necesita que el navegador acceda a la clave.

## Contratos

| Ruta | Responsabilidad |
| --- | --- |
| `GET /api/v1/assistant/status` | Indica configuración, sin devolver la clave. No prueba credenciales. |
| `POST /api/v1/assistant/plan` | Interpreta texto con Gemini y valida el plan con Pydantic. No calcula visibilidad. |
| `POST /api/v1/assistant/search` | Valida y ejecuta el plan con Horizons y LOLA. Devuelve alternativas completas y puntos. No necesita llamar nuevamente a Gemini. |

Límites actuales: hasta tres coordenadas explícitas o sitios del catálogo, o exploración regional con tres o nueve candidatos nuevos. La región define centro y radio de 1–100 km; el servidor genera el centro y vecinos mediante desplazamientos geodésicos. No son coordenadas inventadas de accidentes geográficos ni sitios aprobados. Coordenadas dentro de 75–90° S; las regiones que salen de esa cobertura se rechazan.

El asistente admite hasta 31 fechas consecutivas de inicio y 14 días por escenario. Divide el cálculo en bloques compatibles con el motor existente de tres puntos y 14 días; no amplía artificialmente sus contratos. Paso científico de 60 minutos, horizonte hasta 250 km y observador a 2 m. Los criterios de orden conservan cumplimiento, ventana simultánea y fracción simultánea. `top_k` limita resultados mostrados después de evaluar todas las combinaciones; `result_mode=dates` evita repetir una fecha al solicitar mejores momentos. Los empates no establecen un ganador único.

La consulta puede especificar horas continuas, porcentajes mínimos de luz y Tierra visible, límites de oscuridad y desconexión o elevación mínima terrestre. La vista previa expone los filtros aplicados y supuestos. Para cambiar el plan se modifica el texto. Si hay una ambigüedad o una condición decisiva no soportada, se solicita precisión antes de ejecutar.

Ejemplo: «Compara Mons Mouton y Mons Malapert desde el 15 de noviembre de 2026, durante un día, probando inicios los siguientes dos días. Necesito seis horas continuas de Sol y Tierra visibles».

## Alcance y pruebas

La selección de candidatos hecha por Gemini es una interpretación que el usuario revisa, no evidencia científica ni una búsqueda exhaustiva de la Luna. La recomendación solo compara los candidatos y fechas mostrados. No optimiza trayectorias, combustible, temperatura o seguridad del descenso.

Las pruebas del backend simulan la respuesta de Gemini y verifican validación, cuota, ausencia de clave, resolución del catálogo y ejecución del motor. El navegador simula únicamente interpretación/estado de Gemini y ejecuta la búsqueda en la API local con Horizons y LOLA reales; permite caché. Comandos:

```powershell
# backend
.venv/Scripts/python -m pytest -q
# frontend
node tests/assistant.e2e.mjs
node tests/assistant.e2e.mjs --live
npm run build
```

Verificación posterior con credenciales configuradas solo en el `.env` local: **57 pruebas del backend aprobadas**, compilación correcta, cuatro fallos simulados controlados y recorrido de navegador con **Gemini autenticado y seis alternativas calculadas por Horizons/LOLA**. Se seleccionó una alternativa y se verificó su marcador en el mapa, sin errores JavaScript ni desbordamiento a 390 px. La clave no se incluye en informes ni en Git.

`backend/scripts/verify_assistant_live.py` comprobó además tres consultas reales: coordenadas explícitas con umbrales conservados en el cálculo; requisito de combustible no soportado que solicita precisión y bloquea ejecución; periodo de 90 días que solicita precisión y bloquea ejecución. Informes: [contratos reales](../docs/VALIDACION_ASISTENTE_REAL.json) y [navegador real](../docs/VALIDACION_ASISTENTE_NAVEGADOR_REAL.json). Esta muestra comprueba esos casos; no garantiza la interpretación de cualquier texto.

El modelo inicial `gemini-2.5-flash` fue rechazado por el proveedor para usuarios nuevos. La configuración comprobada usa `gemini-3.1-flash-lite`. Los errores de credenciales, cuota o respuesta incompleta no se sustituyen por interpretaciones o métricas inventadas.

## Exploración de puntos nuevos y meses completos

Prueba posterior: **59 tests aprobados** y compilación correcta. Con Gemini y NASA reales se generaron tres puntos alrededor de (-89°, 0°), a 20 km; el navegador ejecutó la búsqueda y mostró dos opciones con sus marcadores, sin errores JavaScript ni desbordamiento móvil. Además se ejecutó noviembre de 2026 completo: **90 combinaciones evaluadas, cero fallos de datos y dos fechas distintas devueltas**. Evidencia: [exploración real](../docs/VALIDACION_EXPLORACION_GENERATIVA.json) y [navegador con puntos nuevos](../docs/VALIDACION_PUNTOS_NAVEGADOR_REAL.json). El test sintético adicional verifica que un muestreo de nueve puntos cubra las 270 combinaciones del mes sin omisiones ni duplicados.

Ejemplo: «Genera tres puntos nuevos alrededor de -89, 0, a 20 km. Busca las dos mejores fechas de noviembre de 2026 para explorar la superficie, un día por escenario».

La consulta de la captura del usuario pide **poner un satélite en órbita**. Eso necesita otro motor con estado inicial, destino orbital y dinámica de trayectoria; no puede deducirse de la luz sobre la superficie. El asistente explica ese límite y puede ofrecer `alternative_query`, que solo se usa si el usuario pulsa la opción correspondiente. No selecciona Mons Mouton ni muestra supuestos de una consulta distinta cuando existe aclaración pendiente.
