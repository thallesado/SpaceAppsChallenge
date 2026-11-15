# Plan recibido del equipo

[Índice](../README.md) · [Contraste y prioridades](../08-plan-del-equipo.md)

Fuente: mensaje del usuario en esta conversación. Se normaliza el formato, conservando su contenido técnico. Es una declaración del equipo para contrastar, no prueba de que cada función esté en el commit auditado.

## Estado declarado

«Estado al 15 de noviembre de 2026»: interfaz API por defecto, sin sustitución de errores por métricas simuladas; operación con Horizons y LOLA 240 m; DEM 20 m para malla 3D desde 87,5° S hasta el polo; informes reproducibles en `VALIDACION_CIENTIFICA.md` y JSON del mismo directorio.

## Backend: prioridad científica

1. **Horizonte multirresolución.** Integrar 20 m en primeros kilómetros con cobertura completa; usar 240 m para montañas lejanas. Misma altura del observador y fuente/distancia del obstáculo dominante por azimut. Validar ventanas/métricas antes y después en sitios y fechas diferentes.
2. **Incertidumbre espacial.** Perturbar coordenadas en vecindad definida y medir rangos de visibilidad, pendientes y horizontes. Exponer incertidumbre por sitio en API/CSV. El mensaje cita diferencia de hasta 11,12° en el horizonte de una muestra de Gerlache.
3. **Ventanas completas.** Contrastar eventos y fracciones contra cálculos independientes. Registrar kernel, DEM, fecha de producto, datum, paso y método de interpolación.
4. **Recursos de misión.** Vincular luz/enlace con batería, carga y capacidad de comunicación configurables por vehículo; separar evaluación preliminar de decisión de aterrizaje.

## Frontend: prioridad de uso

1. **Mapa local continuo.** Paneo libre, escala, coordenadas de cursor y leyenda de cobertura. WAC/NAC/LOLA georreferenciadas; no presentar foto como sombra de fecha elegida. Reexaminar enlace Moon Trek generado por el propio portal en sesión limpia: el enlace sintetizado de de Gerlache restableció centro/zoom y se indica abrir el portal sin prometer centrado.
2. **Relieve detallado.** Textura NAC local georreferenciada, cobertura/licencia verificadas. Resoluciones DEM/textura separadas. Calidad adaptable y FPS en hardware modesto.
3. **Explicación.** Diferencia de elevación Sol/Tierra menos horizonte en el azimut, obstáculo dominante e intervalo temporal de incertidumbre de transiciones.
4. **Comparación con incertidumbre.** Rangos, cobertura y procedencia en tablas/exportaciones; evitar ganador único dentro del error estimado.

## Contratos propuestos por ambos equipos

- Campos opcionales y versionados en `/api/v1`, manteniendo adaptador durante migración.
- `sin cobertura` o `no evaluado` ante falta de DEM, efemérides o metadatos; nunca resultados de reserva.
- Acuerdo previo sobre m/km/grados, MOON_ME, proyección polar, UTC `[inicio, fin)` y fuente de cada valor.

## Qué no se pudo localizar

En el corte `257c287` no aparecen el DEM fino, el informe de 11,12°, los JSON referidos ni el enlace Moon Trek descrito. El globo carga Blender y su enlace principal apunta al asset GitHub. Se requiere la rama/commit de esos trabajos antes de usarlos como baseline común.
