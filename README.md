# LunarPath — Lunar Landing Site Navigator

Explorador lunar 3D y comparación de oportunidades de iluminación y visibilidad de la Tierra para el polo sur lunar.

- **Cartografía:** NASA Moon Trek / LRO WAC.
- **Efemérides:** NASA/JPL Horizons.
- **Relieve y horizonte:** NASA PDS LOLA, con acceso adicional a catálogos PGDA.
- **Aplicación:** React, TypeScript, Three.js, FastAPI y Python.

Consulta [arranque, arquitectura, fuentes, verificación y límites](docs/INTEGRACION_EXPLORADOR_3D.md).

Puertos locales usados: frontend `http://127.0.0.1:5174`, backend y Swagger `http://127.0.0.1:8000/docs`.

El sistema compara condiciones bajo un modelo explícito. No certifica seguridad de alunizaje ni disponibilidad real de un enlace de comunicaciones.
