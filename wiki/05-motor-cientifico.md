# Cómo calcula el motor

[Índice](README.md) · [Auditoría](07-auditoria.md)

## Terreno y altura

`LolaDem` abre un IMG PDS3 de enteros de 16 bits y su etiqueta LBL, verifica geometría esperada y utiliza mmap. Convierte las coordenadas a fila/columna mediante una proyección polar; `round` elige el **píxel más cercano**, no interpolación bilineal.

Con `use_dem_horizon=true`, obtiene la altura del sitio y suma `observer_height_m`. La altura resultante se pasa en kilómetros a Horizons. El código hereda una esfera de 1 737,4 km y el marco de la etiqueta PDS. La compatibilidad con cada nuevo DEM/efeméride debe demostrarse, no suponerse por una etiqueta textual.

## Perfil del horizonte

Traza rayos alrededor del observador, por defecto cada 1° y hasta 250 km. Muestrea a intervalos de 120 m a lo largo de los rayos sobre el DEM de píxel 240 m. Calcula el ángulo de cada terreno respecto a la tangente local considerando curvatura y conserva el máximo por azimut.

Ese muestreo no crea resolución de 120 m. Tampoco resuelve obstáculos entre rayos: a 250 km, 1° equivale aproximadamente a 4,36 km de separación lateral. Es un límite a estudiar, no una medida de error ya cuantificada.

Se devuelve una lista azimut/elevación. No se registra aún cuál punto, distancia o producto causó cada máximo. El caché LRU reutiliza el mismo horizonte entre fechas.

## Efemérides

Horizons recibe `CENTER='coord@301'` —observador sobre la Luna— y objetos 10/399. El adaptador pide azimut/elevación y parsea el bloque `$$SOE…$$EOE` de una respuesta CSV contenida en JSON. Consulta caché antes de hacer HTTP.

`evaluate` comprueba correspondencia y continuidad temporal entre ambas series. La validación de ese camino es más estricta que la del endpoint directo de efemérides: no intercambiar sus garantías.

## Visibilidad

Para cada azimut se interpola circularmente la elevación del perfil. El centro se considera visible cuando:

```text
elevación_del_cuerpo > horizonte_en_su_azimut + margen
```

El margen de Tierra se toma de `min_earth_elevation_deg`; conviene documentar claramente si el equipo quiere margen sobre relieve o mínimo sobre plano geométrico antes de cambiarlo.

El disco parcial se estima con radios angulares constantes heredados (Sol 0,267°, Tierra 0,950°). Sus fracciones son una aproximación separada: no sustituyen la definición binaria usada para ventanas. No representan automáticamente energía útil ni enlace de radio.

## Línea temporal y refinamiento

En modo normal, una muestra define el estado hasta la siguiente. Se fusionan intervalos consecutivos iguales. Se detectan cambios y se conserva un bracket; el instante estimado es su punto medio.

Con refinamiento se consulta una cuadrícula más densa en todo el periodo. El motor recompone segmentos usando los tiempos estimados. Eventos completamente más breves que el paso pueden seguir sin detectarse.

Los campos `next_*` de la línea temporal son los primeros eventos del periodo calculado. No son un servicio que recalcule el siguiente evento respecto al cursor móvil del frontend.

## Métricas

Todos los porcentajes del análisis se obtienen sumando duraciones de segmentos y dividiendo por el periodo. Se calculan ventanas solares, terrestres y simultáneas, oscuridad máxima, interrupción terrestre máxima y cumplimiento de requisitos.

Ejemplo: dos ventanas simultáneas de 3 h suman 6 h totales, pero no cumplen una exigencia de 6 h continuas. `longest_concurrent_hours` distingue ambas cosas.

## Comparación y módulos adicionales

`search/recommend` priorizan cumplimiento. `rank` utiliza puntuación ponderada y una penalización multiplicativa; la auditoría demuestra que puede colocar primero una opción inválida. No presentar ambas rutas como un único motor equivalente.

`power.py` modela un panel vertical orientado azimutalmente al Sol, una carga continua y batería limitada. No hay selección de seguimiento/configuración de antena. La discrepancia de integración temporal detectada exige corregirlo antes de usar sus conclusiones. `blackout_hours_supported` actualmente repite la oscuridad máxima, no calcula una autonomía garantizada.

## Qué validación existe

[VALIDACION_CIENTIFICA.md](../docs/VALIDACION_CIENTIFICA.md) describe consistencia interna y sensibilidad 60/15/5 min de un caso geométrico y una comprobación polar. El script utiliza Horizons también como fuente del resultado: **no es un contraste orbital independiente**. No hay en el corte un contraste completo de ventanas contra otro motor ni informes JSON versionados del DEM 20 m mencionado por el equipo.
