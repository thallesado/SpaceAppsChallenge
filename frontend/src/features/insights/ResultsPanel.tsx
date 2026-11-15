import VisibilityVisuals from '../../VisibilityVisuals'
import {
  AlertTriangle,
  CheckCircle,
  Loader,
  Search,
  XCircle,
} from 'lucide-react'
import type { Option, ResultsPanelProps, Window } from './types'

const utcDateTime = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
})

function formatUtc(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? `${value} (UTC; fecha no reconocida)`
    : `${utcDateTime.format(date)} UTC`
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : 'No disponible'
}

function siteName(option: Option): string {
  const label = option.site.label?.trim()
  return label || `${formatCoordinate(option.site.latitude_deg)}°, ${formatCoordinate(option.site.longitude_deg)}°`
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return 'No disponible'
  if (hours < 1) return `${Math.round(hours * 60)} min`
  return `${hours.toFixed(1)} h`
}

function getTiedMetrics(options: Option[]): string[] {
  const metrics = [
    { label: 'visibilidad del Sol', value: (option: Option) => option.result.metrics.sunlit_fraction },
    { label: 'visibilidad de la Tierra', value: (option: Option) => option.result.metrics.earth_visible_fraction },
    { label: 'duración continua máxima', value: (option: Option) => option.result.metrics.longest_concurrent_hours },
  ]

  return metrics
    .filter(({ value }) => {
      const values = options.map(value).filter(Number.isFinite)
      return values.length > 1 && new Set(values).size < values.length
    })
    .map(({ label }) => label)
}

export function ResultsPanel({
  options,
  selectedIndex,
  requiredHours,
  loading,
  error,
  onSelect,
}: ResultsPanelProps) {
  const tiedMetrics = getTiedMetrics(options)
  const noOptionMeetsConditions = options.length > 0
    && !options.some((option) => option.result.metrics.constraints_met)

  return (
    <section className="insights-root insights-results" aria-labelledby="insights-results-title">
      <header className="insights-panel-header">
        <div>
          <p className="insights-eyebrow">Comparación de sitios</p>
          <h2 className="insights-panel-title" id="insights-results-title">Resultados</h2>
        </div>
        {options.length > 0 && (
          <span className="insights-count" aria-label={`${options.length} alternativas`}>
            {options.length} {options.length === 1 ? 'alternativa' : 'alternativas'}
          </span>
        )}
      </header>

      {loading && (
        <div className="insights-state insights-state--loading" role="status" aria-live="polite">
          <Loader className="insights-spinner" size={20} aria-hidden="true" />
          <span>Analizando las condiciones indicadas…</span>
        </div>
      )}

      {error && (
        <div className="insights-state insights-state--error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && options.length === 0 && (
        <div className="insights-empty" role="status">
          <Search size={22} aria-hidden="true" />
          <div>
            <h3>Aún no se ha comparado</h3>
            <p>Elige sitios y fechas e inicia el análisis para ver las alternativas.</p>
          </div>
        </div>
      )}

      {!loading && !error && noOptionMeetsConditions && (
        <p className="insights-summary insights-summary--notice" role="status">
          Ninguna alternativa cumple las condiciones analizadas con los requisitos actuales.
        </p>
      )}

      {!loading && !error && !noOptionMeetsConditions && tiedMetrics.length > 0 && (
        <p className="insights-summary">
          Hay métricas empatadas ({tiedMetrics.join(', ')}). Se conserva el orden proporcionado
          por el motor; no implica una puntuación adicional.
        </p>
      )}

      {options.length > 0 && (
        <ol className="insights-option-list" aria-label="Alternativas en el orden recibido">
          {options.map((option, index) => (
            <OptionCard
              key={`${index}-${option.site.latitude_deg}-${option.site.longitude_deg}`}
              index={index}
              option={option}
              selected={selectedIndex === index}
              requiredHours={requiredHours}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function OptionCard({
  index,
  option,
  selected,
  requiredHours,
  onSelect,
}: {
  index: number
  option: Option
  selected: boolean
  requiredHours: number
  onSelect: (index: number) => void
}) {
  const { metrics } = option.result
  const windows = metrics.concurrent_windows
  const start = formatUtc(option.result.scenario.start_utc)
  const end = formatUtc(option.result.scenario.end_utc)

  return (
    <li className={`insights-option${selected ? ' insights-option--selected' : ''}`}>
      <article>
        <button
          className="insights-option-select"
          type="button"
          onClick={() => onSelect(index)}
          aria-pressed={selected}
          aria-label={`Seleccionar alternativa ${index + 1}: ${siteName(option)}`}
        >
          <span className="insights-option-heading">
            <span className="insights-option-name">{siteName(option)}</span>
            <span className="insights-option-selection">
              {selected ? 'Seleccionada' : 'Seleccionar'}
            </span>
          </span>
          <span className="insights-option-period">
            Periodo: {start} — {end}
          </span>
        </button>

        <VisibilityVisuals result={option.result} requiredHours={requiredHours}/>

        <div className={`insights-compliance${metrics.constraints_met ? ' insights-compliance--met' : ' insights-compliance--unmet'}`}>
          {metrics.constraints_met
            ? <CheckCircle size={16} aria-hidden="true" />
            : <XCircle size={16} aria-hidden="true" />}
          <span>
            {metrics.constraints_met
              ? 'Cumple las condiciones analizadas'
              : 'No cumple las condiciones analizadas'}
            {' · Requisito de duración continua: '}
            {formatHours(requiredHours)}
          </span>
        </div>

        <details className="visibility-raw"><summary>Detalle del calculo y ventanas</summary>
        {option.explanation.trim() && (
          <p className="insights-explanation">
            <strong>Explicación:</strong> {option.explanation}
          </p>
        )}

        {windows.length > 0 ? (
          <details className="insights-windows">
            <summary>
              {windows.length} {windows.length === 1 ? 'ventana simultánea' : 'ventanas simultáneas'}
            </summary>
            <ul className="insights-windows-list">
              {windows.map((window: Window, windowIndex: number) => (
                <li className="insights-window" key={`${window.start_utc}-${windowIndex}`}>
                  <span>{formatUtc(window.start_utc)} — {formatUtc(window.end_utc)}</span>
                  <strong>{formatHours(window.duration_hours)} continuas</strong>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="insights-no-windows">No se registraron ventanas simultáneas.</p>
        )}
        </details>
      </article>
    </li>
  )
}
