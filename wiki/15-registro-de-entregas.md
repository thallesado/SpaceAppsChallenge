# Registro de entregas y decisiones

Actualizar con cada entrega; explicar estado final, evidencia y límites. Conservar entradas antiguas como historia. Fechas conforme al contexto de trabajo del 15 de noviembre de 2026; los hashes identifican mejor la versión que los relojes de distintas máquinas.

| Entrega | Cambio y decisión | Validación y límites |
| --- | --- | --- |
| `257c287` | Colegas integraron la Luna Blender. Fue el primer corte auditado de thallesado. | Auditoría histórica, no describe la integración posterior de Elkin. |
| Revisión de `fbe2a7b` de Elkin | El usuario corrigió el repositorio a auditar; se localizó DEM 20 m, pendientes y validaciones que no estaban en la otra línea. | Ver [corrección](11-correccion-repositorio-elkin.md). No confundir ambos remotos. |
| [`b41fbee`](https://github.com/thallesado/SpaceAppsChallenge/commit/b41fbee) | Integración NASA/Elkin, mapa Moon Trek junto a Blender, horizonte multirresolución, correcciones de energía/ranking/caché/origen físico, sensibilidad, wiki y consultas Gemini. | 57 tests, build, navegador con Gemini real y seis alternativas, cuatro fallos simulados. Clave solo local. Ver [integración](12-integracion-datos-reales.md) y [consultas](13-consultas-generativas.md). |
| Configuración Gemini | El usuario proporcionó credenciales para configurar el `.env`; no se conserva su valor en documentación. Modelo inicial no disponible para usuarios nuevos; se comprobó `gemini-3.1-flash-lite`. | Autenticación e interpretación reales verificadas. Un asistente no puede borrar mensajes del historial; no se volvió a reproducir la clave. |
| [`b551128`](https://github.com/thallesado/SpaceAppsChallenge/commit/b551128) | El usuario rechazó limitarse a sitios predefinidos. Se añadieron puntos geodésicos generados, meses completos por lotes, `top_k`, fechas distintas y alternativa explícita para consultas orbitales no soportadas. | 59 tests y build; navegador con tres candidatos nuevos/dos opciones; ejecución real de 90 combinaciones en noviembre. Ver [estado](14-estado-y-pendientes.md). |
| Continuidad documental, posterior a `b551128` | El usuario pidió documentar lo anterior y lo futuro para cambiar de IA sin reconstruir el contexto. Se crea entrada de traspaso, estado vigente, registro y `AGENTS.md`; se distinguen páginas históricas y se corrige el índice. | Cambio documental: 19 páginas y 108 enlaces relativos validados con `scripts/validate_wiki.py`, JSON de evidencia legibles; sin cambios de ejecución. No se repiten tests científicos por esta edición. |

### Explicación visual de Datos y método, posterior a `bba5902`

El usuario pidió dibujos para entender el sistema de un vistazo. Se añadieron tres etapas ilustradas y un ejemplo interactivo Sol oculto/visible, conservando las fuentes debajo y diferenciando esquema de resultado real. Archivos principales: `MethodExplainer.tsx`, `method-explainer.css` y `App.tsx`. Build correcto; navegador con alternancia, teclado y móvil a 390 px sin desbordamiento ni errores JS. Evidencia y límites en [explicación visual](16-explicacion-visual-del-metodo.md). No se midió la comprensión de usuarios en diez segundos ni se cambió el cálculo científico.

### Ejemplos de consulta, posterior a `529112e`

El usuario pidió conocer los tipos de consultas y disponer de al menos tres ideas en pantalla. Se añadieron tarjetas para coordenadas propias, puntos nuevos y fechas mensuales. Rellenan el texto editable y lo enfocan, sin ejecutar Gemini ni NASA automáticamente. Archivos: `AssistantSearch.tsx`, `assistant-examples.css`. Build correcto y navegador con tres ejemplos, teclado, edición, cero solicitudes automáticas y móvil sin desbordamiento ni errores JS. [Detalle y evidencia](13-consultas-generativas.md). El ranking por distancia entre pares mostrado en la captura sigue fuera del alcance implementado.

## Cómo añadir una entrada

Registrar problema u objetivo, comportamiento final, decisión del usuario que reemplaza una anterior, módulos afectados, pruebas realmente ejecutadas, evidencia guardada, pendientes y publicación si aplica. No escribir un hash de commit antes de que exista: usar descripción y corte funcional anterior, o enlazar el hash en una actualización posterior.

La documentación se guarda en `wiki/` dentro del mismo repositorio. No depende de un repositorio separado `*.wiki.git` ni de que otra IA acceda al historial de esta conversación.
