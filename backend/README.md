# LunarPath AI backend

> La integración actual añade Moon Trek, PGDA, malla 3D y búsqueda de fechas sobre este motor. Consulta [INTEGRACION_EXPLORADOR_3D.md](../docs/INTEGRACION_EXPLORADOR_3D.md) para contratos, arranque y verificación actualizados. El caché de ejecución predeterminado es `data/horizons_runtime.sqlite`.

API inicial para comparar iluminación solar y visibilidad directa de la Tierra desde puntos de la Luna. Consulta **JPL Horizons** en tiempo real y devuelve series temporales, ventanas y métricas. Puede calcular un horizonte topográfico con el DEM LOLA instalado. Sin `use_dem_horizon` ni `horizon_profile`, usa el plano geométrico de 0°. Una curva suministrada por el cliente se interpola circularmente, pero la API no certifica su procedencia ni su datum.

## Python y arranque

Se recomienda **Python 3.12** para el desarrollo local. Python 3.14 también puede ejecutar esta base, pero 3.12 reduce el riesgo de incompatibilidades al añadir otras dependencias científicas. La restricción declarada en `pyproject.toml` admite 3.12–3.14; `.python-version` fija la recomendación local.

En PowerShell, desde `backend`:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -e '.[dev]'
.venv\Scripts\python scripts/download_lola.py
.venv\Scripts\python -m uvicorn app.main:app --reload
```

API en `http://127.0.0.1:8000`; documentación interactiva en `/docs`. Se requiere conexión a JPL Horizons para evaluar escenarios. `GET /health` solo comprueba que el proceso responde. La descarga de LOLA es pública y **no requiere API key**.

El backend lee automáticamente `backend/.env` si existe. Puedes copiar `.env.example`. `LUNARPATH_DEM_PATH` permite usar otra ubicación del mismo producto; `LUNARPATH_CORS_ORIGINS` define una lista de orígenes del frontend separada por comas. Ninguna clave de NASA va en `.env` para este módulo.

## Endpoints

### 1. Exploración y Catálogo de Sitios
- `GET /api/v1/sites` o `GET /api/v1/catalog/sites`: lista de regiones y sitios candidatos oficiales de NASA Artemis III (Mons Mouton, Malapert Massif, Haworth, de Gerlache, Shackleton, Nobile, etc.) con metadatos científicos y coordenadas. Filtros opcionales: `artemis_only=true`, `query="malapert"`.
- `GET /api/v1/sites/{site_id}`: detalles, elevación estimada y justificación científica de un sitio.
- `GET /api/v1/sites/{site_id}/horizon`: cálculo del perfil topográfico 360° para un sitio del catálogo con DEM LOLA.

### 2. Efemérides Astronómicas (JPL Horizons)
- `POST /api/v1/ephemeris`: consulta directa y cacheada de series temporales de azimut y elevación del Sol (10) y la Tierra (399).
- `GET /api/v1/cache/stats`: estado del caché persistente SQLite (número de efemérides almacenadas).
- `POST /api/v1/cache/clear`: purga de entradas cacheadas.

### 3. Evaluación de Escenarios y Terreno (LOLA)
- `POST /api/v1/scenarios/evaluate`: evaluación completa para un sitio y rango temporal (Sol, Tierra, horizonte, métricas y timeline).
- `POST /api/v1/scenarios/compare`: evaluación paralela de 2 a 5 escenarios.
- `POST /api/v1/scenarios/rank`: comparador avanzado con sistema de puntuación ponderada (0–100), ranking, fortalezas (highlights) y compromisos (trade-offs).
- `POST /api/v1/terrain/horizon`: perfil de horizonte LOLA a medida para cualquier coordenada polar.

### 4. Mission Delta (Diferenciador Clave)
- `POST /api/v1/scenarios/delta`: analiza el impacto operativo de reprogramaciones de misión (retraso en días/horas) o desplazamientos espaciales del alunizaje (distancia en metros y rumbo en azimut), calculando variaciones en iluminación, comunicación, noches máximas y nivel de riesgo ("LOW", "MODERATE", "CRITICAL").

### 5. Simulación de Energía y Batería
- `POST /api/v1/simulation/power`: simulador de balance energético para rovers/landers en el polo sur. Evalúa irradiancia solar incidente sobre paneles verticales o con seguimiento, consumo continuo de carga vital (Watts) y curva de estado de carga (SoC %) de la batería, determinando si el sistema sobrevive a las ventanas de sombra.

### 6. Copiloto IA de Misión
- `POST /api/v1/copilot/explain`: análisis diagnóstico detallado de un escenario evaluado, respondiendo preguntas en lenguaje natural basadas estrictamente en los datos calculados (sin alucinaciones).
- `POST /api/v1/copilot/parse-constraints`: traductor de instrucciones en lenguaje natural a restricciones estructuradas de misión (`Constraints`).

