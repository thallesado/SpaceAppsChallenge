> Documento de un corte historico. Para el estado actual consultar [Estado vigente](14-estado-y-pendientes.md) y [Registro de entregas](15-registro-de-entregas.md).

# Auditoría de código

[Índice](README.md) · [Plan priorizado](08-plan-del-equipo.md) · [Evidencia JSON](evidencias/auditoria-257c287.json)

**Corte:** `257c287`. Se revisaron backend, contratos, visor, integración, pruebas, GLB e historia. Se ejecutaron las 33 pruebas existentes, compilación y recorrido Chromium con API. Se añadieron reproducciones sintéticas aisladas; **no se corrigió código de producción** en esta auditoría.

## Conclusión

La demostración vertical funciona y la separación frontend/backend es aprovechable. La fuente temporal compartida y los fallos explícitos son buenas bases. Sin embargo, hay defectos que impiden llamar científicamente confiables a todas las funciones publicadas. Los problemas de energía y ranking existen aunque la interfaz principal no use todavía esos endpoints adicionales.

Prioridad P1: corregir antes de usar esa función para justificar una recomendación. P2: corregir antes de ampliar precisión, exponerla como capacidad científica o desplegarla de forma más general. Las brechas de validación se distinguen de errores reproducidos.

## A01 P1 Energía integrada con el paso equivocado

