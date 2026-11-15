# Verificación de resultados cero y explicación gráfica

El usuario sospechó que las alternativas en cero no usaban referencias NASA y pidió probar fidelidad, corregir fallos y hacer los resultados comprensibles visualmente. Se reprodujeron los casos, se contrastaron los datos y se sustituyó la presentación numérica predominante por gráficos basados en las muestras reales.

## Resultado de la investigación

Los ceros reproducidos no proceden de una API vacía ni de métricas de reserva. Para el 15 de noviembre de 2026, 00:00–24:00 UTC, con observador a 2 m y horizonte hasta 250 km:

| Punto / fecha | Sol visible | Tierra visible | Coincidencia continua máxima |
| --- | --- | --- | --- |
| (-89°, 0°), 15 noviembre | 0% | 0% | 0 h |
| (-88.3404°, 0°), 15 noviembre | 0% | 0% | 0 h |
| (-89.6596°, 0°), 15 noviembre | 0% | 0% | 0 h |
| **Mismo punto (-89°, 0°), 19 noviembre** | **100%** | **100%** | **24 h** |
| **Mons Malapert (-85.98°, -1.67°), 15 noviembre** | **79.1667%** | **100%** | **19 h** |

En el primer caso, Horizons sitúa el Sol entre 1.142573° y 1.334190° sobre el plano local, mientras el relieve en su azimut está entre 2.292019° y 3.358039°. El mejor margen del Sol sigue siendo negativo, aproximadamente −0.958°. La Tierra está entre −2.554089° y −1.367781°, y también queda bajo el horizonte de terreno. Estar sobre el horizonte plano no garantiza superar el relieve.

Los vecinos de la captura están redondeados aquí a cuatro decimales; el generador conserva precisión completa. La auditoría reproduce esas coordenadas redondeadas y conserva los valores exactos evaluados en su informe. No se cambió el motor para forzar porcentajes positivos.

## Cómo se contrastó

`backend/scripts/verify_zero_visibility.py` ejecuta cinco casos reales y valida:

1. API local contra consultas nuevas de Horizons con la caché del cliente deshabilitada; errores inferiores a 0.000001°.
2. Posiciones frente a SPICE/DE440 por un camino de cálculo diferente, cada seis horas. Error angular máximo observado: aproximadamente **0.000024674°**, por debajo de la tolerancia de 0.001°.
3. Horizonte frente a un trazador cartesiano independiente, leyendo los IMG con NumPy y los offsets/escalas del LBL. No reutiliza `terrain._profile` ni el lector de altura de producción; usa los mismos DEM NASA y el mismo muestreo cercano/lejos para comparar el algoritmo. Diferencia inferior a 0.000001°.
4. Indicadores de visibilidad por muestra e integración ponderada por duración, comparados con los porcentajes devueltos. También se recalculan la intersección y su duración continua máxima sin usar el analizador de producción: coinciden con 0, 24 y 19 horas en los controles. Se contrasta la misma rejilla temporal, no los posibles eventos entre muestras.
5. Controles positivos de la misma coordenada en otra fecha y de otro sitio en la fecha original.

[Informe de auditoría](../docs/VALIDACION_VISIBILIDAD_CEROS.json). Esta comprobación no es una solución orbital independiente ni una validación de seguridad de aterrizaje. Comparte los productos DEM y su discretización; la resolución, los eventos breves entre muestras y el disco parcialmente visible siguen siendo límites del modelo.

## Presentación nueva

- Anillos con porcentajes de Sol y Tierra, conservando una cifra decimal cuando aporta información. Fracciones positivas muy pequeñas se muestran como «<0.1%», no se redondean a cero; se distingue el caso casi completo de 100% exacto.
- Gráficos temporales reales de elevación del astro y horizonte en su azimut. La línea de color es el astro; la discontinua representa el horizonte topográfico a lo largo del periodo, no una fotografía de montañas.
- Causa breve cuando hay cero: relieve ocultando el astro, astro bajo el horizonte plano o margen requerido no superado. Se determina con las muestras recibidas, sin crear métricas de reserva.
- Ventana máxima y avance frente al requisito de duración; intervalos cortos se expresan en minutos/segundos para no convertirlos en «0.0 h».
- Barras temporales de Sol, Tierra y ambos: color = visible, rayado = oculto. El encabezado informa duración, cantidad de posiciones y paso temporal.
- Detalle de explicación y ventanas plegado inicialmente. Se conserva selección del resultado para abrir su punto en el mapa.

Archivos principales: `frontend/src/VisibilityVisuals.tsx`, `visibility-visuals.css`. Integración localizada en `features/insights/ResultsPanel.tsx` y campo opcional `timeline` en sus tipos; no se reescribió el resto del trabajo del colaborador. Los contratos del backend y los criterios científicos se conservan.

## Reproducir

Desde backend, con ambos DEM y los kernels descargados e instalación `.[dev,validation]`:

```powershell
.venv/Scripts/python -u scripts/verify_zero_visibility.py
.venv/Scripts/python -m pytest -q
```

Desde frontend, con API y Vite locales funcionando:

```powershell
npm run build
node tests/visibility-results.e2e.mjs
```

Resultado ejecutado: **59 tests del backend aprobados**, build correcto y navegador con tres alternativas reales, comprobando un cero y el control de 19 h, seis gráficos angulares, nueve pistas temporales, selección hacia el mapa y móvil de 390 px sin desbordamiento ni errores JS. [Informe del navegador](../docs/VALIDACION_RESULTADOS_VISUALES.json). Se inspeccionaron capturas locales de resultados cero, positivos y móvil en `frontend/artifacts/`. El navegador no simula respuestas NASA ni resultados.
