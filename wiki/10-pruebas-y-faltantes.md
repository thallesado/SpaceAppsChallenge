> Documento de un corte historico. Para el estado actual consultar [Estado vigente](14-estado-y-pendientes.md) y [Registro de entregas](15-registro-de-entregas.md).

# Pruebas y faltantes respecto al producto acordado

[Índice](README.md) · [Auditoría](07-auditoria.md) · [Plan técnico anterior](08-plan-del-equipo.md)

Actualización: **15 de noviembre de 2026**, corte `257c287`. Se mantiene **MOON Blender como visor definitivo**. Moon Trek queda fuera del alcance futuro por instrucción del usuario; sus adaptadores históricos no son un requisito ni justifican volver a cambiar el visor.

## Pruebas ejecutadas nuevamente

| Prueba | Resultado | Qué demuestra |
| --- | --- | --- |
| `python -m pytest -q` en backend | 33 pasan | Comportamientos cubiertos por la suite existente. |
| `scripts/audit_snapshot.py` | Contraejemplos reproducidos | Los errores de energía, ranking, validación y caché siguen presentes. No son reparaciones. |
| `npm run build` | Correcto | TypeScript y bundle válidos; permanece aviso de tamaño aprox. 943 kB JS sin comprimir. |
| `node tests/explorer.e2e.mjs` | Correcto | GLB, órbita, terreno, análisis, tiempo, seis alternativas, selección, horizonte, guía y móvil sin overflow ni errores de página. |
| `node tests/failure-cases.mjs` | Cuatro casos pasan | Backend inaccesible, respuesta 502, malla sin cobertura y GLB fallido producen mensajes explícitos. |
| Observación de red de los casos de fallo | 0 solicitudes Moon Trek | La UI actual no necesita ese servicio para ese recorrido. |

Los casos negativos son **fallos inyectados en el navegador**, no caídas reales NASA. El recorrido positivo utiliza el backend y resultados Horizons/LOLA, con caché permitida. No prueba exactitud científica, FPS ni hardware móvil real. [Evidencia guardada](evidencias/pruebas-2026-11-15.json).

## Estado del objetivo

| Lo que pidió el usuario | Estado actual | Falta para cumplirlo de forma sólida |
| --- | --- | --- |
| Navegar la Luna en 3D | GLB y cámara funcionan | Validar ejes/escala/georreferenciación y coherencia entre GLB y malla científica. |
| Sol/Tierra respecto al horizonte | Ángulos y perfil disponibles | Corregir origen físico de flechas; mostrar margen y obstáculo dominante. |
| Comparar lugares y fechas | Tres sitios, inicios 0/+3/+7 días | Buscar dentro de un intervalo completo con pasos declarados y presupuesto de muestras. |
| Recomendar cuándo alunizar | Cumplimiento de condiciones de un periodo | Definir instante propuesto, duración desde ese instante y requisitos necesarios. No equivale a seguridad de descenso. |
| Entendible por principiantes | Guía y explicaciones básicas | Explicar por qué falla cada requisito y cómo podría cambiarse el escenario. |
| Datos NASA funcionales | Horizons + LOLA/PDS; PGDA adicional | Trazabilidad exportable y validación independiente. Blender no cuenta como una tercera fuente NASA por sí solo. |
| Resultados confiables | Demostración funcional | Corregir defectos P1 y cuantificar límites antes de afirmar precisión. |

## P0 de entrega: reparar antes de añadir más funciones

1. **Energía:** integrar tiempo real entre muestras y final del periodo. Aceptación: 100 W durante 2 h consume 0,2 kWh tanto en muestreo normal como refinado.
2. **Observador 3D:** coordenadas y altura del DEM compartidas con el cálculo. El offset de un icono puede ser cosmético; no debe desplazar el origen físico de flechas. Aceptación: prueba numérica de origen y punto de control visual en globo/local.
3. **Ranking:** un resultado que incumple una restricción no debe desplazar a uno elegible por una puntuación mayor. Unificar o diferenciar claramente `/rank`, `/recommend` y `/search`.
4. **Contrato válido:** solicitudes inválidas no producen 200 con cuerpos nulos; proteger rango, muestras y objetos admitidos.
5. **Caché:** no confundir coordenadas distintas a la escala que se quiera estudiar, o declarar formalmente su cuantización.

