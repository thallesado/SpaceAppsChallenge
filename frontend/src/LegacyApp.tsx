import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Compass, Download, Earth, Gauge, Layers3, MapPin, Menu, Moon, Plus, Radio, Search, Settings2, ShieldCheck, Sun, X } from 'lucide-react'
import { analyze } from './api'
import { SITES, chartPath, formatHour, makeDemoScenario, metrics, verdict, type Scenario, type Site } from './data'

const initialDate = '2026-11-15'
const craters = [
  [11, 13, 16], [46, 9, 11], [74, 14, 18], [94, 7, 12], [24, 40, 20], [80, 42, 16],
  [52, 52, 27], [9, 75, 14], [29, 84, 20], [73, 79, 21], [95, 81, 19], [5, 33, 8],
  [38, 19, 8], [90, 60, 9], [63, 28, 13], [56, 94, 16], [18, 60, 7], [83, 97, 9],
]

function LunarMap({ selected, onSelect }: { selected: string; onSelect: (site: Site) => void }) {
  return <div className="moon-map" aria-label="Mapa esquemático del polo sur lunar">
    <div className="moon-texture">
      {craters.map(([x, y, size], i) => <i key={i} className="crater" style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, aspectRatio: '1' }} />)}
      <div className="map-rings" /><div className="map-cross map-cross-x" /><div className="map-cross map-cross-y" />
      <span className="pole-label">90° S</span><span className="map-coordinate">LUNAR SOUTH POLE • POLAR VIEW</span>
      {SITES.map((site, i) => <button key={site.id} className={`map-point ${selected === site.id ? 'active' : ''}`} style={{ left: `${site.x}%`, top: `${site.y}%` }} onClick={() => onSelect(site)} aria-label={`Seleccionar ${site.name}`} title={site.name}><span className="point-dot"/><span className="point-index">0{i + 1}</span></button>)}
      <span className="map-compass">N <span>↑</span></span>
    </div>
    <div className="map-overlay"><span className="live-dot"/> MAPA ESQUEMÁTICO <span className="map-scale">SIN ESCALA</span></div>
  </div>
}

function Horizon({ scenario, hour }: { scenario: Scenario; hour: number }) {
  const sample = scenario.samples[Math.min(hour, scenario.samples.length - 1)]
  const sunY = 110 - sample.sunElevation * 6
  const earthY = 110 - sample.earthElevation * 6
  return <div className="horizon-wrap">
    <svg className="horizon-svg" viewBox="0 0 700 210" role="img" aria-label="Vista ilustrativa de las elevaciones del Sol y la Tierra respecto al horizonte local">
      <defs><linearGradient id="horizonBg" x2="0" y2="1"><stop stopColor="#112741"/><stop offset=".65" stopColor="#18293b"/><stop offset="1" stopColor="#19212b"/></linearGradient><linearGradient id="terrain" x2="0" y2="1"><stop stopColor="#8a9196"/><stop offset=".24" stopColor="#5e6971"/><stop offset="1" stopColor="#202b38"/></linearGradient><radialGradient id="sunGlow"><stop stopColor="#f7c977" stopOpacity=".55"/><stop offset="1" stopColor="#f7c977" stopOpacity="0"/></radialGradient></defs>
      <rect width="700" height="210" fill="url(#horizonBg)"/>
      {[45, 90, 135].map(y => <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="#94a8b4" strokeOpacity=".14" strokeDasharray="4 6"/>)}
      <line x1="0" x2="700" y1="110" y2="110" stroke="#e8f0f5" strokeOpacity=".35" strokeDasharray="5 6"/>
      <circle cx="480" cy={sunY} r="58" fill="url(#sunGlow)"/><circle cx="480" cy={sunY} r="13" fill="#f7cc79"/><circle cx="480" cy={sunY} r="18" fill="none" stroke="#f7cc79" strokeOpacity=".55"/>
      <circle cx="222" cy={earthY} r="10" fill="#75bbd3"/><path d={`M216 ${earthY - 7} Q223 ${earthY - 1} 230 ${earthY - 5}`} stroke="#c5e5ea" fill="none" strokeWidth="2"/><circle cx="222" cy={earthY} r="16" fill="none" stroke="#75bbd3" strokeOpacity=".35"/>
      <path d="M0 140 L40 133 L80 142 L126 125 L167 130 L206 108 L249 125 L285 119 L325 133 L364 111 L398 119 L429 100 L462 112 L505 130 L548 116 L586 131 L628 105 L665 122 L700 117 L700 210 L0 210Z" fill="url(#terrain)"/>
      <path d="M0 140 L40 133 L80 142 L126 125 L167 130 L206 108 L249 125 L285 119 L325 133 L364 111 L398 119 L429 100 L462 112 L505 130 L548 116 L586 131 L628 105 L665 122 L700 117" fill="none" stroke="#c0c8cb" strokeOpacity=".7" strokeWidth="1.5"/>
      <text x="25" y="101" fill="#bec9d3" fontSize="11">0° HORIZONTE GEOMÉTRICO</text><text x="189" y={Math.max(18, earthY - 22)} fill="#acd8e7" fontSize="11">TIERRA</text><text x="458" y={Math.max(18, sunY - 27)} fill="#ffe0a5" fontSize="11">SOL</text>
      <text x="20" y="192" fill="#e5edf1" fontSize="10">O</text><text x="344" y="192" fill="#e5edf1" fontSize="10">N</text><text x="669" y="192" fill="#e5edf1" fontSize="10">E</text>
    </svg>
    <div className="horizon-legend"><span><i className="dot amber"/> Sol {sample.sunElevation.toFixed(1)}°</span><span><i className="dot blue"/> Tierra {sample.earthElevation.toFixed(1)}°</span><span><i className="dot grey"/> Relieve ilustrativo</span></div>
  </div>
}

