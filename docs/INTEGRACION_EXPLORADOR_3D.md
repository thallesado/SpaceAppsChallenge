# Explorador lunar integrado

## Qué se reutilizó

La base local se actualizó a `506f881` de `main`. Se conservaron el motor temporal, lectura PDS LOLA, catálogo, caché SQLite, exportación y módulos existentes de ranking, energía y diagnóstico. Los adaptadores locales de Moon Trek y PGDA se incorporaron como rutas adicionales. El globo ahora carga el modelo Blender MOON_ME incluido en `frontend/public/luna/luna_cientifica.glb`; el modelo y sus texturas se sirven desde el propio frontend, sin solicitar teselas Moon Trek al abrir el visor. El estado anterior permanece en el stash `local NASA adapters before integration` y en el parche externo `../lunar-local-backend.patch`.

La interfaz anterior queda en `frontend/src/LegacyApp.tsx`. El explorador nuevo usa los contratos `/api/v1` directamente, sin depender de muestras ficticias ni del contrato legacy.

## Ejecutar en Windows

Backend, en una terminal:

```powershell
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -e '.[dev]'
.venv/Scripts/python scripts/download_lola.py
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend, en otra terminal:

```powershell
cd frontend
npm ci
./node_modules/.bin/vite.cmd --host 127.0.0.1 --port 5174
```

Interfaz: http://127.0.0.1:5174. Swagger: http://127.0.0.1:8000/docs.

No se requiere clave NASA. El cliente nuevo siempre utiliza el backend; `VITE_USE_API` solo corresponde a la interfaz anterior. El proxy de desarrollo conecta `/api` a `127.0.0.1:8000`. Para otro servidor, configurar `VITE_API_BASE_URL` y CORS.

## Uso

1. Elegir un punto del catálogo o introducir coordenadas entre 75° S y el polo. Mayús + clic sobre el globo permite seleccionar un punto; el backend verifica cobertura del relieve.
2. Definir fecha UTC, periodo, paso y requisitos. Marcar hasta tres lugares mediante las casillas del catálogo.
3. Analizar el sitio. Se consulta Horizons y se traza el horizonte LOLA hasta la distancia elegida. Los resultados indican el periodo que realmente se calculó.
4. Cambiar entre globo y terreno. Arrastrar orbita; la rueda acerca; el botón de centrar recupera el punto. La vista de terreno muestra una malla local de 50 km de lado, con alturas reales sin exageración vertical.
5. Mover o reproducir el tiempo. Las flechas ámbar/cian muestran las direcciones del Sol y la Tierra desde el observador. Los tamaños y distancias dibujados son simbólicos; los ángulos provienen de Horizons. El gráfico del horizonte representa el perfil completo de 360°.
6. Comparar lugares, con inicios en la fecha elegida y opcionalmente +3 y +7 días. Abrir una alternativa actualiza el punto y su análisis en el 3D. Solo se buscan esas combinaciones, no todas las fechas posibles.

## Fuentes y responsabilidades

| Fuente | Integración |
| --- | --- |
| Modelo Blender MOON_ME | GLB de `frontend/public/luna/luna_cientifica.glb`, con mapas de albedo, normales y roughness integrados; coordenadas del modelo compatibles con MOON_ME. |
| NASA Moon Trek / LRO WAC | Fuente cartográfica incorporada en el asset visual; el visor actual no consulta teselas WMTS durante la ejecución. Las rutas backend de capas/teselas permanecen disponibles para otros usos. |
| NASA/JPL Horizons | Azimut y elevación Sol/Tierra desde coordenadas lunares y altura del observador. |
| NASA PDS LOLA LDEM_75S_240M | Malla local y perfil de horizonte con curvatura, resolución nominal de 240 m. |
| NASA GSFC PGDA 78/90 | Descubrimiento de GeoTIFF oficiales y muestreo remoto de elevación en archivos LDEM compatibles. No sustituye silenciosamente el DEM PDS del análisis. |

El visor Three.js carga el modelo Blender MOON_ME localmente. Los puntos de catálogo y el sitio elegido se colocan sobre la superficie del GLB; Mayús + clic también permite seleccionar coordenadas personalizadas en el globo o en la malla local cuando está disponible. Las texturas y el relieve visual del modelo no son autoridad científica: el backend sigue usando Horizons y el DEM LOLA para las posiciones, métricas y perfil de horizonte. El visor no calcula sombras locales por ray tracing; los estados de visibilidad proceden del horizonte del backend y se muestran numéricamente y en la línea temporal.

## Contratos nuevos

- `GET /api/v1/status`: estado de disponibilidad del DEM y procedencia.
- `GET /api/v1/maps/layers`: catálogo Moon Trek.
- `GET /api/v1/maps/layers/{id}/capabilities`: metadatos WMTS oficiales.
- `GET /api/v1/maps/tiles/{level}/{row}/{col}`: proxy acotado al mosaico oficial, niveles 0–3; caché en memoria.
- `GET /api/v1/terrain/products/{78|90}`: catálogo PGDA.
- `GET /api/v1/terrain/elevation`: lectura puntual GeoTIFF LDEM compatible.
- `POST /api/v1/terrain/mesh`: malla local de latitud, longitud y altura para el visor. Sin DEM devuelve 503.
- `POST /api/v1/scenarios/search`: entre uno y tres sitios y hasta cuatro desplazamientos de fecha únicos dentro de 90 días. Reutiliza el motor existente y el horizonte cacheado.
- `POST /api/v1/scenarios/recommend`: comparación con condiciones homogéneas.

Las métricas existentes se ampliaron con `concurrent_windows` y `longest_concurrent_hours`. La restricción `min_concurrent_hours` se aplica sobre duración continua, no porcentaje acumulado. El orden de búsqueda es cumplimiento, mayor ventana continua y fracción simultánea. Los empates conservan el orden de entrada.

El caché de ejecución usa `backend/data/horizons_runtime.sqlite`, ignorado por Git, para no modificar la base versionada. Los errores externos son explícitos y no se reemplazan por demo.

## Trabajo paralelo UI

`frontend/src/features/insights/` pertenece a la otra IA. No se editó su contenido. Se conectaron `HorizonPanel` y `GuidePanel` desde `App.tsx`.

`ResultsPanel` ya reemplaza la tabla temporal de `App.tsx`. La entrega final distingue el cumplimiento global y muestra el requisito utilizado en la consulta. Elegir una alternativa llama a `openOption` y actualiza el visor 3D. Los tres componentes de Insights se integran sin editar su carpeta.

## Verificación

```powershell
cd backend
.venv/Scripts/python -m pytest -q
.venv/Scripts/python scripts/verify_live.py
cd ../frontend
npm run build
node tests/explorer.e2e.mjs
```

La prueba E2E requiere backend/frontend en ejecución y Chromium de Playwright. Se puede configurar `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. En Windows intenta reutilizar un Chromium ya instalado por Playwright. Si no hay ninguno, ejecutar `npx playwright install chromium`.

