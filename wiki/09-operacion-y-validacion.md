# Operación y validación

[Índice](README.md) · [Auditoría](07-auditoria.md)

## 1. Verificar qué versión se tiene

Desde la raíz:

```powershell
git status --short
git log -5 --oneline
git remote -v
git fetch spaceapps main
git log --oneline HEAD..spaceapps/main
```

En esta copia, `spaceapps` apunta a `thallesado/SpaceAppsChallenge` y `origin` al repositorio inicial de ELkin2624. En un clon nuevo, los nombres pueden ser otros. Confirmar la URL antes de descargar o publicar.

El corte de esta revisión coincide con `spaceapps/main`: `257c287`. Si aparecen cambios locales, preservarlos antes de actualizar. Esta auditoría no hizo push ni modificó el motor.

## 2. Preparar backend

Python recomendado: 3.12. Con uv:

```powershell
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe -e '.[dev]'
.venv/Scripts/python scripts/download_lola.py
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

La descarga instala el IMG PDS de 240 m y su LBL. No descarga el supuesto DEM 20 m del plan recibido. El GLB es un archivo distinto. No se requiere clave NASA para estas consultas, pero sí internet cuando no exista caché.

Swagger: `http://127.0.0.1:8000/docs`. `/health` solo verifica el proceso. `/api/v1/status` confirma el DEM instalado; no garantiza conectividad con NASA.

Opcionales en `.env`: `LUNARPATH_DEM_PATH`, `LUNARPATH_CACHE_DB`, `LUNARPATH_CACHE_ENABLED` y `LUNARPATH_CORS_ORIGINS`. No versionar `.env`, cachés o dependencias. El lector DEM actual es específico del producto PDS validado por su etiqueta, no un lector universal de cualquier DEM con esa variable.

## 3. Preparar frontend

En otra terminal:

```powershell
cd frontend
npm ci
./node_modules/.bin/vite.cmd --host 127.0.0.1 --port 5174
```

Abrir `http://127.0.0.1:5174`. El proxy `/api` apunta a `127.0.0.1:8000`. El cliente principal no necesita `VITE_USE_API=true`; esa bandera pertenece al código legacy. Para cambiar backend, configurar `VITE_API_BASE_URL` y CORS de forma coherente.

El repo conserva un lock de pnpm además del de npm. Los comandos verificados en esta revisión usan **npm/package-lock**, no se verificó equivalencia del lock pnpm tras agregar Three.js/Playwright.

## 4. Ejecutar verificaciones

Backend:

```powershell
.venv/Scripts/python -m pytest -q
.venv/Scripts/python scripts/audit_snapshot.py
```

La primera orden ejecutó 33 pruebas existentes. La segunda reproduce contraejemplos sintéticos y escribe un reporte de auditoría: no debe interpretarse como una suite que certifica ausencia de errores. Los hallazgos actuales siguen presentes.

Frontend:

```powershell
npm run build
node tests/explorer.e2e.mjs
```

E2E necesita frontend/backend activos y Chromium de Playwright. Puede reutilizar un navegador Windows instalado o recibir `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Si no existe navegador compatible: `npx playwright install chromium`.

El E2E carga GLB, cambia la órbita, analiza, mueve el cursor, cambia a terreno, compara alternativas, elige una, consulta fuentes, abre/cierra guía y revisa overflow móvil. Comprueba errores de página; no mide FPS ni valida orientación geodésica, exactitud de ventanas o correspondencia visual a 2 m.

## 5. Verificaciones NASA opcionales

```powershell
.venv/Scripts/python scripts/verify_live.py
$env:PYTHONPATH = '.'
.venv/Scripts/python scripts/validate_science.py
```

Se ejecutan desde `backend`. `verify_live.py` verifica adaptadores NASA y lee bloques de un GeoTIFF PGDA. `validate_science.py` necesita `app` en el path; no añade por sí mismo la raíz del backend al `sys.path`, por eso se muestra la variable. El script imprime JSON: para conservarlo, redirigir a un archivo identificando commit y momento de ejecución.

Estos comandos no se repitieron completos durante esta auditoría; sí se ejecutó el navegador contra el backend y sus datos Horizons/LOLA, permitiendo caché. Los informes históricos no sustituyen una comparación independiente de ventanas.

## 6. Evidencia de esta revisión

| Evidencia | Archivo/resultado |
| --- | --- |
| Contraejemplos deterministas | [auditoria-257c287.json](evidencias/auditoria-257c287.json). |
| Resumen de ejecución | [verificacion-257c287.json](evidencias/verificacion-257c287.json). |
| Capturas de navegador | `frontend/artifacts/`, local e ignorado por Git. |
| Pruebas backend | 33 pasan; una advertencia de deprecación de TestClient/httpx. |
| Build | Correcto; advertencia de bundle principal grande. |
| Navegador | Sin errores de página ni overflow móvil en el recorrido ejecutado. |

No hay evidencia aquí de móvil físico, producción, rendimiento en hardware modesto o precisión espacial de 20 m. La ausencia de un error visual en una captura no demuestra que el origen del marcador sea físicamente correcto.

## 7. Mantener esta wiki

- Registrar el SHA al cambiar baseline.
- Actualizar código, contrato y documentación juntos.
- Conservar reportes con parámetros, método y fuente; distinguir sintético de NASA/cache y de validación independiente.
- No presentar cifras de una conversación o capturas antiguas como mediciones actuales.
- Validar enlaces locales con `python scripts/validate_wiki.py` desde la raíz.
