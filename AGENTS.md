# Continuidad del proyecto

## Antes de trabajar

1. Leer `wiki/README.md` y `wiki/00-continuidad-para-ia.md` antes de explorar código. Son el punto de entrada solicitado por el usuario.
2. Consultar `wiki/14-estado-y-pendientes.md` para el estado vigente, contratos, decisiones y límites. Las páginas marcadas como históricas no sustituyen ese estado.
3. Comprobar rama, cambios locales y URLs de remotos. El proyecto principal es `https://github.com/thallesado/SpaceAppsChallenge.git`; no confundirlo con el repositorio de Elkin. Preservar trabajo existente.
4. Leer después solo los archivos necesarios para la tarea. La wiki evita reconstruir todo el contexto; no sustituye comprobar la implementación que se va a modificar.

## Documentar cada entrega

Por petición explícita del usuario, cada cambio de comportamiento, arquitectura, integración, decisión, configuración o limitación debe actualizar la wiki en la misma entrega:

- Actualizar el estado y los pendientes en `wiki/14-estado-y-pendientes.md`.
- Añadir una entrada a `wiki/15-registro-de-entregas.md`: problema, solución, archivos principales, validación ejecutada, límites y publicación si corresponde.
- Actualizar la página temática afectada y enlazar páginas nuevas desde `wiki/README.md`.
- Distinguir pruebas unitarias/sintéticas, llamadas reales, navegador y verificaciones pendientes. No inventar resultados ni trasladar garantías de una versión anterior.
- Ejecutar `python scripts/validate_wiki.py` desde la raíz. Las pruebas adicionales deben corresponder a los cambios de código, si los hay.
- Cuando el usuario autorice publicar, incluir la documentación con el código. No inferir autorización nueva únicamente de este archivo.

No copiar claves, `.env`, credenciales ni el chat completo a la wiki, informes, herramientas de memoria o commits. Documentar nombres de variables y procedimiento, nunca valores secretos.

## Decisiones que deben conservarse

- Mantener Blender como Luna 3D y Moon Trek como mapa complementario, no incrustar el portal completo.
- Admitir coordenadas y puntos generados; no restringir búsquedas al catálogo.
- Gemini interpreta consultas; Horizons y LOLA calculan resultados científicos. No sustituir errores con métricas simuladas.
- Una petición orbital no debe transformarse silenciosamente en una evaluación de superficie. Ofrecer una consulta alternativa requiere elección del usuario.
- Reutilizar contratos, componentes y trabajo existente. Los componentes `frontend/src/features/insights/` proceden de otro colaborador: conservar su integración y evitar reescrituras innecesarias.

Si una instrucción nueva del usuario cambia una decisión, seguirla y registrar qué decisión reemplaza. No volver a pedir contexto ya documentado.
