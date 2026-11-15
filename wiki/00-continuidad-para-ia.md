# Empieza aquí: continuidad para otra IA

Esta página permite continuar sin reconstruir la conversación ni leer todo el repositorio. El usuario pidió documentar continuamente decisiones y entregas en esta wiki. La instrucción operativa está en [AGENTS.md](../AGENTS.md).

## Encargo del producto

LunarPath responde al reto **Lunar Landing Site Navigator**, NASA Space Apps. Ayuda a usuarios poco especialistas a explorar el polo sur lunar, seleccionar o generar coordenadas, elegir periodos y comparar oportunidades de luz solar y visibilidad de la Tierra sobre el horizonte topográfico. Debe ser intuitivo, con resultados explicables y datos NASA reales.

No es únicamente un catálogo de sitios. El usuario puede marcar en el mapa, escribir coordenadas o pedir candidatos nuevos alrededor de una región. La IA interpreta la intención y propone un plan; el motor científico evalúa los candidatos. El visor sitúa los puntos y las direcciones del Sol y la Tierra.

## Lectura mínima y prioridad

1. [Estado y pendientes actuales](14-estado-y-pendientes.md): capacidades, contratos, ubicaciones, pruebas y arranque vigente.
2. [Registro de entregas](15-registro-de-entregas.md): decisiones y cambios recientes.
3. [Consultas generativas](13-consultas-generativas.md), si la tarea involucra Gemini o búsquedas.
4. [Integración de datos reales](12-integracion-datos-reales.md), si involucra relieve, visibilidad o comparación.

Después inspeccionar únicamente los módulos afectados. No afirmar que el código coincide con un informe sin comprobar la versión local. Las páginas 01–11 conservan contexto y auditorías históricas: consultar sus fechas y cortes antes de usar afirmaciones de estado.

## Repositorios y decisiones

- Principal: [thallesado/SpaceAppsChallenge](https://github.com/thallesado/SpaceAppsChallenge), rama `main`.
- Fuente de mejoras: [ELkin2624/Lunar-Landing-Site-Navigator](https://github.com/ELkin2624/Lunar-Landing-Site-Navigator), revisión integrada `fbe2a7b`.
- En la copia de trabajo original, `spaceapps` es el principal y `origin` es Elkin. En un clon nuevo pueden llamarse distinto: verificar la URL.
- Base científica y generativa publicada: [`b551128`](https://github.com/thallesado/SpaceAppsChallenge/commit/b551128). Las mejoras posteriores de interfaz y navegación están en el estado vigente y el registro de entregas; no tomar ese hash como el último commit del proyecto.
- Se mantuvo el modelo Blender. Una decisión intermedia excluyó Moon Trek; el usuario la reemplazó expresamente por Blender **más** mapa Moon Trek. No restaurar la exclusión antigua.
- Se autorizó y realizó publicación de las entregas anteriores. Para nuevas acciones, respetar la autorización y alcance de la sesión actual; el historial no autoriza cualquier cambio externo.

## Lo que el usuario espera al continuar

Reutilizar lo construido, mantener datos reales, no ocultar fallos, explicar resultados sin saturar la UI de instrucciones y registrar cada entrega en la wiki. Una consulta puede ampliar información y generar candidatos dentro del modelo soportado. No inventar física orbital ni llamar «mejor sitio de la Luna» al mejor entre pocos puntos muestreados.

## Prompt listo para copiar

> Trabaja sobre thallesado/SpaceAppsChallenge. Primero lee AGENTS.md, wiki/README.md, wiki/00-continuidad-para-ia.md y wiki/14-estado-y-pendientes.md. Usa esa documentación como contexto de producto, decisiones y contratos. Consulta wiki/15-registro-de-entregas.md para cambios recientes y abre después solo el código necesario para mi tarea. Conserva Blender, el mapa Moon Trek, los datos reales NASA y las consultas Gemini con cálculo científico separado. No limites los puntos al catálogo, no inventes resultados y no conviertas una petición orbital en una evaluación de superficie. Preserva cambios locales y credenciales. Actualiza wiki, registro de entrega y evidencia con cada modificación. Distingue pruebas simuladas, reales y pendientes. La tarea concreta que te pido es: [ESCRIBIR AQUÍ].
