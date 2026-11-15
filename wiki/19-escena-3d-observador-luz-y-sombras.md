# Observador, astros y luz en la escena 3D

El usuario señaló que en la vista de terreno no se distinguía el origen de las direcciones y que el Sol/Tierra eran pequeños. Pidió astros más visibles, luz/sombra perceptible y publicación después de probar. Se conservan los modelos existentes y los cálculos NASA; cambia su representación.

## Cómo se lee la escena

- **Baliza verde y «TU PUNTO»:** identifican el observador. Su centro se ancla a la altura científica DEM + observador devuelta por la API. El aro y el mástil son un símbolo ampliado para localizarlo; no son una nave ni una base física de ese tamaño.
- **Amarillo, Sol → punto:** representa la llegada de la luz. La flecha se invirtió respecto a la versión anterior para que apunte al observador. En la vista local, pequeñas partículas refuerzan el sentido; se quedan estáticas con movimiento reducido.
- **Azul, punto → Tierra:** representa la dirección de vista hacia la Tierra, no la capacidad de un enlace de comunicaciones.
- **Discontinuo:** astro oculto según las muestras del horizonte científico; el modelo del cuerpo se vuelve tenue. Los indicadores usan los valores reales de visibilidad/disco parcial.
- **Controles:** «Tu punto» recupera el encuadre del conjunto; «Sol»/«Tierra» enfocan el cuerpo; «Astros grandes» cambia solo escala visual; «Sombras» activa/desactiva sombras locales.

Los astros se ampliaron y tienen etiquetas legibles. La cámara considera la malla y los cuerpos al encuadrar y se adapta al ancho móvil. Las etiquetas ajenas se ocultan al enfocar un astro, evitando texto gigante superpuesto. La baliza mantiene legibilidad mínima en pantalla sin desplazar su coordenada científica.

## Iluminación y fidelidad

El Sol es emisivo y tiene un halo ilustrativo; la Tierra refleja la luz direccional y permite apreciar zonas iluminadas/oscuras. La dirección de esa luz procede del azimut/elevación Horizons del instante seleccionado, transformados al marco del visor. La iluminación se actualiza con el tiempo del análisis; no se inventa una fecha ni posición cuando no hay muestras.

El terreno local ahora **proyecta y recibe sombras**, con PCFShadowMap de 2048 × 2048. Se ajusta la cámara de sombras al área y se recalcula el mapa cuando cambian luz, malla o configuración, en vez de generar sombras innecesariamente en cada fotograma. Se libera el recurso al desmontar. Se redujo la luz ambiental para conservar contraste, manteniendo una iluminación de apoyo para leer el relieve.

**Límites visibles y científicos:** tamaños y distancias de cuerpos/baliza son simbólicos, no sus diámetros angulares reales. Las sombras de la imagen corresponden a la malla local; el cálculo de visibilidad incluye obstáculos hasta 250 km que pueden quedar fuera del encuadre. Una ladera iluminada del recorte no implica que el punto elegido esté iluminado. La fase de la Tierra es una representación visual según la dirección solar, no una solución completa de orientación terrestre, radiometría o luz reflejada de la Tierra sobre la Luna.

La malla se selecciona también según la fuente del resultado para alinear la altura del observador con el DEM fino cuando corresponde. Se verificó el caso (-87.67°, 0°), cercano al cambio de cobertura. Se corrigieron etiquetas fijas de 240 m: el crédito y la ficha informan la resolución real, y el detalle indica 20/240 m cuando el horizonte combina productos. Las leyendas distinguen luz entrante y vista saliente.

## Ubicación

| Archivo | Cambio |
| --- | --- |
| `frontend/src/MoonScene.tsx` | Baliza, tamaño/modelos, luz, sombras, dirección de flechas, enfoque, accesibilidad de movimiento y diagnóstico verificable. |
| `frontend/src/scene-clarity.css` | Indicadores de dirección, controles, leyenda de iluminación y distribución móvil. |
| `frontend/src/App.tsx` | Selección de malla coherente con la fuente fina y textos de resolución/direcciones. |
| `frontend/tests/terrain-lighting.e2e.mjs` | Prueba de render con API y DEM reales; prueba de caso en el límite de cobertura. |

No se modificó el motor del backend, sus umbrales ni las métricas para lograr un efecto visual. Tampoco se añadieron dependencias o nuevos modelos GLB.

## Pruebas ejecutadas

```powershell
# Backend
.venv/Scripts/python -m pytest -q
# Frontend con API y Vite locales activos
npm run build
node tests/terrain-lighting.e2e.mjs
node tests/explorer.e2e.mjs
node tests/failure-cases.mjs
```

- **59 pruebas backend aprobadas** y build correcto. Permanece la advertencia de tamaño del paquete; no se certificó rendimiento en dispositivos modestos reales.
- Evaluación real de (-89°, 0°), 15–22 de noviembre de 2026: se comprobaron un instante oculto y otro visible, sin simular posiciones ni terreno. Se permite la caché NASA existente.
- Radio del observador coincide con la altura DEM devuelta; las direcciones renderizadas coinciden con los ángulos API mediante un cálculo de referencia en la prueba.
- Luz alineada con el Sol, flecha solar hacia el observador y flecha de vista hacia Tierra comprobadas numéricamente.
- Se compararon píxeles del canvas con sombras activas/inactivas, con partículas estáticas y cámara estable: más de 21.000 píxeles cambiaron. Se verifica efecto renderizado, no únicamente la bandera de configuración.
- Astros ampliados, enfoque de Tierra y vuelta al conjunto comprobados. Los diámetros de proyección diagnósticos fueron aproximadamente Sol 131 px/Tierra 88 px en escritorio y 51/37 px en móvil; son escalas de dibujo, no medidas astronómicas.
- En (-87.67°, 0°) se comprobó resultado multirresolución, malla 20 m y altura de observador concordante.
- Enfoque, escala, sombras y cambio de muestra no generaron nuevas evaluaciones científicas. El test hizo dos evaluaciones para sus dos coordenadas.
- Vista móvil de 390 px sin desbordamiento, sin errores JavaScript ni advertencias de render en el recorrido nuevo.
- Recorrido general del explorador correcto y cuatro fallos simulados explícitos: backend, evaluación, malla y modelo Blender.

[Informe verificable](../docs/VALIDACION_ESCENA_LUZ_SOMBRAS.json). Capturas inspeccionadas de vista local, móvil y enfoque de Tierra en `frontend/artifacts/`, excluido de Git. La comprobación no reemplaza las validaciones científicas de ventanas descritas en las páginas anteriores.
