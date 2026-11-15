# Evaluación del próximo trabajo en paralelo

> Actualización del 15 de noviembre: el usuario decidió mantener MOON Blender y no usar Moon Trek. Las tareas de ese portal descritas en el plan recibido quedan fuera del alcance. El plan vigente está en [pruebas y faltantes](10-pruebas-y-faltantes.md).

[Índice](README.md) · [Texto recibido](fuentes/plan-recibido.md) · [Auditoría](07-auditoria.md)

El plan está bien orientado: prioriza multirresolución, incertidumbre espacial, ventanas completas y explicación de resultados. La separación de tareas visuales/científicas es razonable. **Su baseline no puede darse por confirmado** en `257c287`: faltan el DEM 20 m declarado y sus informes.

## Orden recomendado

| Etapa | Backend | Frontend | Criterio de salida |
| --- | --- | --- | --- |
| 0. Alinear baseline | Localizar commit/archivos del estado descrito; manifiesto, hash y reportes. | Identificar exactamente el asset y la malla renderizados. | Todos auditan el mismo SHA y conocen la cobertura real. |
| 1. Corregir defectos | A01 energía, A03 ranking, A04 validación y A05 caché. | A02 origen físico y offset cosmético; no alterar fórmulas científicas en UI. | Contraejemplos dejan de fallar y pruebas de regresión pasan. |
| 2. Contrato de procedencia | Campos opcionales/versionados y errores de cobertura. | Mostrar fuente, cobertura, margen sobre horizonte y desconocido. | Fixture compartida y esquema OpenAPI/cliente coherentes. |
| 3. Multirresolución | DEM fino cerca, grueso lejos; misma altura; máximo dominante por azimut. | Representar fuente/distancia del obstáculo; leyenda separada de textura/DEM. | Comparación antes/después en varios sitios y fechas, con reportes. |
| 4. Incertidumbre | Vecindades y rangos; conservar qué parte no fue evaluada. | Rangos y empates; no ganador único dentro de tolerancia. | Casos de frontera con cobertura parcial y cambios de elegibilidad. |
| 5. Recursos y uso | Vehículos, batería, carga, enlace, supuestos explícitos. | Paneo, escala, cursor, calidad adaptativa y medición de FPS. | Unidades verificadas y prueba en dispositivos reales. |

La validación independiente de ventanas debe comenzar desde la etapa 2 y acompañar las siguientes, no posponerse hasta tener toda la interfaz.

## Horizonte multirresolución: aceptación mínima

1. Verificar datum, proyección, coordenadas de píxel y nodata de ambos productos. Documentar radio/marco y transformación.
2. Obtener una sola altura física del observador; evitar saltos artificiales al cambiar de DEM.
3. Usar el producto fino solo donde sitio y tramo requerido tengan cobertura completa. Declarar el tramo usado y cualquier fallback al grueso.
4. Retener azimut, elevación máxima, distancia del obstáculo, DEM que lo produjo y resolución/interpolación.
5. Probar transiciones de cobertura y distancia de mezcla; demostrar que la mezcla no elimina montañas lejanas.
6. Comparar ventanas, fracciones e interrupciones antes/después y sensibilidad a pasos de rayos, azimut y tiempo.

No usar el hecho de que `/terrain/elevation` pueda leer un GeoTIFF como prueba de integración multirresolución del horizonte.

## Incertidumbre espacial: aceptación mínima

- Definir radio de vecindad, estrategia de muestras y número de puntos; no llamarlo intervalo de confianza probabilístico sin modelo estadístico.
- Reportar rangos y cobertura evaluada para ventanas, pendientes y horizontes.
- Mantener coordenadas de cada muestra, hash/versiones y resolución.
- Asegurar que la caché no colapse perturbaciones distintas sin declararlo.
- Diferenciar «no cumple», «sin cobertura» y «no evaluado».

## Frontend y Moon Trek

El mapa continuo y la textura NAC son propuestas, no funciones actuales. El globo actual es GLB; la malla local no lleva textura NAC. Paneo libre ya está habilitado en OrbitControls (`enablePan=true`), pero no equivale a un mapa científico continuo con escala/cursor/cobertura.

El enlace compartido que supuestamente falló no se pudo reconstruir desde este corte: `App.tsx` enlaza al asset en GitHub, no a un enlace Moon Trek centrado. Para retomar esa tarea se necesita el enlace exacto generado por el portal y prueba en sesión limpia. No prometer centrado a partir de parámetros inventados.

## Contrato de colaboración propuesto

Mantener `/api/v1`, adaptador legacy y nuevos campos opcionales. Pactar antes de implementar:

- Grados, m, km, horas y fracciones frente a porcentajes.
- Marco lunar, datum, radio y convención de longitud.
- Intervalos UTC `[inicio, fin)`, resolución efectiva y brackets de transición.
- `evaluated`, `no_coverage`, `not_evaluated` como estados distintos; los nombres son propuesta, no schema actual.
- Identificadores de producto, checksum, fuente, versión de algoritmo y consulta.
- Fixtures de resultado válido, ausencia de cobertura, incertidumbre, empate y ninguna opción factible.

No deben implementarse a la vez dos cambios incompatibles en `models.py` y `plannerApi.ts` sin un contrato revisado. La propiedad de `features/insights` puede mantenerse separada de integración/backend.
