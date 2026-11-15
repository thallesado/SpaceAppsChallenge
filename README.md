# LunarPath — Lunar Landing Site Navigator

Explorador lunar 3D y comparación de oportunidades de iluminación y visibilidad de la Tierra para el polo sur lunar.

- **Visor 3D:** modelo Blender MOON_ME (`frontend/public/luna/luna_cientifica.glb`), cargado localmente sin solicitar teselas Moon Trek en ejecución. El asset incluye mapas de albedo/relieve visual; no sustituye los datos de terreno del análisis.
- **Terreno analítico:** NASA PDS LOLA; el modelo incluye cartografía de procedencia NASA, incluida Moon Trek / LRO WAC.
- **Efemérides:** NASA/JPL Horizons.
- **Relieve y horizonte:** NASA PDS LOLA, con acceso adicional a catálogos PGDA.
- **Aplicación:** React, TypeScript, Three.js, FastAPI y Python.

Consulta [arranque, arquitectura, fuentes, verificación y límites](docs/INTEGRACION_EXPLORADOR_3D.md).

Puertos locales usados: frontend `http://127.0.0.1:5174`, backend y Swagger `http://127.0.0.1:8000/docs`.

El sistema compara condiciones bajo un modelo explícito. No certifica seguridad de alunizaje ni disponibilidad real de un enlace de comunicaciones.
