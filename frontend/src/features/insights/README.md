# Paneles de Insights

Componentes visuales React + TypeScript para comparar alternativas lunares, explicar el horizonte y mostrar una guía breve. Todos reciben datos por props: no realizan solicitudes, no modifican rutas y no controlan el visor 3D.

## Integración mínima

```tsx
import { ResultsPanel, HorizonPanel, GuidePanel } from './features/insights'
import type { Body, Option } from './features/insights'

function Insights({
  options,
  selectedIndex,
  selectOption,
  profile,
  sample,
  guideOpen,
  closeGuide,
}: {
  options: Option[]
  selectedIndex: number | null
  selectOption: (index: number) => void
  profile: { azimuth_deg: number; elevation_deg: number }[] | null
  sample: { sun: Body; earth: Body } | null
  guideOpen: boolean
  closeGuide: () => void
}) {
  return (
    <>
      <ResultsPanel
        options={options}
        selectedIndex={selectedIndex}
        requiredHours={24}
        loading={false}
        error={null}
        onSelect={selectOption}
      />
      <HorizonPanel
        profile={profile}
        sample={sample}
        timeUtc={null}
        source="LOLA/PDS"
        loading={false}
        error={null}
      />
      <GuidePanel open={guideOpen} onClose={closeGuide} />
    </>
  )
}
```

`Body` se exporta junto a los componentes y contiene los ángulos, estado de visibilidad y datos del disco. `Option` y los contratos completos de entrada están en `types.ts`.

## Props

- **ResultsPanel**: `options`, `selectedIndex`, `requiredHours`, `loading`, `error`, `onSelect`. Mantiene el orden recibido, diferencia porcentajes de duraciones continuas, identifica empates en las métricas mostradas y presenta las ventanas en UTC.
- **HorizonPanel**: `profile`, `sample`, `timeUtc`, `source`, `loading`, `error`. Usa SVG nativo. Un perfil nulo solo se representa como geométrico cuando la fuente lo indica; si la fuente es de terreno, deja claro que ese perfil falta.
- **GuidePanel**: `open`, `onClose`. Diálogo con cierre mediante Escape, foco inicial, ciclo de Tab y restauración del foco anterior.

## Estilos y dependencias

- `insights.css` se importa una sola vez desde `index.ts`; todos los selectores están limitados a clases `insights-`.
- Usa React, TypeScript y `lucide-react`, ya disponibles en el frontend. El gráfico usa SVG nativo y no requiere una biblioteca de visualización.
- Los colores de Sol, Tierra y coincidencia son ámbar, cian y verde, respectivamente; también se muestran etiquetas textuales.

## Verificaciones y limitaciones

- Verificado con `tsc --noEmit --project frontend/tsconfig.json` desde `frontend/`, sin errores de TypeScript. No se instalaron dependencias ni se generaron artefactos de compilación.
- Se contemplan opciones vacías, carga, error, ausencia de cumplimiento, métricas empatadas, cero o 100 %, periodos UTC, una o varias ventanas, y etiquetas extensas.
- El perfil y las posiciones se representan con sus elevaciones reales; el dominio del gráfico se amplía con esos datos para no ocultar valores extremos. No se estiman montañas ni se infiere un perfil de terreno faltante.
- La guía no evalúa seguridad de aterrizaje. La visibilidad geométrica tampoco garantiza una comunicación real.
- No se añadieron pruebas automatizadas de interacción: el proyecto no proporciona un ejecutor de pruebas React para esta carpeta. No se han integrado APIs NASA ni el visor.
