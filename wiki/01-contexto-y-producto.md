# Contexto y objetivo

[Índice](README.md) · [Flujo de uso](02-flujo-paso-a-paso.md)

## El reto elegido

El equipo eligió **Lunar Landing Site Navigator**, traducido en la conversación como «Navegador de sitios de alunizaje». La necesidad es comparar sitios y fechas del polo sur lunar mostrando la posición del Sol y de la Tierra respecto al horizonte. La iluminación ayuda a explorar oportunidades de energía solar; la visibilidad de la Tierra, oportunidades de comunicación directa.

Referencia: [página oficial del desafío](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). En la investigación inicial se consultó la descripción indexada; la apertura directa presentó errores 502. Esta revisión tampoco pudo recuperar esa página. No se afirma haber verificado la lista completa actual de su pestaña Resources.

## Problema del usuario

Una persona nueva no debería necesitar interpretar efemérides, proyecciones polares y archivos DEM para descubrir cuándo coinciden condiciones útiles. El producto organiza ese trabajo y muestra sus motivos.

Pregunta central acordada:

> ¿Dónde y cuándo tendría mejores condiciones de iluminación y visibilidad de la Tierra para mi exploración lunar?

El usuario configura un periodo, duración continua necesaria y porcentajes mínimos. El sistema evalúa alternativas y explica cuáles cumplen. «Mejor» depende de esos criterios; no es una propiedad universal del sitio.

## Público y alcance

La propuesta inicial priorizó estudiantes, educadores y planificación de misiones simuladas. Usuarios con conocimientos técnicos pueden examinar ángulos, perfiles y exportaciones. Este enfoque fue una decisión de producto, no una restricción atribuida a NASA.

Ejemplo ilustrativo: una actividad requiere seis horas continuas con Sol y Tierra visibles. Una opción con ocho horas simultáneas puede cumplir la duración; todavía debe cumplir los demás umbrales. El ejemplo no representa un cálculo sobre un sitio concreto.

## Qué aporta el equipo

- Unir geometría astronómica, topografía y visualización.
- Presentar resultados con mapa/3D, línea temporal y explicación.
- Comparar bajo requisitos explícitos y reconocer empates.
- Mostrar fallos y ausencia de cobertura sin inventar métricas de reserva.

## Qué no significa el resultado

| Resultado | No permite concluir por sí solo |
| --- | --- |
| Sol visible | Que paneles concretos generen energía suficiente. |
| Tierra visible | Que una estación terrestre tenga disponibilidad o un enlace cierre. |
| Cumple restricciones | Que la superficie sea segura para aterrizar. |
| Ventana larga | Que exista trayectoria de descenso o acceso operativo. |
| Predicción geométrica | Que exista un modelo de aprendizaje automático. |

La elección final requeriría, entre otros elementos, pendiente, rugosidad, obstáculos, navegación, vehículos, comunicaciones y validación independiente. El sistema actual debe presentarse como exploración preliminar de condiciones.

## Evolución del alcance

Se empezó solicitando dos o tres recursos NASA: Horizons, Moon Trek y LOLA/PGDA. Después se pidieron varias pantallas, una explicación del objetivo, una referencia visual y un visor 3D. Se reutilizaron frontend/backend existentes y se dividió la implementación entre integración/3D/backend y componentes de explicación. Más tarde el equipo sustituyó el globo con teselas Moon Trek por un asset Blender. Esa sustitución visual no cambia automáticamente la fuente científica del horizonte.