**Confirmado mediante reproducción sintética.** [power.py, línea 54](../backend/app/power.py#L54) toma `scenario.step_minutes` y lo aplica a cada muestra. Con refinamiento, las muestras tienen otro intervalo efectivo. Tampoco recorta correctamente el último intervalo parcial.

Caso reproducido: periodo de 2 h, carga constante de 100 W, 24 muestras de 5 min y paso base de 60 min. El consumo correcto es **0,2 kWh**; el módulo devuelve **2,4 kWh**, 12 veces más. La batería y el diagnóstico heredan ese error.

**Acción:** integrar duraciones entre timestamps y el final real, o sobre segmentos coherentes; incluir el instante inicial y verificar energía para pasos normal/refinado y final parcial. No basta cambiar el texto del resumen. Separar además reserva eléctrica, continuidad del servicio y pérdida de comunicación; `blackout_hours_supported` no está calculando autonomía.

## A02 P1 Origen visual distinto del observador fisico

**Confirmado por inspección y escala.** [MoonScene.tsx, línea 190](../frontend/src/MoonScene.tsx#L190) usa `surfacePosition` del GLB más `0.0015 + 0.0005` unidades para el marcador y las flechas. Una unidad equivale al radio lunar de 1 737,4 km: el desplazamiento añadido equivale a **3,4748 km** sobre esa superficie visual.

Al cambiar a vista local se oculta el GLB y se muestra la malla DEM, pero el origen sigue calculándose sobre el GLB. `site_height_km_used` interviene en una clave de actualización y no determina ese origen. El análisis usa 2 m sobre el DEM.

No se afirma que la discrepancia final con el DEM sea exactamente 3,4748 km: también depende de la diferencia GLB–DEM. Sí está confirmado que las dos posiciones no comparten una construcción física.

**Acción:** usar la misma coordenada/altura científica para observador, flechas y gráfico; separar explícitamente el offset cosmético del icono y nunca reutilizarlo para el origen físico. Validar mediante puntos de control y mediciones en ambas vistas.

## A03 P1 Ranking ponderado puede recomendar una opción inválida

**Confirmado sintéticamente.** [ranking.py, líneas 76 y 125](../backend/app/ranking.py#L76) penaliza incumplimiento multiplicando por 0,85 y luego ordena solo por puntuación.

Con un límite de oscuridad de 0,5 h, la reproducción devuelve primero una alternativa que lo viola con **63,8 puntos**, frente a otra que sí cumple con **57,5**. `best_site` y el resumen recomiendan la primera.

El problema afecta `/scenarios/rank`; **no se reproduce en `/scenarios/search`**, utilizado por la UI, que prioriza cumplimiento. La existencia de dos políticas sin una distinción fuerte puede causar regresiones al conectarlas.

**Acción:** filtrar elegibilidad o ordenar cumplimiento antes de puntuar; manejar ninguna factible, empates y condiciones homogéneas. El score es una heurística declarada, no probabilidad de éxito.

## A04 P2 Endpoint directo de efemérides valida menos que evaluate

**Confirmado con TestClient sin NASA.** [EphemerisRequest](../backend/app/models.py#L214) no impone orden/duración del periodo ni enumera objetos admitidos. [get_ephemeris](../backend/app/main.py#L181) solo procesa 10/399.

Una solicitud con inicio posterior al fin y `body_id=777` devuelve **HTTP 200**, `sun:null`, `earth:null`. El consumidor recibe éxito sin evaluación. Con objetos admitidos, rangos grandes evitan los límites de `Scenario` hasta alcanzar al proveedor externo.

**Acción:** restricciones compartidas de rango, número de muestras y objeto; responder 422 a solicitudes inválidas. No trasladar al proveedor la validación del producto.

## A05 P2 Caché fusiona ubicaciones distintas

**Confirmado por igualdad de claves.** [cache.py, línea 54](../backend/app/cache.py#L54) redondea latitud/longitud a cuatro decimales y altura a tres decimales de km. Las latitudes −89,50001 y −89,50002 generan la misma clave para el resto de parámetros idénticos.

La cuantización de latitud es de aproximadamente 3,03 m por 0,0001° sobre la esfera lunar; el ejemplo difiere unos 0,30 m. No se ha medido aquí un error grande de efemérides. El defecto es que una solicitud espacialmente diferente puede recibir una muestra de otra coordenada sin declarar esa aproximación, relevante para la futura sensibilidad espacial.

**Acción:** clave exacta/canónica o cuantización declarada como parte del modelo; pruebas de perturbaciones y migración/versionado de caché para evitar reutilizar resultados incompatibles.

## A06 P2 Procedencia e incertidumbre incompletas en API y CSV

**Brecha confirmada en contratos.** El resultado declara etiquetas de fuentes y paso, pero no un manifiesto con kernel, checksum/producto DEM, fecha del producto, resolución efectiva, algoritmo y versión. El horizonte solo devuelve azimut/elevación: falta obstáculo dominante, distancia y fuente por azimut.

El backend sí conserva brackets temporales en eventos, pero [plannerApi.ts](../frontend/src/plannerApi.ts) reduce el contrato frontend a segmentos. La UI no expone esos intervalos de incertidumbre. El CSV frontend [App.tsx, línea 84](../frontend/src/App.tsx#L84) y el backend [main.py, línea 392](../backend/app/main.py#L392) exportan muestras, sin toda la procedencia o incertidumbre espacial solicitada.

**Acción:** añadir campos opcionales documentados y conservarlos hasta exportación; mostrar `no evaluado` cuando no exista estimación. Esto es requisito pendiente, no una precisión ya validada.

## A07 P2 Falta trazabilidad verificable del GLB y del catálogo

**Brecha documental, no prueba de orientación errónea.** La inspección del GLB encuentra exportador Blender y ninguna sección `extras`; el hash figura en la evidencia. No se localizó una ficha que permita reconstruir DEM/textura, sus licencias, ejes, escala y transformación lunar. La etiqueta de UI «MOON_ME» se fija al cargar cualquier GLB exitosamente.

El [catálogo](../backend/app/catalog.py) incluye alturas estimadas y afirmaciones como seguridad, disponibilidad DSN o hielo confirmado sin referencias por punto y sin incertidumbre de coordenadas. La UI advierte que son referencias regionales, pero los consumidores de API pueden interpretar esos textos como hechos verificados.

**Acción:** manifiesto del asset y puntos de control; referencias y alcance por entrada del catálogo. Mantener separadas resolución del DEM, espaciado de malla y resolución de textura.

## Discrepancia D01: el plan recibido no coincide con este corte

El plan afirma DEM 20 m desde 87,5° S y reportes JSON. No se localizaron en Git, `backend/data` ni `docs`. El lector operativo solo soporta `LDEM_75S_240M`, y `/terrain/mesh` usa ese mismo objeto. No hay código de horizonte multirresolución.

La cifra de **11,12° en de Gerlache** no tiene aquí un informe que permita reproducirla. El plan puede corresponder a otra rama o carpeta: pedir commit, manifiesto y JSON antes de adoptarlo como baseline. Los JSON creados por **esta auditoría en `wiki/evidencias`** no son los reportes científicos que menciona el remitente.

## Comprobaciones y límites de esta revisión

| Comprobación | Resultado |
| --- | --- |
| Pruebas existentes | 33 pasan. No incluyen los contraejemplos anteriores. |
| Compilación TypeScript/Vite | Correcta; bundle JS principal aprox. 943 kB sin comprimir, con aviso de tamaño. |
| Reproducciones aisladas | Energía ×12, ranking inválido primero, cache collision, efemérides 200 inválido y offset 3D documentados en JSON. |
| Chromium con WebGL | Carga GLB, órbita, malla, análisis, comparación, guía y móvil sin overflow; sin errores de página. |
| Caso de navegador | La fecha inicial automática fue 15 nov UTC; seis alternativas, tres cumplen. No se generaliza a otros puntos/fechas. |
| DEM 20 m / reporte 11,12° | No localizados, por tanto no verificados. |
| Validación independiente de ventanas | No realizada; no disponible en el corte. |
| FPS en hardware modesto | No medido. Chromium headless no equivale a prueba en móvil físico. |

Repetir las reproducciones desde `backend`:

```powershell
.venv/Scripts/python scripts/audit_snapshot.py
```

El script no realiza consultas NASA ni altera datos de la aplicación. Las cifras son casos sintéticos identificados, no predicciones de una misión. Debe conservarse el commit del reporte al compararlo con versiones futuras.
