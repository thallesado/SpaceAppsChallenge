# Corrección del repositorio auditado

[Índice](README.md)

**15 de noviembre de 2026.** El usuario aclaró que el repositorio a revisar es `https://github.com/ELkin2624/Lunar-Landing-Site-Navigator`, no `thallesado/SpaceAppsChallenge`.

## Alcance corregido

Se descargó `origin/main`, commit **`fbe2a7b`**, en una copia aislada: `../Lunar-audit-elkin`. La copia principal, sus cambios locales y la documentación anterior se preservaron.

La auditoría anterior de `257c287` sigue siendo histórica y válida únicamente para ese corte. **No debe utilizarse como diagnóstico completo del main de ELkin2624.** Sus cifras de pruebas y observaciones visuales no se trasladan automáticamente.

## Correcciones a las conclusiones anteriores

| Observación anterior | Estado en `fbe2a7b` |
| --- | --- |
| No se encontraron DEM 20 m ni informes JSON. | Se retira para este repositorio: hay soporte de `LDEM_875S_20M`, etiqueta PDS, descarga y JSON de validación. El IMG no está versionado y requiere descarga. |
| No hay reporte de diferencia 11,12° en de Gerlache. | Sí existe en `docs/VALIDACION_DEM_20M.json`: diferencia media absoluta del horizonte de 11,118…° en el caso documentado. No se reejecutó esa validación durante esta corrección. |
| No hay contraste SPICE/órbita independiente. | Hay scripts y `VALIDACION_SPICE.json`, con kernels, hashes y comparación INPOP19a. La orientación lunar es compartida y aún no se validan ventanas topográficas completas. |
| Flechas usan `MoonScene.tsx` y offset 3,47 km. | Ese archivo no existe aquí: se utiliza `Terrain3D.tsx`. No trasladar el defecto exacto al nuevo visor sin una revisión específica. |
| La UI no consume Moon Trek. | Este main sí tiene `LocalTileMap` y teselas Moon Trek en `moontrek.ts`, además de enlaces al portal. Entra en conflicto con la decisión reciente del usuario de conservar Blender y no usar Moon Trek. |

## Qué contiene la nueva versión

- Catálogo con referencias IAU revisadas.
- Malla local que selecciona DEM 20 m donde la ventana cabe en cobertura; operación del horizonte todavía a 240 m.
- Cálculo de pendientes y pruebas correspondientes.
- Informes de resolución, DEM fino y contraste SPICE.
- Modelos Blender de Luna, Tierra y Sol, cuerpos interactivos y carga orbital.
- Mapa polar/local con capas de Moon Trek.
- Carga diferida de componentes 3D.

## Pruebas ejecutadas en la copia correcta

- Entorno Python 3.12 aislado e instalación de dependencias declaradas.
- **28 pruebas backend pasan**, con una advertencia TestClient/httpx.
- **`npm ci` y `npm run build` correctos**. Permanece aviso de tamaño del chunk gráfico.

No se descargaron de nuevo los DEM grandes ni los kernels binarios, no se repitieron los scripts SPICE y no se realizó un recorrido en navegador de este nuevo frontend. Los JSON se verificaron como documentos existentes, no como resultados recalculados aquí.

## Hallazgos que requieren atención en este main

Por inspección, `power.py` sigue usando `scenario.step_minutes` para integrar cada muestra; `ranking.py` sigue penalizando incumplimiento por 0,85 y ordenando por score; `cache.py` conserva redondeo espacial en su clave. Las causas detectadas anteriormente siguen presentes, aunque falta registrar reproducciones adaptadas a este corte.

El visor nuevo aplica exageración vertical ×3 a la malla local. Esa visualización debe distinguirse de pendientes/ángulos físicos al explicar el horizonte. Su anclaje y transformación necesitan una auditoría específica; no basta reutilizar la conclusión del visor eliminado.

## Relación entre las ramas

El ancestro común del corte anterior y `fbe2a7b` es **`506f881`**. `git merge-base --is-ancestor` indica que ni `41efb24` ni `257c287` son antecesores del main de ELkin2624.

Esto demuestra que nuestras entregas no están fusionadas como esos commits. No descarta que colegas hayan reutilizado manualmente ideas o código. Las dos líneas comparten la base inicial y han evolucionado de manera diferente; no se debe sobrescribir una con la otra sin comparar contratos y funciones.

**Decisión vigente:** seguir con MOON Blender; las dependencias Moon Trek presentes en esta línea deben identificarse y sustituirse o desactivarse en un cambio posterior. La corrección de alcance no realizó esa migración ni mezcló ramas.
