import { useId } from 'react'
import { AlertTriangle, Clock, Eye, Loader } from 'lucide-react'
import type { Body, HorizonPanelProps, HorizonProfilePoint } from './types'

const WIDTH = 760
const HEIGHT = 340
const MARGIN = { top: 24, right: 24, bottom: 42, left: 56 }
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom
const CARDINALS = [
  { azimuth: 0, label: 'N' },
  { azimuth: 90, label: 'E' },
  { azimuth: 180, label: 'S' },
  { azimuth: 270, label: 'O' },
]
const UTC_DATE_TIME = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'UTC',
})

function normalizeAzimuth(azimuth: number): number {
  const normalized = ((azimuth % 360) + 360) % 360
  return normalized === 0 && azimuth > 0 ? 360 : normalized
}

function formatAngle(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)}°` : 'No disponible'
}

function formatUtc(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? `${value} (UTC; fecha no reconocida)`
    : `${UTC_DATE_TIME.format(date)} UTC`
}

function isGeometricSource(source: string): boolean {
  return /geom[eé]tric|horizonte\s*(?:plano|0\s*°)|(?:flat|level)\s*horizon/i.test(source)
}

function isTerrainSource(source: string): boolean {
  return /lola|pds|pgda|terrain|terreno|usuario|user|custom/i.test(source)
}

function validProfile(profile: HorizonProfilePoint[] | null): HorizonProfilePoint[] {
  return (profile ?? []).filter(
    (point) => Number.isFinite(point.azimuth_deg) && Number.isFinite(point.elevation_deg),
  )
}

function elevationDomain(
  profile: HorizonProfilePoint[],
  sample: HorizonPanelProps['sample'],
): [number, number] {
  const values = profile.map((point) => point.elevation_deg)
  if (sample) {
    for (const body of [sample.sun, sample.earth]) {
      if (Number.isFinite(body.elevation_deg)) values.push(body.elevation_deg)
      if (Number.isFinite(body.horizon_deg)) values.push(body.horizon_deg)
    }
  }

  const dataMin = values.length ? Math.min(...values) : 0
  const dataMax = values.length ? Math.max(...values) : 0
  const span = dataMax - dataMin
  const padding = Number.isFinite(span) ? Math.max(5, span * 0.06) : 5

  return [
    Math.min(-15, Math.floor((dataMin - padding) / 5) * 5),
    Math.max(45, Math.ceil((dataMax + padding) / 5) * 5),
  ]
}

function tickStep(min: number, max: number): number {
  const roughStep = (max - min) / 6
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return factor * magnitude
}

function elevationTicks(min: number, max: number): number[] {
  const step = tickStep(min, max)
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = first; value <= max; value += step) ticks.push(value)
  return ticks
}

function xScale(azimuth: number): number {
  return MARGIN.left + (normalizeAzimuth(azimuth) / 360) * PLOT_WIDTH
}

function yScale(elevation: number, min: number, max: number): number {
  return MARGIN.top + ((max - elevation) / (max - min)) * PLOT_HEIGHT
}

function profileSegments(profile: HorizonProfilePoint[]): HorizonProfilePoint[][] {
  const sorted = profile
    .map((point) => ({ ...point, azimuth_deg: normalizeAzimuth(point.azimuth_deg) }))
    .sort((left, right) => left.azimuth_deg - right.azimuth_deg)
  const segments: HorizonProfilePoint[][] = []

  for (const point of sorted) {
    const current = segments[segments.length - 1]
    const previous = current?.[current.length - 1]
    if (previous && point.azimuth_deg - previous.azimuth_deg > 180) {
      segments.push([point])
    } else if (current) {
      current.push(point)
    } else {
      segments.push([point])
    }
  }

  return segments
}

function statusText(body: Body): string {
  if (!Number.isFinite(body.elevation_deg) || !Number.isFinite(body.horizon_deg)) {
    return `${body.visible ? 'visible' : 'no visible'}; relación con el horizonte local no disponible`
  }
  const relation = body.elevation_deg >= body.horizon_deg
    ? 'por encima del horizonte local'
    : 'bajo el horizonte local'
  return `${body.visible ? 'visible' : 'no visible'}; ${relation}`
}

function bodyDescription(name: string, body: Body): string {
  const disk = Number.isFinite(body.disk_fraction)
    ? ` Disco visible: ${(body.disk_fraction * 100).toFixed(0)}%.`
    : ''
  const diskState = body.disk_state?.trim() ? ` Estado del disco: ${body.disk_state}.` : ''
  return `${name}: azimut ${formatAngle(body.azimuth_deg)}, elevación ${formatAngle(body.elevation_deg)}, ${statusText(body)}.${disk}${diskState}`
}

function CelestialMarker({
  body,
  name,
  color,
  minimum,
  maximum,
  labelOffset,
}: {
  body: Body
  name: string
  color: string
  minimum: number
  maximum: number
  labelOffset: number
}) {
  if (!Number.isFinite(body.azimuth_deg) || !Number.isFinite(body.elevation_deg)) return null

  const x = xScale(body.azimuth_deg)
  const y = yScale(body.elevation_deg, minimum, maximum)
  const labelOnLeft = x > WIDTH / 2
  const labelX = x + (labelOnLeft ? -10 : 10)
  const textAnchor = labelOnLeft ? 'end' : 'start'
  const localHorizonY = Number.isFinite(body.horizon_deg)
    ? yScale(body.horizon_deg, minimum, maximum)
    : null
  const isAboveDomain = body.elevation_deg > maximum
  const isBelowDomain = body.elevation_deg < minimum
  const labelY = Math.max(MARGIN.top + 10, Math.min(MARGIN.top + PLOT_HEIGHT - 25, y + labelOffset))
  const diskLabel = Number.isFinite(body.disk_fraction)
    ? `Disco visible ${(body.disk_fraction * 100).toFixed(0)}%`
    : 'Fracción del disco no disponible'

  return (
    <g className={`insights-marker${body.visible ? ' insights-marker--visible' : ' insights-marker--hidden'}`}>
      <title>{bodyDescription(name, body)}</title>
      {localHorizonY !== null && (
        <line
          x1={x}
          x2={x}
          y1={localHorizonY}
          y2={y}
          stroke={color}
          strokeDasharray="3 3"
          strokeWidth="1"
          opacity="0.7"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r="5"
        fill={body.visible ? color : '#0f1a27'}
        stroke={color}
        strokeWidth="2"
      />
      {isAboveDomain && <path d={`M ${x - 5} ${MARGIN.top + 8} L ${x} ${MARGIN.top} L ${x + 5} ${MARGIN.top + 8} Z`} fill={color} />}
      {isBelowDomain && <path d={`M ${x - 5} ${MARGIN.top + PLOT_HEIGHT - 8} L ${x} ${MARGIN.top + PLOT_HEIGHT} L ${x + 5} ${MARGIN.top + PLOT_HEIGHT - 8} Z`} fill={color} />}
      <text x={labelX} y={labelY} textAnchor={textAnchor} fill={color} className="insights-marker-label">
        {name} · {body.visible ? 'visible' : 'no visible'}
      </text>
      <text x={labelX} y={labelY + 13} textAnchor={textAnchor} className="insights-marker-detail">
        Az {formatAngle(body.azimuth_deg)} · el {formatAngle(body.elevation_deg)}
      </text>
      <text x={labelX} y={labelY + 26} textAnchor={textAnchor} className="insights-marker-detail">
        {diskLabel}
      </text>
    </g>
  )
}

export function HorizonPanel({
  profile,
  sample,
  timeUtc,
  source,
  loading,
  error,
}: HorizonPanelProps) {
  const chartId = useId().replace(/:/g, '')
  const data = validProfile(profile)
  const segments = profileSegments(data)
  const geometricSource = isGeometricSource(source)
  const terrainSource = isTerrainSource(source)
  const hasProfile = data.length > 0
  const showGeometricLine = !hasProfile && geometricSource
  const [minimum, maximum] = elevationDomain(data, sample)
  const ticks = elevationTicks(minimum, maximum)
  const hasChart = hasProfile || sample !== null || showGeometricLine

  const pathData = segments
    .filter((segment) => segment.length > 1)
    .map((segment) => segment
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(point.azimuth_deg)} ${yScale(point.elevation_deg, minimum, maximum)}`)
      .join(' '))

  const fillData = segments
    .filter((segment) => segment.length > 1)
    .map((segment) => {
      const first = segment[0]
      const last = segment[segment.length - 1]
      return [
        segment.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(point.azimuth_deg)} ${yScale(point.elevation_deg, minimum, maximum)}`).join(' '),
        `L ${xScale(last.azimuth_deg)} ${yScale(0, minimum, maximum)}`,
        `L ${xScale(first.azimuth_deg)} ${yScale(0, minimum, maximum)} Z`,
      ].join(' ')
    })

  const profileElevations = data.map((point) => point.elevation_deg)
  const profileRange = profileElevations.length
    ? `El ${geometricSource ? 'perfil geométrico' : 'perfil recibido'} contiene ${data.length} ${data.length === 1 ? 'punto' : 'puntos'}, entre ${formatAngle(Math.min(...profileElevations))} y ${formatAngle(Math.max(...profileElevations))} de elevación.`
    : showGeometricLine
      ? 'Fuente geométrica explícita: se muestra el horizonte a 0°; no representa un perfil de terreno.'
      : terrainSource
        ? `El perfil de terreno de ${source} no está disponible. La línea de 0° se muestra solo como referencia, no como sustituto del terreno.`
        : 'No hay un perfil de obstrucción disponible. La línea de 0° es solo la referencia geométrica.'
  const description = [
    profileRange,
    sample ? bodyDescription('Sol', sample.sun) : 'Posición del Sol no disponible.',
    sample ? bodyDescription('Tierra', sample.earth) : 'Posición de la Tierra no disponible.',
    timeUtc ? `Instante analizado: ${formatUtc(timeUtc)}.` : '',
  ].filter(Boolean).join(' ')

  return (
    <section className="insights-root insights-horizon" aria-labelledby="insights-horizon-title">
      <header className="insights-panel-header">
        <div>
          <p className="insights-eyebrow">Dirección y obstrucciones</p>
          <h2 className="insights-panel-title" id="insights-horizon-title">Horizonte local</h2>
        </div>
        {source && <span className="insights-source" title={source}>{source}</span>}
      </header>

      {loading && (
        <div className="insights-state insights-state--loading" role="status" aria-live="polite">
          <Loader className="insights-spinner" size={20} aria-hidden="true" />
          <span>Cargando datos del horizonte…</span>
        </div>
      )}
      {error && (
        <div className="insights-state insights-state--error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && !hasChart && (
        <div className="insights-empty" role="status">
          <Eye size={22} aria-hidden="true" />
          <p>
            {profile === null && terrainSource
              ? `El perfil de terreno (${source}) no está disponible.`
              : 'Selecciona un instante o resultado para ver el horizonte.'}
          </p>
        </div>
      )}

      {!loading && !error && hasChart && (
        <>
          {profile === null && !showGeometricLine && (
            <p className="insights-profile-warning" role="status">
              {terrainSource
                ? `Perfil de terreno no disponible (${source}); no se ha sustituido por un horizonte plano.`
                : 'Perfil de obstrucción no disponible; la referencia de 0° no representa el terreno.'}
            </p>
          )}
          {profile !== null && data.length === 0 && (
            <p className="insights-profile-warning" role="status">
              El perfil recibido no contiene puntos con ángulos válidos.
            </p>
          )}

          <div className="insights-chart-wrap">
            <svg
              className="insights-chart"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              role="img"
              aria-labelledby={`${chartId}-title ${chartId}-description`}
            >
              <title id={`${chartId}-title`}>Perfil angular del horizonte lunar</title>
              <desc id={`${chartId}-description`}>{description}</desc>
              <defs>
                <clipPath id={`${chartId}-plot`}>
                  <rect x={MARGIN.left} y={MARGIN.top} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
                </clipPath>
              </defs>
              <rect
                x={MARGIN.left}
                y={MARGIN.top}
                width={PLOT_WIDTH}
                height={PLOT_HEIGHT}
                rx="4"
                className="insights-chart-background"
              />

              {ticks.map((tick) => (
                <g key={`elevation-${tick}`}>
                  <line
                    x1={MARGIN.left}
                    x2={MARGIN.left + PLOT_WIDTH}
                    y1={yScale(tick, minimum, maximum)}
                    y2={yScale(tick, minimum, maximum)}
                    className={tick === 0 ? 'insights-grid-line insights-grid-line--zero' : 'insights-grid-line'}
                  />
                  <text
                    x={MARGIN.left - 9}
                    y={yScale(tick, minimum, maximum) + 3}
                    textAnchor="end"
                    className="insights-axis-label"
                  >
                    {tick}°
                  </text>
                </g>
              ))}

              {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((azimuth) => (
                <g key={`azimuth-${azimuth}`}>
                  <line
                    x1={xScale(azimuth)}
                    x2={xScale(azimuth)}
                    y1={MARGIN.top}
                    y2={MARGIN.top + PLOT_HEIGHT}
                    className="insights-grid-line insights-grid-line--vertical"
                  />
                  <text
                    x={xScale(azimuth)}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="insights-axis-label"
                  >
                    {[0, 90, 180, 270, 360].includes(azimuth)
                      ? `${azimuth === 360 ? 'N' : CARDINALS.find((cardinal) => cardinal.azimuth === azimuth)?.label} ${azimuth}°`
                      : `${azimuth}°`}
                  </text>
                </g>
              ))}

              <text
                x="14"
                y={MARGIN.top + PLOT_HEIGHT / 2}
                textAnchor="middle"
                transform={`rotate(-90 14 ${MARGIN.top + PLOT_HEIGHT / 2})`}
                className="insights-axis-title"
              >
                Elevación
              </text>
              <text
                x={MARGIN.left + PLOT_WIDTH / 2}
                y={HEIGHT - 1}
                textAnchor="middle"
                className="insights-axis-title"
              >
                Azimut
              </text>

              <line
                x1={MARGIN.left}
                x2={MARGIN.left + PLOT_WIDTH}
                y1={yScale(0, minimum, maximum)}
                y2={yScale(0, minimum, maximum)}
                className="insights-geometric-line"
              />

              <g clipPath={`url(#${chartId}-plot)`}>
                {fillData.map((path, index) => (
                  <path key={`fill-${index}`} d={path} className="insights-profile-fill" />
                ))}
                {pathData.map((path, index) => (
                  <path key={`profile-${index}`} d={path} className="insights-profile-line" />
                ))}
                {segments.flatMap((segment, segmentIndex) => segment.length === 1
                  ? segment.map((point, pointIndex) => (
                    <circle
                      key={`profile-point-${segmentIndex}-${pointIndex}`}
                      cx={xScale(point.azimuth_deg)}
                      cy={yScale(point.elevation_deg, minimum, maximum)}
                      r="3"
                      className="insights-profile-point"
                    />
                  ))
                  : [])}
              </g>

              {showGeometricLine && (
                <text
                  x={MARGIN.left + PLOT_WIDTH / 2}
                  y={yScale(0, minimum, maximum) - 7}
                  textAnchor="middle"
                  className="insights-geometric-label"
                >
                  Horizonte geométrico · 0°
                </text>
              )}
              {sample && (
                <>
                  <CelestialMarker
                    body={sample.sun}
                    name="Sol"
                    color="#edbd69"
                    minimum={minimum}
                    maximum={maximum}
                    labelOffset={-10}
                  />
                  <CelestialMarker
                    body={sample.earth}
                    name="Tierra"
                    color="#73cee0"
                    minimum={minimum}
                    maximum={maximum}
                    labelOffset={20}
                  />
                </>
              )}
            </svg>
          </div>

          <p className="insights-chart-description">{description}</p>
          <div className="insights-legend" aria-label="Leyenda del gráfico">
            <span><i             className="insights-legend-swatch insights-legend-swatch--profile" /> {geometricSource && hasProfile ? 'Perfil geométrico recibido' : 'Perfil recibido'}</span>
            <span><i className="insights-legend-swatch insights-legend-swatch--zero" /> Referencia geométrica 0°</span>
            <span><i className="insights-legend-swatch insights-legend-swatch--sun" /> Sol</span>
            <span><i className="insights-legend-swatch insights-legend-swatch--earth" /> Tierra</span>
            <span className="insights-legend-note">Marcador lleno: visible · contorno: no visible</span>
          </div>
          {timeUtc && (
            <p className="insights-time">
              <Clock size={14} aria-hidden="true" /> Instante: {formatUtc(timeUtc)}
            </p>
          )}
        </>
      )}
    </section>
  )
}
