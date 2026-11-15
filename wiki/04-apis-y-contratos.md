# APIs y contratos

[Índice](README.md) · [Motor](05-motor-cientifico.md)

Inventario obtenido del código del corte auditado. El esquema ejecutable está en `/openapi.json` y la documentación local, en `http://127.0.0.1:8000/docs`.

## Caminos utilizados por la interfaz principal

| Método y ruta | Función |
| --- | --- |
| `GET /api/v1/status` | Presencia del DEM y etiquetas de fuentes. No healthcheck remoto NASA. |
| `GET /api/v1/sites` | Catálogo estático; también existe `/api/v1/catalog/sites`. |
| `POST /api/v1/terrain/mesh` | Cuadrícula latitud/longitud/elevación para la vista local. |
| `POST /api/v1/scenarios/evaluate` | Evaluar un escenario. |
| `POST /api/v1/terrain/horizon` | Obtener el perfil para su gráfico. |
| `POST /api/v1/scenarios/search` | Lugares × desplazamientos de fecha y orden explicable. |

El GLB se obtiene del servidor frontend, no mediante una API NASA.

## Servicios adicionales disponibles

| Ruta | Uso y matiz |
| --- | --- |
| `/api/v1/sites/{id}` y `/api/v1/sites/{id}/horizon` | Información del catálogo/perfil de sitio. |
| `POST /api/v1/ephemeris` | Consulta directa; validación insuficiente documentada en A04. |
| `POST /api/v1/scenarios/compare` | Evaluación de 2–5 escenarios; no aplica por sí sola ranking. |
| `POST /api/v1/scenarios/recommend` | Orden por cumplimiento/continuidad; exige varias condiciones comunes. |
| `POST /api/v1/scenarios/rank` | Ranking ponderado adicional; no confundir con búsqueda UI. |
| `POST /api/v1/scenarios/delta` | Comparación de cambios espaciales/temporales. |
| `POST /api/v1/simulation/power` | Balance energético preliminar; A01 impide confiar en refinamiento. |
| `POST /api/v1/copilot/explain` | Diagnóstico determinista. |
| `POST /api/v1/copilot/parse-constraints` | Expresiones regulares sobre texto. |
| `POST /api/v1/scenarios/export/csv` | Muestras con estados/fracciones parciales. |
| `GET /api/v1/cache/stats`, `POST /api/v1/cache/clear` | Administración del caché; no datos de usuario. |
| `POST /api/scenarios/analyze`, `/api/v1/scenarios/analyze` | Adaptador legacy. |
| `GET /api/v1/maps/layers`, `/maps/layers/{id}/capabilities` | Catálogo Moon Trek y capacidades WMTS. |
| `GET /api/v1/maps/tiles/{level}/{row}/{col}` | Proxy acotado de mosaico WAC, niveles 0–3. |
| `GET /api/v1/terrain/products/{78|90}` | Descubre GeoTIFF oficiales PGDA. |
| `GET /api/v1/terrain/elevation` | Muestrea GeoTIFF LDEM compatible. El catálogo 78 no implica soporte de todos sus nombres/productos. |

## Ejemplo de escenario

Solicitud ilustrativa, sin promesa de que ese punto cumpla:

```json
{
  "site": {"latitude_deg": -89.5, "longitude_deg": 0, "label": "Punto de referencia"},
  "start_utc": "2026-11-14T00:00:00Z",
  "end_utc": "2026-11-15T00:00:00Z",
  "step_minutes": 60,
  "use_dem_horizon": true,
  "observer_height_m": 2,
  "max_horizon_distance_km": 250,
  "constraints": {
    "min_sunlit_fraction": 0.4,
    "min_earth_visible_fraction": 0.4,
    "min_concurrent_hours": 6
  }
}
```

El resultado contiene `scenario`, `samples`, `metrics`, `timeline`, `ephemeris_source`, `horizon_source`, `site_height_km_used` y `precision_note`. Los eventos temporales incluyen brackets e instante estimado. El tipo frontend de `timeline` solo declara segmentos: esa incertidumbre todavía no se muestra.

## Unidades y referencias

| Valor | Convención actual |
| --- | --- |
| Latitud/longitud, azimut, elevación | Grados; solicitudes de longitud en −180…180. |
| `height_km` y altura usada por Horizons | Kilómetros; revisar correspondencia de datum antes de combinar productos nuevos. |
| Elevación DEM y altura del observador | Metros. |
| Distancia máxima del horizonte | Kilómetros. |
| Fracciones | 0…1; la UI multiplica por 100 para porcentaje. |
| Duraciones de ventanas | Horas. |
| Fechas | Con offset obligatorio y normalizadas a UTC. Intervalos `[inicio, fin)`. |
| DEM PDS | Esfera de radio 1 737 400 m; etiqueta MOON_ME/DE421; proyección polar. |

No existe todavía un contrato completo versionado de incertidumbre espacial, obstáculo dominante o fuente por azimut. Tampoco una captura del kernel/procedencia completa de cada consulta de Horizons. Son requisitos futuros, no campos actuales.

## Fuentes primarias

- [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html): consulta de observador, coordenadas y tiempos.
- [Moon Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon): imágenes por teselas y capacidades.
- [Archivo PDS LOLA](https://pds-geosciences.wustl.edu/missions/lro/lola.htm): productos de la misión/instrumento.
- [PGDA 90](https://pgda.gsfc.nasa.gov/products/90) y [PGDA 78](https://pgda.gsfc.nasa.gov/products/78): productos derivados. El 90 documenta proyección polar, MOON_ME y DE421.

LOLA es un instrumento de LRO; PGDA/PDS son archivos/productos. No contar cada portal como una medición independiente ni llamarlos a todos APIs REST.