La palabra P0 aquí significa orden de trabajo para esta entrega, no reclasificación de severidad de todos los hallazgos de la auditoría.

## Lo más importante que falta a nivel de producto

### Una fecha recomendada debe corresponder a una ventana concreta

Hoy `constraints_met` resume un periodo. Ese periodo puede empezar sin Sol o sin Tierra y contener una ventana favorable después. Eso es válido bajo el contrato actual, pero no demuestra que **el inicio elegido** sea un buen instante de alunizaje.

Propuesta: devolver la ventana recomendada con `inicio`, `fin`, `duración continua`, requisitos satisfechos y tiempo disponible desde el instante propuesto. Separar «analizar este periodo» de «buscar un instante de inicio». Si ninguna ventana cumple, declararlo.

Aceptación: un periodo cuyo primer tramo está bloqueado y cuyo último tramo es favorable no debe etiquetar el comienzo del periodo como inicio recomendado. La fecha sugerida debe ubicarse dentro de la ventana verificada.

### Explicar el porqué, no solo “cumple/no cumple”

Para cada alternativa mostrar:

- Requisito y valor: por ejemplo, «necesitas 6 h continuas; hay 4 h».
- Margen angular: elevación del cuerpo menos horizonte y margen configurado, con unidades.
- Obstrucción dominante y su distancia, cuando el backend la calcule.
- Una acción relevante: comparar otra fecha, cambiar sitio o revisar un requisito; no prometer que el cambio resolverá el problema sin evaluarlo.

No calcular otra recomendación científica en el frontend. La UI explica las métricas del motor.

### “Desconocido” debe existir de extremo a extremo

Los fallos básicos ya se muestran bien y no hay fallback demo en la UI principal. Falta modelar resultados parciales por sitio/azimut con cobertura y procedencia. Una zona no evaluada no debe convertirse en visibilidad cero o resultado favorable. La búsqueda actual falla como operación completa si una evaluación falla: decidir si se quieren alternativas parciales y cómo identificarlas.

### Cobertura y resolución deben estar visibles

Conservar Blender. Mostrar por separado:

- Modelo visual GLB y su manifiesto de procedencia.
- DEM científico 240 m y su cobertura.
- Espaciado real de la malla renderizada: 781,25 m en la petición actual de 50 km / 64 intervalos.
- Textura incorporada y resolución verificada; si no se conoce, declarar «no documentada».

El futuro DEM 20 m no se encontró en este corte. No es requisito para demostrar el MVP regional, pero sí debe localizarse y verificarse antes de prometer análisis con esa precisión.

### Comparaciones con incertidumbre real

Antes de mostrar rangos hay que calcularlos. Distinguir sensibilidad espacial, temporal y al DEM. No inventar «confianza 95%». Los brackets temporales existentes deben mostrarse y exportarse. Si diferencias entre alternativas quedan dentro de una tolerancia justificada, presentar empate o compromiso.

## Mejoras posteriores

1. Consulta de rango de fechas, filtros y selección de instante de actividad.
2. Escala/cursor/puntos de control sobre la malla Blender/LOLA; no reintroducir Moon Trek.
3. Guardar/compartir escenarios reproducibles y exportar JSON/CSV con fuentes, parámetros, versiones y límites.
4. Validación independiente de ventanas completas y manifiestos de datos.
5. Incertidumbre espacial y horizonte multirresolución, después de alinear productos.
6. Recursos de vehículo configurables: paneles, batería, carga y enlace como modelos separados.
7. Calidad adaptativa, FPS y memoria medidos en equipos modestos y móvil físico.

## Qué priorizaría para la hackathon

Primero corregir los defectos P1, asegurar el observador común y ofrecer una **ventana concreta con explicación**. Después completar trazabilidad y estados de cobertura. Eso fortalece la pregunta principal del reto más que añadir una IA conversacional, más decoración o un tercer proveedor por cantidad.

El sistema debe seguir hablando de oportunidades preliminares de iluminación/visibilidad. Convertirlo en evaluador integral de seguridad de alunizaje exige pendientes, rugosidad, obstáculos, descenso, vehículo, navegación y comunicaciones verificadas, fuera de lo que hoy calcula.
