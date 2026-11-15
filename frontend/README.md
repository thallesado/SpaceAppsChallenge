# LunarPath — Frontend

Interfaz React + TypeScript + Vite para explorar el polo sur lunar y comparar periodos de iluminación y visibilidad de la Tierra. La aplicación principal usa el backend `/api/v1`; la interfaz anterior se conserva en `src/LegacyApp.tsx`.

## Ejecutar

```powershell
cd frontend
npm ci
npm run dev
```

Para validar la compilación, ejecutar `npm run build`.

## Visor 3D

`src/MoonScene.tsx` carga el modelo Blender MOON_ME desde `public/luna/luna_cientifica.glb`. El GLB incluye texturas y se sirve desde el propio frontend: el visor no solicita teselas de Moon Trek durante la ejecución. El origen, los marcadores y los raycasts usan el mismo sistema MOON_ME (X: longitud 0°, Y: norte, Z: longitud este negativa en el marco Three.js).

Se puede orbitar con arrastre, acercar con la rueda, seleccionar sitios del catálogo o introducir coordenadas. Mayús + clic permite marcar un punto personalizado sobre el modelo o sobre la malla local cuando está disponible. Las coordenadas seleccionadas siguen el flujo normal del análisis y se validan para la cobertura del polo sur.

El GLB es una visualización; sus texturas y relieve no sustituyen al DEM LOLA usado por el backend para mallas, perfiles de horizonte y métricas. Las direcciones del Sol y la Tierra provienen del resultado de Horizons y se actualizan con el control temporal. El visor no calcula por sí mismo visibilidad científica ni seguridad de aterrizaje.

## Integración con el backend

En desarrollo, Vite reenvía `/api` a `http://127.0.0.1:8000`. Configura `VITE_API_BASE_URL` para otro servidor. La aplicación usa `/api/v1` para cargar el catálogo y estado, consultar la malla LOLA local, calcular el horizonte, analizar un escenario y comparar alternativas. Los errores se presentan en la interfaz; no se reemplazan por datos de demostración.

Consulta [`../docs/INTEGRACION_EXPLORADOR_3D.md`](../docs/INTEGRACION_EXPLORADOR_3D.md) para contratos, pasos de arranque, fuentes y límites científicos.
