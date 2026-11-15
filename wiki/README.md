# Wiki de LunarPath

Nueva función: [consultas personalizadas con Gemini](13-consultas-generativas.md), configuración y alcance de verificación.

> **Estado actual:** [integraci?n local con datos reales](12-integracion-datos-reales.md). La nueva indicaci?n incorpora Moon Trek junto al modelo Blender; esta p?gina distingue los cortes hist?ricos del estado integrado.

> **Corrección de alcance, 15 de noviembre:** el usuario indicó que debe revisarse el main de **ELkin2624/Lunar-Landing-Site-Navigator**, cuyo corte descargado es `fbe2a7b`. Lee primero la [corrección y resultados del repositorio correcto](11-correccion-repositorio-elkin.md). La auditoría anterior de `257c287` corresponde a thallesado/SpaceAppsChallenge y no describe íntegramente esa otra línea.

Documentación del proyecto **Lunar Landing Site Navigator**, NASA Space Apps. Esta wiki combina inspección del código, historial Git y decisiones de la conversación de trabajo. Explica el sistema existente y separa las propuestas del equipo de las capacidades comprobadas.

**Corte auditado:** `257c28743cb3fb269b46bd006e47f1aec8811795`, `main` de `thallesado/SpaceAppsChallenge`. Fecha de revisión según contexto del proyecto: **14 de noviembre de 2026, America/La_Paz**. El texto recibido del equipo se presenta como estado al **15 de noviembre**; se conserva como declaración del remitente, no como fecha actual ni evidencia de implementación.

## Recorrido de lectura

1. [Contexto, reto y objetivo del producto](01-contexto-y-producto.md).
2. [Qué hace el usuario y qué sucede en cada paso](02-flujo-paso-a-paso.md).
3. [Arquitectura y responsabilidades](03-arquitectura.md).
4. [APIs, contratos y procedencia](04-apis-y-contratos.md).
5. [Motor científico y significado de los resultados](05-motor-cientifico.md).
6. [Evolución por commits y decisiones](06-historia-y-decisiones.md).
7. [Auditoría del código y evidencia reproducible](07-auditoria.md).
8. [Evaluación del próximo trabajo en paralelo](08-plan-del-equipo.md).
9. [Instalación, operación y verificación](09-operacion-y-validacion.md).
10. [Síntesis de esta conversación](fuentes/conversacion.md) y [plan recibido del equipo](fuentes/plan-recibido.md).
11. [Pruebas del 15 de noviembre y faltantes priorizados](10-pruebas-y-faltantes.md).

**Decisi?n actual:** conservar Blender y usar tambi?n Moon Trek como mapa NASA; ver la actualizaci?n enlazada arriba.

## Cómo interpretar el estado

| Etiqueta | Significado |
| --- | --- |
| Implementado | Se identificó código que realiza la función. |
| Verificado | Se ejecutó una comprobación; se indica si fue sintética, compilación o navegador/API. |
| Histórico | Resultado mencionado en una etapa anterior; no implica vigencia en el código actual. |
| Propuesto | Diseño o trabajo pendiente, sin afirmarlo operativo. |
| No localizado | No aparece en el corte inspeccionado; puede estar en otra rama o equipo. |

**Lectura de estado:** hay una demostración funcional conectada y un motor regional útil. No hay base suficiente para presentar una decisión segura de alunizaje. La auditoría detecta defectos concretos en energía, ranking y coherencia visual, además de brechas de trazabilidad. Que pasen las pruebas existentes no elimina esos defectos.

La wiki vive en el repositorio para revisarse junto al código. No se creó ni publicó un repositorio separado de GitHub Wiki. No se modificó el motor durante esta revisión.
