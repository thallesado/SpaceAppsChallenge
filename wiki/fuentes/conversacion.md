# Síntesis de la conversación de origen

[Índice](../README.md) · [Historia verificable](../06-historia-y-decisiones.md)

Esta página sintetiza la conversación visible aportada por el usuario. No es una transcripción literal ni atribuye horas que no constan. Se omiten datos personales y detalles operativos irrelevantes. Las decisiones se contrastan con Git cuando es posible.

## Secuencia de necesidades

1. **Investigación inicial.** El usuario explicó que su grupo estaba en NASA Space Apps y había elegido Lunar Landing Site Navigator. Pidió revisar internet, evento, tema y recursos antes de diseñar. Se identificaron recursos oficiales y se advirtió que no todos son APIs.
2. **Público principiante.** Planteó presentar información a personas nuevas o poco especializadas y derivar estimaciones sobre sitios y días favorables. Se definió una comparación explicable por criterios.
3. **Alternativas.** Preguntó por sustitutos de Horizons y de cada recurso. Se analizaron SPICE, WebGeocalc, Skyfield, QuickMap y Kaguya como alternativas/complementos; no se seleccionaron automáticamente para el MVP.
4. **Procedencia NASA.** Solicitó dos o tres fuentes oficiales y preguntó si Horizons, Moon Trek, LOLA/LRO y PGDA eran NASA. Se aclaró misión/instrumento/producto/servicio y el origen común de algunos datasets.
5. **Flujo del producto.** Pidió diagramas y luego una explicación más sencilla del objetivo. La idea quedó centrada en elegir sitio y periodo bajo requisitos, no en acumular gráficos.
6. **Referencia visual.** Solicitó una página o imágenes. Se generó una referencia oscura con mapa, configuración y resultados ficticios identificados. No fue una implementación ni evidencia científica.
7. **Más de una pantalla.** Preguntó si todo sería una ventana. Se propusieron inicio, configuración guiada, exploración, comparación y detalle. La aplicación implementada después reutilizó paneles/pestañas, no cinco rutas completas.
8. **Handoff a colegas.** Pidió prompts completos para transmitir el contexto y, luego, uno específicamente de UI/UX. Se documentaron fuentes, límites, flujo y estados reales/demo.
9. **Repositorio existente.** Indicó `ELkin2624/Lunar-Landing-Site-Navigator` y pidió revisar qué servía. Se identificaron frontend y backend ya útiles, contratos incompatibles, mapa ilustrativo y segunda comparación demo.
10. **Backend inicial.** Pidió implementar APIs y dejar el backend preparado. Se añadieron adaptadores Moon Trek/PGDA, compatibilidad y ventanas simultáneas. Se explicó que elevar un punto no equivale a calcular horizonte.
11. **Trabajo remoto en paralelo.** Preguntó por el nuevo commit de colegas. Se detectó motor LOLA, caché persistente y funciones adicionales; se recomendó integrar sin perder aportes locales.
12. **Aclaración del 3D.** Preguntó si Moon Trek permitía 3D. Se confirmó que el portal tiene globo y mapas 2D, aclarando que los servicios WMTS no incorporan automáticamente su visor.
13. **Recordatorio del objetivo.** Volvió a preguntar qué reto y objetivo habían elegido. Se reafirmó la comparación de Sol/Tierra respecto al horizonte para oportunidades de exploración.
14. **Solicitud de sistema completo.** Pidió APIs funcionales, navegación 3D, referencias, recomendaciones y reutilizar ambos repositorios. Se integró main con adaptadores locales y un visor propio.
15. **División 70/30.** Solicitó que otra IA hiciera una parte sin colisiones. Se asignó exclusivamente `frontend/src/features/insights/` a componentes de resultados, horizonte y guía; integración/3D/backend quedaron fuera de esa carpeta.
16. **Localhost e integración.** Pidió ejecutar el sistema y revisar la entrega de la otra IA. Se conectaron sus componentes, se probó el flujo y se distinguieron límites de la recomendación.
17. **Cambio de repositorio.** Autorizó publicar en `thallesado/SpaceAppsChallenge`; se creó el commit integrado `41efb24`. Posteriormente pidió descargar lo hecho por colegas y se verificó `257c287`, integración Blender.
18. **Auditoría y wiki.** Entregó un plan de siguiente trabajo y pidió una auditoría más documentación de sistema, arquitectura y conversación. Esta wiki es la respuesta; ese plan no se implementó silenciosamente durante su revisión.

## Decisiones que siguen orientando el proyecto

- Usar recursos NASA con una responsabilidad útil y trazable.
- Reutilizar código y contratos existentes donde tengan sentido.
- Explicar por qué una opción cumple y reconocer que puede no haber ninguna.
- Distinguir iluminación de energía, visibilidad de enlace y oportunidad de seguridad de alunizaje.
- No sustituir fallos por métricas ficticias.
- No considerar una simulación visual una validación científica.
- Dar a otra IA un encargo autocontenido con límites de archivos y criterios verificables.

## Cambios que requieren volver a decidir

La sustitución Moon Trek → GLB modificó la implementación del visor, no el reto ni el objetivo. La futura incorporación de DEM 20 m debe verificar datos y marcos antes de llamarse operativa. Los módulos de energía, ranking ponderado y diagnóstico no estaban todos en el alcance inicial y necesitan una validación proporcional a lo que se afirme de ellos.