export function Timeline({ scenario, hour, onHourChange }: { scenario: Scenario; hour: number; onHourChange: (hour: number) => void }) {
  const count = scenario.hours
  const width = 600
  const sun = scenario.samples.map(s => s.sunVisible ? 1 : 0)
  const earth = scenario.samples.map(s => s.earthVisible ? 1 : 0)
  return <div className="timeline-body">
    <div className="timeline-row"><span className="timeline-name"><Sun size={16}/> Sol</span><div className="segments">{(scenario.source === 'api' ? sun : sun.slice(0, -1)).map((v, i) => <span key={i} style={{ background: v ? '#e8b96e' : '#263241' }} />)}</div><strong>{metrics(scenario).sunPercent}%</strong></div>
    <div className="timeline-row"><span className="timeline-name"><Earth size={16}/> Tierra</span><div className="segments">{(scenario.source === 'api' ? earth : earth.slice(0, -1)).map((v, i) => <span key={i} style={{ background: v ? '#74b9d1' : '#263241' }} />)}</div><strong>{metrics(scenario).earthPercent}%</strong></div>
    <div className="timeline-chart"><svg viewBox={`0 0 ${width} 64`} preserveAspectRatio="none" aria-label="Elevación del Sol y de la Tierra a lo largo del periodo"><line x1="0" y1="43" x2={width} y2="43" stroke="#627082" strokeDasharray="4 5"/><path d={chartPath(scenario.samples.map(s => s.sunElevation), width, 60, -5, 12)} fill="none" stroke="#e7b76d" strokeWidth="2"/><path d={chartPath(scenario.samples.map(s => s.earthElevation), width, 60, -5, 12)} fill="none" stroke="#79bdd3" strokeWidth="2"/><line x1={hour / count * width} x2={hour / count * width} y1="0" y2="64" stroke="#eaf0f4" strokeWidth="1"/></svg></div>
    <input className="time-slider" aria-label="Hora de simulación" type="range" min="0" max={count} value={hour} onChange={e => onHourChange(Number(e.target.value))}/>
    <div className="timeline-labels"><span>{formatHour(scenario.start, 0)}</span><span>{formatHour(scenario.start, Math.round(count / 2))}</span><span>{formatHour(scenario.start, count)}</span></div>
  </div>
}