Evidencia de esta integración:

- 33 pruebas backend pasaron: motor existente, contratos, búsqueda entre fechas, restricciones, catálogo oficial, malla, fallos y lectura de DEM sintético.
- Compilación TypeScript/Vite correcta. Advertencia de tamaño del bundle 3D; no es error de compilación.
- Servicios reales: Horizons, WMTS, catálogos PGDA 78/90 y elevación remota; el script permite repetirlo.
- Navegador Chromium con WebGL: modelo Blender GLB local, órbita, selección de sitio y punto personalizado, terreno local, análisis real, cursor temporal, seis alternativas, elección, fuentes, guía y móvil sin desbordamiento. En la consulta usada, tres alternativas cumplieron. Esto no es una propiedad general de esos sitios.
- Capturas en `frontend/artifacts/`.

## Límites

No es certificación para alunizar ni un predictor aprendido. Son estimaciones de geometría y relieve para comparar condiciones. Falta validación científica independiente de los resultados combinados, sensibilidad a DEM de mayor resolución y evaluación de incertidumbre de coordenadas de catálogo. El modelo de disco parcial usa radios angulares aproximados heredados del motor. No incluye trayectoria de descenso, pendientes/rocas como criterios de seguridad, hardware energético ni disponibilidad real de estaciones terrestres. El muestreo puede omitir eventos breves.
