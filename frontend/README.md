# LunarPath AI — Frontend

> La aplicación principal ahora es el explorador lunar 3D conectado a `/api/v1`: usa Moon Trek, Horizons y LOLA. La interfaz anterior descrita más abajo se conserva en `src/LegacyApp.tsx`. Instrucciones actuales, límites y verificación: [integración 3D](../docs/INTEGRACION_EXPLORADOR_3D.md).

Interfaz React + TypeScript + Vite para explorar sitios del polo sur lunar, recorrer una línea temporal de visibilidad Sol/Tierra, comparar dos escenarios y evaluar restricciones básicas de misión.

## Ejecutar

```bash
cd frontend
npm install
npm run dev
```

Abre la URL local que muestra Vite. Para compilar: `npm run build`.

## Datos y API

El repositorio incluye un backend FastAPI en `../backend`. El mapa y el relieve dibujado en la vista de horizonte siguen siendo **ilustraciones**; las métricas pueden venir de Horizons y LOLA cuando la API está activa. Las coordenadas de los puntos son muestras de interfaz, no ubicaciones de aterrizaje aprobadas.

Por defecto se utiliza la demo. Para activar el backend, copia `.env.example` a `.env` y ejecuta el backend. El cliente consulta `POST /api/scenarios/analyze` para los dos sitios de la comparación, usa las métricas devueltas por FastAPI y pide horizonte LOLA. Si falla una consulta, muestra un aviso explícito y datos de demostración identificados como ilustrativos. En desarrollo, Vite redirige `/api` a `http://localhost:8000`. Para otro destino, configura `VITE_API_BASE_URL`.

Solicitud esperada:

```json
{
  "latitude": -85.4,
  "longitude": -29.2,
  "start_time": "2026-11-15T00:00:00Z",
  "hours": 168,
  "step_minutes": 60,
  "use_dem_horizon": true
}
```

Respuesta esperada:

```json
{
  "samples": [
    {
      "hour": 0,
      "sun_elevation": 2.1,
      "earth_elevation": 4.7,
      "horizon_sun": 1.8,
      "horizon_earth": 2.2,
      "sun_visible": true,
      "earth_visible": true
    }
  ]
}
```

Se esperan al menos dos muestras horarias y métricas del backend. La API proporciona efemérides y horizonte topográfico; el frontend no los calcula. La vista de horizonte sigue siendo una ilustración visual, incluso cuando las métricas provienen de la API.

## Alcance actual

- Selección entre cuatro regiones de muestra y fecha UTC.
- Visibilidad solar y terrestre, intervalos de oscuridad y blackout, gráfico temporal y control de hora.
- Modo Analyst con umbrales ajustables.
- Comparación de dos sitios y exportación CSV del escenario principal.
- Diseño adaptable para escritorio y móvil.

El mapa científico con proyección polar, datos LOLA/LRO, vista 3D y copiloto IA requieren los servicios y datasets del plan original; no se presentan como funciones científicas de esta versión.