export function MetricCard({ icon, label, value, suffix, color, detail }: { icon: React.ReactNode; label: string; value: number; suffix: string; color: string; detail: string }) {
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${color}`}>{icon}</span><ArrowUpRight size={15}/></div><div className="metric-value">{value}<small>{suffix}</small></div><div className="metric-label">{label}</div><div className="metric-detail">{detail}</div></div>
}

function downloadCsv(scenario: Scenario) {
  const rows = ['timestamp_utc,sun_elevation_deg,earth_elevation_deg,horizon_sun_deg,horizon_earth_deg,sun_visible,earth_visible', ...scenario.samples.map(s => `${new Date(Date.parse(scenario.start + 'T00:00:00Z') + s.hour * 3600000).toISOString()},${s.sunElevation.toFixed(2)},${s.earthElevation.toFixed(2)},${s.horizonSun.toFixed(2)},${s.horizonEarth.toFixed(2)},${s.sunVisible},${s.earthVisible}`)]
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = `lunarpath-${scenario.site.id}-${scenario.start}${scenario.source === 'demo' ? '-demo' : ''}.csv`; link.click(); URL.revokeObjectURL(url)
}

export default function App() {
  const [site, setSite] = useState(SITES[0])
  const [date, setDate] = useState(initialDate)
  const [scenario, setScenario] = useState<Scenario>(() => makeDemoScenario(SITES[0], initialDate))
  const [hour, setHour] = useState(48)
  const [mode, setMode] = useState<'explorer' | 'analyst'>('explorer')
  const [tab, setTab] = useState<'overview' | 'compare'>('overview')
  const [compareId, setCompareId] = useState(SITES[1].id)
  const [search, setSearch] = useState('')
  const [minSun, setMinSun] = useState(45)
  const [minEarth, setMinEarth] = useState(60)
  const [maxBlackout, setMaxBlackout] = useState(24)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  useEffect(() => { const controller = new AbortController(); setLoading(true); setApiError(null); analyze(site, date, controller.signal).then(result => { setScenario(result); setHour(Math.min(48, result.hours)); setLoading(false) }).catch(error => { if (controller.signal.aborted) return; setScenario(makeDemoScenario(site, date)); setApiError(`No se pudo consultar el backend: ${String(error)}. Se muestran datos ilustrativos.`); setLoading(false) }); return () => controller.abort() }, [site, date])
  useEffect(() => { if (compareId === site.id) setCompareId(SITES.find(s => s.id !== site.id)!.id) }, [compareId, site.id])
  const m = useMemo(() => metrics(scenario), [scenario])
  const status = verdict(m, minSun, minEarth, maxBlackout)
  const [compared, setCompared] = useState<Scenario>(() => makeDemoScenario(SITES[1], initialDate))
  useEffect(() => { const controller = new AbortController(); const comparisonSite = SITES.find(s => s.id === compareId) || SITES[1]; analyze(comparisonSite, date, controller.signal).then(setCompared).catch(error => { if (controller.signal.aborted) return; setCompared(makeDemoScenario(comparisonSite, date)); setApiError(`No se pudo comparar con datos del backend: ${String(error)}. Se muestran datos ilustrativos.`) }); return () => controller.abort() }, [compareId, date])
  const compareMetrics = metrics(compared)
  const filteredSites = SITES.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const currentSample = scenario.samples[Math.min(hour, scenario.samples.length - 1)]
  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-symbol"><Moon size={22}/><span/></div><div><strong>LUNARPATH<span> AI</span></strong><small>MISSION PLANNING PLATFORM</small></div><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
      <div className="sidebar-section-title">WORKSPACE</div>
      <button className={`nav-item ${tab === 'overview' ? 'selected' : ''}`} onClick={() => { setTab('overview'); setSidebarOpen(false) }}><Compass size={18}/> Explorador lunar <ChevronRight size={15}/></button>
      <button className={`nav-item ${tab === 'compare' ? 'selected' : ''}`} onClick={() => { setTab('compare'); setSidebarOpen(false) }}><Layers3 size={18}/> Comparar sitios <ChevronRight size={15}/></button>
      <div className="sidebar-section-title sites-title">SITIOS CANDIDATOS <span>04</span></div>
      <div className="site-search"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar región..." aria-label="Buscar sitios"/></div>
      <div className="site-list">{filteredSites.map(item => <button key={item.id} className={`site-item ${item.id === site.id ? 'active' : ''}`} onClick={() => { setSite(item); setTab('overview'); setSidebarOpen(false) }}><span className="site-number">0{SITES.indexOf(item) + 1}</span><span><strong>{item.name}</strong><small>{item.region}</small></span>{item.id === site.id && <span className="active-indicator"/>}</button>)}{filteredSites.length === 0 && <p className="empty-search">Sin resultados</p>}</div>
      <div className="sidebar-bottom"><div className="mission-card"><span className="mini-orbit"><span/></span><small>PROYECTO</small><strong>South Pole<br/>Explorer</strong><span className="mission-card-foot">NASA SPACE APPS 2026 <ArrowUpRight size={14}/></span></div><div className="sidebar-note"><CircleHelp size={15}/> Coordenadas y datos demo ilustrativos</div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={21}/></button><div className="breadcrumbs">MISSION CONTROL <ChevronRight size={13}/> <strong>{tab === 'overview' ? 'Lunar Explorer' : 'Site Comparator'}</strong></div><div className="top-actions"><span className={`source-pill ${scenario.source === 'api' ? 'api' : ''}`}><span className="live-dot"/>{scenario.source === 'api' ? 'DATOS API' : 'MODO DEMO'}</span><span className="top-divider"/><span className="avatar">LP</span></div></header>
      <main className="content">
        <div className="page-heading"><div><div className="eyebrow"><span/> LUNAR SOUTH POLE / MISSION ANALYSIS</div><h1>{tab === 'overview' ? 'Explorador lunar' : 'Comparar sitios'}<span className="heading-star">✦</span></h1><p>{tab === 'overview' ? 'Explora condiciones de iluminación y visibilidad terrestre para planificar una misión.' : 'Evalúa dos ubicaciones bajo las mismas condiciones y restricciones.'}</p></div><div className="heading-actions"><button className="outline-button" onClick={() => downloadCsv(scenario)}><Download size={16}/> Exportar CSV</button><button className="primary-button" onClick={() => setTab(tab === 'overview' ? 'compare' : 'overview')}>{tab === 'overview' ? <Plus size={17}/> : <Compass size={17}/>} {tab === 'overview' ? 'Comparar sitios' : 'Volver al explorador'}</button></div></div>
        <div className="notice" role={apiError ? 'alert' : undefined}><span className="notice-icon"><Activity size={16}/></span><span><strong>{apiError || (scenario.source === 'api' ? 'Análisis del backend conectado.' : 'Datos de demostración.')}</strong> {scenario.source === 'api' && !apiError ? 'Resultados basados en efemérides y relieve; verifica su resolución antes de tomar decisiones.' : 'Los datos ilustrativos no sirven para decisiones de misión.'}</span><button aria-label="Más información" title="El backend debe proporcionar efemérides y horizonte topográfico verificados"><CircleHelp size={16}/></button></div>
        {tab === 'overview' ? <>
          <div className="workspace-grid">
            <section className="panel map-panel"><div className="panel-heading"><div><span className="section-kicker">01 / SELECCIÓN DE SITIO</span><h2>Explorador de superficie</h2></div><span className="icon-button" title="Vista esquemática"><Layers3 size={18}/></span></div><LunarMap selected={site.id} onSelect={setSite}/><div className="selected-site"><span className="selected-pin"><MapPin size={18}/></span><div><small>SITIO SELECCIONADO</small><strong>{site.name}</strong><span>{Math.abs(site.lat).toFixed(1)}° S · {Math.abs(site.lon).toFixed(1)}° {site.lon < 0 ? 'O' : 'E'}</span></div><ChevronRight size={18}/></div></section>
            <section className="panel horizon-panel"><div className="panel-heading"><div><span className="section-kicker">02 / VISUALIZACIÓN</span><h2>Horizonte local</h2></div><span className="timestamp"><Clock3 size={14}/> {formatHour(date, hour)}</span></div><Horizon scenario={scenario} hour={hour}/><div className="horizon-status"><span className={`status-badge ${currentSample.sunVisible ? 'good' : 'bad'}`}><Sun size={14}/>{currentSample.sunVisible ? 'Sol visible' : 'Sol oculto'}</span><span className={`status-badge ${currentSample.earthVisible ? 'good blue-badge' : 'bad'}`}><Radio size={14}/>{currentSample.earthVisible ? 'Tierra visible' : 'Tierra oculta'}</span><span className="horizon-note">Elevación respecto al horizonte local</span></div></section>
            <section className="panel controls-panel"><div className="panel-heading"><div><span className="section-kicker">03 / CONFIGURACIÓN</span><h2>Parámetros de misión</h2></div><Settings2 size={18} className="muted-icon"/></div><label className="field-label" htmlFor="date">FECHA DE INICIO (UTC)</label><input className="date-input" id="date" type="date" value={date} onChange={e => setDate(e.target.value || initialDate)}/><div className="control-divider"/><div className="field-label">MODO DE ANÁLISIS</div><div className="mode-toggle"><button className={mode === 'explorer' ? 'active' : ''} onClick={() => setMode('explorer')}>Explorer</button><button className={mode === 'analyst' ? 'active' : ''} onClick={() => setMode('analyst')}>Analyst</button></div><div className="control-divider"/><div className="field-label">VENTANA TEMPORAL</div><button className="select-like" title="El MVP analiza siete días">7 días <ChevronDown size={16}/></button><p className="field-hint">Muestras cada hora · {scenario.samples.length} puntos</p>{mode === 'analyst' && <div className="analyst-fields"><label>Sol visible mínimo <strong>{minSun}%</strong><input type="range" min="0" max="100" value={minSun} onChange={e => setMinSun(Number(e.target.value))}/></label><label>Tierra visible mínimo <strong>{minEarth}%</strong><input type="range" min="0" max="100" value={minEarth} onChange={e => setMinEarth(Number(e.target.value))}/></label><label>Blackout máximo <strong>{maxBlackout} h</strong><input type="range" min="0" max="72" value={maxBlackout} onChange={e => setMaxBlackout(Number(e.target.value))}/></label></div>}</section>
          </div>
          <div className="metrics-heading"><div><span className="section-kicker">MISSION INTELLIGENCE</span><h2>Resumen de condiciones</h2></div><span className="period-label"><Clock3 size={15}/> Periodo de 7 días {loading && '· Actualizando...'}</span></div>
          <div className="metric-grid"><MetricCard icon={<Sun size={20}/>} label="Visibilidad solar" value={m.sunPercent} suffix="%" color="amber-bg" detail="Tiempo con Sol sobre el relieve"/><MetricCard icon={<Earth size={20}/>} label="Visibilidad terrestre" value={m.earthPercent} suffix="%" color="blue-bg" detail="Línea de vista directa"/><MetricCard icon={<Moon size={20}/>} label="Oscuridad más larga" value={m.longestDark} suffix="h" color="purple-bg" detail="Intervalo continuo sin Sol"/><MetricCard icon={<Radio size={20}/>} label="Blackout máximo" value={m.longestBlackout} suffix="h" color="mint-bg" detail="Sin visibilidad terrestre"/></div>
          <div className="lower-grid"><section className="panel timeline-panel"><div className="panel-heading"><div><span className="section-kicker">04 / EVOLUCIÓN TEMPORAL</span><h2>Línea de tiempo de misión</h2></div><span className="timeline-help"><span className="legend-dot sun"/> Luz solar <span className="legend-dot earth"/> Tierra visible</span></div><Timeline scenario={scenario} hour={hour} onHourChange={setHour}/></section><section className="panel feasibility-panel"><div className="panel-heading"><div><span className="section-kicker">05 / EVALUACIÓN</span><h2>Factibilidad</h2></div><Gauge size={18} className="muted-icon"/></div><div className="feasibility-top"><div className={`score-orb ${status.feasible ? 'pass' : ''}`}>{status.count}<small>/3</small></div><div><strong>{status.feasible ? 'Cumple los criterios' : 'Revisar restricciones'}</strong><span>{status.count} de 3 condiciones satisfechas</span></div></div><div className="criteria-list"><div><span className={status.passed[0] ? 'criteria-ok' : 'criteria-no'}>{status.passed[0] ? <Check size={13}/> : <X size={13}/>}</span> Luz solar ≥ {minSun}% <strong>{m.sunPercent}%</strong></div><div><span className={status.passed[1] ? 'criteria-ok' : 'criteria-no'}>{status.passed[1] ? <Check size={13}/> : <X size={13}/>}</span> Tierra visible ≥ {minEarth}% <strong>{m.earthPercent}%</strong></div><div><span className={status.passed[2] ? 'criteria-ok' : 'criteria-no'}>{status.passed[2] ? <Check size={13}/> : <X size={13}/>}</span> Blackout ≤ {maxBlackout} h <strong>{m.longestBlackout} h</strong></div></div><button className="text-button" onClick={() => setMode('analyst')}>Ajustar criterios <ArrowRight size={15}/></button></section></div>
        </> : <div className="compare-layout"><section className="panel comparison-panel"><div className="panel-heading"><div><span className="section-kicker">COMPARACIÓN DE ESCENARIOS</span><h2>Dos sitios, una ventana temporal</h2></div><span className="period-label"><Clock3 size={14}/> {date} · 7 días</span></div><div className="comparison-selectors"><div><label>SITIO A</label><div className="site-select-display"><MapPin size={17}/>{site.name}</div></div><span className="versus">VS</span><div><label htmlFor="compare-site">SITIO B</label><select id="compare-site" value={compareId} onChange={e => setCompareId(e.target.value)}>{SITES.filter(s => s.id !== site.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div><div className="comparison-table"><div className="table-head"><span>MÉTRICA</span><strong>{site.name}</strong><strong>{compared.site.name}</strong></div>{[['Visibilidad solar', `${m.sunPercent}%`, `${compareMetrics.sunPercent}%`, m.sunPercent, compareMetrics.sunPercent], ['Visibilidad terrestre', `${m.earthPercent}%`, `${compareMetrics.earthPercent}%`, m.earthPercent, compareMetrics.earthPercent], ['Oscuridad más larga', `${m.longestDark} h`, `${compareMetrics.longestDark} h`, -m.longestDark, -compareMetrics.longestDark], ['Blackout máximo', `${m.longestBlackout} h`, `${compareMetrics.longestBlackout} h`, -m.longestBlackout, -compareMetrics.longestBlackout], ['Disponibilidad simultánea', `${m.concurrentPercent}%`, `${compareMetrics.concurrentPercent}%`, m.concurrentPercent, compareMetrics.concurrentPercent]].map(([name, a, b, av, bv]) => <div className="table-row" key={String(name)}><span>{name}</span><strong className={Number(av) > Number(bv) ? 'winner' : ''}>{a}{Number(av) > Number(bv) && <ArrowUpRight size={14}/>}</strong><strong className={Number(bv) > Number(av) ? 'winner' : ''}>{b}{Number(bv) > Number(av) && <ArrowUpRight size={14}/>}</strong></div>)}</div></section><section className="panel compare-aside"><span className="section-kicker">ANÁLISIS RÁPIDO</span><h2>Balance de misión</h2><p>Compara luz, comunicaciones y continuidad durante el mismo periodo.</p><div className="compare-mini"><span><Sun size={17}/> Ventaja solar</span><strong>{m.sunPercent >= compareMetrics.sunPercent ? site.name : compared.site.name} <ArrowDownRight size={15}/></strong></div><div className="compare-mini"><span><Radio size={17}/> Ventaja de comunicación</span><strong>{m.earthPercent >= compareMetrics.earthPercent ? site.name : compared.site.name} <ArrowDownRight size={15}/></strong></div><div className="compare-mini"><span><ShieldCheck size={17}/> Cumplimiento</span><strong>{verdict(m, minSun, minEarth, maxBlackout).count} / 3 vs {verdict(compareMetrics, minSun, minEarth, maxBlackout).count} / 3</strong></div><button className="primary-button full" onClick={() => { setSite(compared.site); setTab('overview') }}>Explorar {compared.site.name} <ArrowRight size={16}/></button></section></div>}
        <footer><span>© 2026 LUNARPATH AI · NASA SPACE APPS CHALLENGE</span><span>{scenario.source === 'api' && compared.source === 'api' && !apiError ? 'EFEMÉRIDES JPL / RELIEVE LOLA / UTC' : 'INTERFAZ DEMO / UTC / DATOS NO VALIDADOS'}</span></footer>
      </main>
    </div>
  </div>
}
