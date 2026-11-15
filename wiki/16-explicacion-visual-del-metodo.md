# Explicación visual de Datos y método

El usuario pidió que una visita nueva entienda el funcionamiento en aproximadamente diez segundos, además de poder consultar las fuentes científicas. Se añadió al inicio de «Datos y método» un bloque de tres ilustraciones SVG, con textos cortos y flechas:

1. **Eliges dónde y cuándo:** un globo con coordenada y calendario. Acepta puntos manuales o generados; no presenta el catálogo como única posibilidad.
2. **Comprobamos qué se ve:** un perfil de terreno, observador, Sol y Tierra. Horizons proporciona las posiciones y LOLA permite comprobar la ocultación por el relieve.
3. **Encontramos cuándo coinciden:** barras de Sol, Tierra y su intersección. El motor repite cálculos y compara las ventanas con los requisitos.

Los botones «Sol oculto» y «Sol visible» cambian el dibujo, su descripción accesible, el mensaje y el indicador temporal. El esquema muestra por qué estar por encima del horizonte plano no garantiza superar una montaña. No consulta APIs ni modifica escenarios del explorador.

El bloque indica expresamente que las posiciones y tiempos son ilustrativos y sin escala. No son resultados reales ni un cálculo orbital. La IA interpreta; el motor calcula con datos NASA. Las tarjetas de fuentes y las limitaciones permanecen debajo; se actualizó su texto LOLA para explicar 20/240 m según cobertura.

## Ubicación y mantenimiento

- `frontend/src/MethodExplainer.tsx`: dibujos nativos, textos y estado local del ejemplo.
- `frontend/src/method-explainer.css`: diseño en tres columnas, distribución vertical móvil, controles y foco visible.
- `frontend/src/App.tsx`: inserción en la pestaña de fuentes, cabecera más compacta solo en esa vista y texto actualizado de terreno.

No se generaron imágenes raster ni se añadieron dependencias. Los SVG se adaptan al ancho y tienen descripciones para lectores de pantalla. El significado también se expresa en etiquetas y texto, además del color.

## Verificación

Compilación TypeScript/Vite correcta. Recorrido de navegador comprobó los tres diagramas, ambos estados del botón, activación con Enter, ausencia de errores JavaScript y ausencia de desbordamiento a 390 px. Se inspeccionaron capturas de escritorio y móvil; están en `frontend/artifacts/` local, excluido de Git. [Informe de la comprobación](../docs/VALIDACION_METODO_VISUAL.json).

La meta de comprensión en diez segundos es una intención de diseño: no se midió todavía con visitantes nuevos. No se repitieron validaciones científicas porque el motor y sus contratos no cambiaron. La advertencia existente de tamaño del paquete JavaScript sigue pendiente.
