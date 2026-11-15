> Actualizaci?n local 2026-11-15: el motor integrado a?ade horizonte multirresoluci?n de 20/240 m con cobertura completa en el campo cercano. Los resultados originales de este documento conservan su m?todo y resoluci?n hist?ricos. Ver `wiki/12-integracion-datos-reales.md` y `VALIDACION_INTEGRACION_REAL.json`.

# Validación inicial del motor científico

## Alcance

El script `backend/scripts/validate_science.py` consulta JPL Horizons y el DEM LOLA local. Verifica que los segmentos temporales cubran exactamente el periodo sin huecos, que las ventanas sumen los porcentajes reportados y que las fracciones estén dentro de `[0, 1]`. Compara además el mismo escenario con pasos de 60, 15 y 5 minutos. Se ejecuta con:

```powershell
cd backend
.venv\Scripts\python scripts/validate_science.py
```

## Resultado observado

Para el ejemplo geométrico de latitud 0°, longitud 0°, entre el 16 y el 18 de noviembre de 2026 (UTC):

| Paso | Muestras | Fracción con Sol visible | Oscuridad continua máxima |
| --- | ---: | ---: | ---: |
| 60 min | 48 | 47,9167 % | 25 h |
| 15 min | 192 | 49,7396 % | 24,125 h |
| 5 min | 576 | 49,7396 % | 24,125 h |

El cálculo horario difiere 1,823 puntos porcentuales del de 5 minutos en esta ventana. El acuerdo de 15 y 5 minutos es una comprobación de sensibilidad para **este caso**, no una garantía universal. Una segunda consulta con el DEM LOLA en 89,5° S y 0° E leyó una altura de observador de −0,703 km respecto a la esfera de referencia y superó las mismas invariantes temporales.

## Límites

- La detección densa sigue siendo discreta: puede omitir eventos completos más breves que el paso elegido.
- El instante reportado es el punto medio entre la última muestra de un estado y la primera del siguiente. El intervalo completo se conserva como incertidumbre.
- LOLA de 240 m/píxel sirve para comparación regional, pero no resuelve todos los obstáculos locales.
- Estas verificaciones comprueban consistencia interna y sensibilidad temporal. El contraste con el DEM de 20 m y la órbita independiente INPOP19a se documenta abajo. Aún faltan una referencia topográfica independiente, una orientación lunar independiente y validación de las ventanas completas. No constituyen validación para navegación o selección final de aterrizaje.

## Sensibilidad temporal y espacial reproducible

`backend/scripts/validate_resolution.py` guarda el informe numérico en `docs/VALIDACION_RESOLUCION.json`. Para la referencia geométrica ecuatorial del 16 al 18 de noviembre de 2026, el paso de 60 minutos dio 47,9167 % de tiempo con Sol y el de 5 minutos 49,7396 %: diferencia de **1,823 puntos porcentuales**. Los pasos de 15 y 5 minutos coincidieron en este caso. Los intervalos de los eventos siguen limitados por el paso elegido.

En el punto de muestra de Malapert (86° S, 3,8° E), durante 24 horas desde el 15 de noviembre de 2026, el análisis de 60, 15 y 5 minutos dio luz y visibilidad terrestre continuas. Eso solo indica que **este periodo no contiene un cambio sensible al paso**. Para cuantificar el efecto de resolución espacial se calculó el horizonte a 50 km en azimuts cada 5° con el DEM original de 240 m y con copias promediadas a 480 y 960 m. Frente a 240 m, el error absoluto medio del horizonte fue **1,70°** y **6,33°**; el percentil 90 fue **2,94°** y **11,29°**, respectivamente. En esas 24 horas no cambió la clasificación del centro del Sol o de la Tierra, aunque el horizonte sí cambió sustancialmente.

Los DEM de 480 y 960 m se derivan del mismo producto LOLA; **no** son una referencia independiente ni sustituyen un DEM de 20 m. La resolución vertical, el registro horizontal, la cobertura y los obstáculos menores de 20 m siguen sin validación. La vista 3D y las capas Moon Trek son visualizaciones y no cambian estos cálculos.

## Contraste con LOLA de 20 m y NAIF SPICE

El producto PDS `LDEM_875S_20M` (20 m/píxel, 87,5°–90° S) se descargó junto con su etiqueta PDS. [`VALIDACION_DEM_20M.json`](VALIDACION_DEM_20M.json) compara cota puntual, pendiente de Horn con base comparable de ~240 m y horizonte hasta 5 km cada 5° en tres sitios cubiertos. La diferencia absoluta de cota fue de 10 a 28,5 m; la diferencia absoluta media del horizonte fue de 1,24°, 4,43° y 11,12° según el sitio. La diferencia de 11,12° en de Gerlache muestra que **el resultado regional de 240 m puede ser muy sensible al relieve cercano**. Las dos mallas son productos LOLA, por lo que esto mide sensibilidad a resolución e interpolación y no es una validación independiente del terreno. La malla de 20 m se usa en la vista 3D donde cabe la ventana local; las métricas operativas siguen usando el horizonte de 240 m.

[`VALIDACION_SPICE.json`](VALIDACION_SPICE.json) compara seis casos (Sol y Tierra en tres sitios y fechas) entre JPL Horizons y una proyección este–norte–arriba calculada con NAIF SPICE (`MOON_ME`, aberración `LT+S`). Con el kernel DE440 la mayor diferencia de azimut fue 0,00000081° y la de elevación 0,000027°. Al sustituir la **órbita** por [INPOP19a de IMCCE alojada por ESA](https://spiftp.esac.esa.int/data/SPICE/JUICE/kernels/spk/), las diferencias máximas fueron 0,00000123° y 0,000027° en estos casos. La solución orbital INPOP19a es independiente de JPL; la orientación lunar sigue usando el PCK DE440, de modo que la prueba no es totalmente independiente. Tampoco valida las ventanas de visibilidad con topografía.