### 7. Exportación y Compatibilidad con Frontend
- `POST /api/v1/scenarios/export/csv`: exporta las series temporales completas a un archivo CSV descargable para análisis en Excel, MATLAB o Python.
- `POST /api/scenarios/analyze`: endpoint adaptador retrocompatible con el frontend React de LunarPath (`frontend/src/api.ts`).


Cada resultado de escenario incluye `timeline`: segmentos continuos con estados de Sol y Tierra, eventos donde cambia la visibilidad y la próxima aparición u ocultación detectada de cada cuerpo. Si no hay un evento dentro del rango, su campo `next_*` es `null`. Los periodos de oscuridad y pérdida de comunicación en `metrics` se calculan a partir de esos mismos segmentos, por lo que ambos apartados son consistentes.

Para buscar también eventos que comienzan y terminan entre dos muestras horarias, añade `"refine_transitions": true` y opcionalmente `"refinement_step_minutes": 5`. El backend consulta a Horizons a esa resolución **en todo el periodo**, no solo cerca de cambios ya conocidos. Se limita a 5000 muestras por cuerpo; si el rango excede ese límite, devuelve 422 y permite aumentar el paso o reducir el periodo. Cada evento devuelve `bracket_start_utc`, `bracket_end_utc`, `estimated_time_utc` (punto medio del intervalo) y `method`. Los segmentos y métricas usan esos tiempos estimados. Eventos más breves que el paso elegido aún pueden quedar sin detectar.

Ejemplo:

```json
{
  "site": {"latitude_deg": -89.5, "longitude_deg": 0, "height_km": 0, "label": "Punto de ejemplo"},
  "start_utc": "2026-11-15T00:00:00Z",
  "end_utc": "2026-11-16T00:00:00Z",
  "step_minutes": 60,
  "use_dem_horizon": true,
  "observer_height_m": 2,
  "max_horizon_distance_km": 250,
  "constraints": {
    "min_sunlit_fraction": 0.5,
    "min_earth_visible_fraction": 0.5,
    "max_darkness_hours": 12,
    "max_earth_blackout_hours": 12,
    "min_earth_elevation_deg": 0
  }
}
```

Si `use_dem_horizon` es verdadero, la altura del observador enviada a Horizons se calcula con el DEM LOLA más `observer_height_m`; el resultado incluye `site_height_km_used`. En otro caso se usa `site.height_km` tal como se envió. Las coordenadas del ejemplo no representan un sitio aprobado para aterrizar.

El campo opcional `horizon_profile` recibe puntos ordenados por azimut, por ejemplo `[{"azimuth_deg":0,"elevation_deg":2},{"azimuth_deg":180,"elevation_deg":4}]`. No puede combinarse con `use_dem_horizon`. La visibilidad se evalúa con `elevation > horizonte` y para la Tierra se suma el ángulo mínimo de antena. Los cuerpos se modelan como puntos; no se considera visibilidad parcial del disco, inclinación de paneles, potencia eléctrica ni enlace de radio.

El DEM incluido cubre el polo sur hasta 75° S, con 240 m por píxel. El cálculo sigue rayos en 360 azimuts, muestrea el terreno cada 120 m y considera la curvatura de una esfera lunar de 1 737,4 km. Requiere cobertura completa hasta `max_horizon_distance_km` o devuelve 422. El alcance por defecto es 250 km (máximo 300): cerca del polo, macizos a 100–200 km pueden elevar el horizonte varios grados por encima de la trayectoria solar de 1–2°, y con 250 km todos los sitios del catálogo siguen dentro de la cobertura. Cuesta del orden de 1 s por cada 100 km y sitio. Es una aproximación dependiente de la resolución y distancia elegidas, no una certificación de aterrizaje. Fuente: [PDS LOLA LDEM_75S_240M](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/) y [proyección DSMAP_POLAR](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/catalog/dsmap_polar.cat).

Sin refinamiento, el intervalo de incertidumbre temporal de un cambio puede alcanzar `step_minutes`. Con exploración densa, se reduce a `refinement_step_minutes` para los cambios detectados; las métricas usan el punto medio de cada intervalo. El intervalo máximo es 14 días y 500 pasos en modo normal, o 5000 en modo denso. Los tiempos de entrada deben incluir zona horaria y se normalizan a UTC. Una caída o respuesta inesperada de Horizons devuelve HTTP 502.

## Próximos módulos

1. Usar un DEM de mayor resolución en sitios finalistas y cuantificar la sensibilidad al tamaño de píxel.
2. Estimar métricas con una cuadrícula adaptativa y validar cruces contra casos de referencia de Horizons.
3. Añadir catálogo de coordenadas documentadas y caché persistente para demostraciones.

Fuentes: [API Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [datos LOLA en NASA PDS](https://pds-geosciences.wustl.edu/missions/lro/lola.htm).
