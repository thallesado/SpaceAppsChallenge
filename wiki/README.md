# Wiki de LunarPath

**Empieza por [Continuidad para otra IA](00-continuidad-para-ia.md) y [Estado vigente y pendientes](14-estado-y-pendientes.md).** No hace falta reconstruir el chat ni revisar todo el código para entender el proyecto.

Proyecto principal: [thallesado/SpaceAppsChallenge](https://github.com/thallesado/SpaceAppsChallenge), rama `main`. La base científica y generativa se consolidó en `b551128`; los cambios posteriores de interfaz y documentación se describen en el estado vigente y el registro de entregas.

## Lectura operativa

| Necesidad | Página |
| --- | --- |
| Pasar el proyecto a otra IA, con prompt listo | [Continuidad y contexto mínimo](00-continuidad-para-ia.md) |
| Saber qué funciona, contratos, módulos, arranque, pruebas y pendientes | [Estado vigente](14-estado-y-pendientes.md) |
| Entender qué cambió y por qué | [Registro de entregas](15-registro-de-entregas.md) |
| Consultas Gemini, puntos nuevos, búsqueda mensual y límites orbitales | [Consultas personalizadas](13-consultas-generativas.md) |
| Integración de Elkin, Blender, Moon Trek y ciencia | [Datos reales e integración](12-integracion-datos-reales.md) |
| Instrucciones de mantenimiento para agentes | [AGENTS.md](../AGENTS.md) |
| Entender de un vistazo la explicación visual de Datos y método | [Diagramas y ejemplo interactivo](16-explicacion-visual-del-metodo.md) |
| Ver propuestas y resultados directamente en el Explorador | [Consulta interactiva en el mapa](17-consulta-interactiva-en-mapa.md) |
| Entender y comprobar resultados cero y gráficos de visibilidad | [Auditoría de ceros y resultados visuales](18-verificacion-de-ceros-y-resultados-visuales.md) |

**Decisiones vigentes:** Blender como visor 3D y Moon Trek como mapa complementario; coordenadas personalizadas y candidatos generados; Gemini interpreta y NASA calcula; sin métricas ficticias. Las recomendaciones comparan candidatos y fechas muestreados, no certifican seguridad de alunizaje. Las peticiones orbitales requieren otra capacidad científica y no se convierten silenciosamente en análisis de superficie.

## Archivo de contexto y auditorías

Las siguientes páginas conservan sus cortes históricos. Para decidir qué está implementado ahora, prevalece el estado vigente enlazado arriba.

1. [Contexto, reto y objetivo](01-contexto-y-producto.md).
2. [Flujo original paso a paso](02-flujo-paso-a-paso.md).
3. [Arquitectura del corte auditado](03-arquitectura.md).
4. [APIs y contratos del corte auditado](04-apis-y-contratos.md).
5. [Motor científico original](05-motor-cientifico.md).
6. [Historia inicial y decisiones](06-historia-y-decisiones.md).
7. [Auditoría de thallesado, corte 257c287](07-auditoria.md).
8. [Plan recibido del equipo](08-plan-del-equipo.md).
9. [Operación del corte original](09-operacion-y-validacion.md).
10. [Pruebas y faltantes de la auditoría inicial](10-pruebas-y-faltantes.md).
11. [Corrección: repositorio Elkin, corte fbe2a7b](11-correccion-repositorio-elkin.md).
12. [Síntesis de conversación](fuentes/conversacion.md) y [texto recibido del equipo](fuentes/plan-recibido.md).

## Mantener esta wiki

Cada entrega debe actualizar el estado, la página temática y el registro, indicando pruebas ejecutadas y limitaciones. Ejecutar `python scripts/validate_wiki.py` desde la raíz. No copiar claves ni valores de `.env`.

La wiki está versionada dentro de este repositorio, junto al código; no es un repositorio GitHub Wiki separado. «Publicado en GitHub» no significa «desplegado en un servidor público».
