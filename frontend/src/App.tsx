import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Crosshair, Earth, Globe2, Layers3, LoaderCircle, MapPin, Moon, Pause, Play, Radio, RotateCcw, Sun, X, Download, ExternalLink, AlertCircle } from 'lucide-react'
import MoonScene from './MoonScene'
import SurfaceMap from './SurfaceMap'
import MethodExplainer from './MethodExplainer'
import AssistantSearch from './AssistantSearch'
import type { AssistantSearchHandle } from './AssistantSearch'
import type { QueryRegion } from './queryMapGeometry'
import type { AssistantResult } from './AssistantSearch'
import { request, utcLabel } from './plannerApi'
import type { CatalogSite, Mesh, Option, Point, Result, SearchResult } from './plannerApi'
import { ResultsPanel, HorizonPanel, GuidePanel } from './features/insights'
import './explorer.css'

const today = new Date().toISOString().slice(0, 10)
const pct = (n: number) => `${Math.round(n * 100)}%`
const coords = (p: Point) => `${Math.abs(p.latitude_deg).toFixed(3)}° ${p.latitude_deg < 0 ? 'S' : 'N'} · ${Math.abs(p.longitude_deg).toFixed(3)}° ${p.longitude_deg < 0 ? 'O' : 'E'}`

export default function App() {
  const [sites, setSites] = useState<CatalogSite[]>([]), [selected, setSelected] = useState<Point | null>(null)
  const [checked, setChecked] = useState<string[]>(['mouton', 'malapert'])
  const [date, setDate] = useState(today), [days, setDays] = useState(3), [step, setStep] = useState(60)
  const [required, setRequired] = useState(6), [minSun, setMinSun] = useState(40), [minEarth, setMinEarth] = useState(40), [distance, setDistance] = useState(250)
  const [view, setView] = useState<'globe' | 'local' | 'map'>('globe'), [focus, setFocus] = useState(0)
  const [result, setResult] = useState<Result | null>(null), [terrain, setTerrain] = useState<Mesh | null>(null)
  const [options, setOptions] = useState<Option[]>([]), [hour, setHour] = useState(0), [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [terrainError, setTerrainError] = useState('')
  const [status, setStatus] = useState<{ dem_ready: boolean } | null>(null)
  const [query, setQuery] = useState(''), [tab, setTab] = useState<'explore' | 'compare' | 'sources'>('explore')
  const [searchDates, setSearchDates] = useState(true), [lookAhead, setLookAhead] = useState(3), [customPoints, setCustomPoints] = useState<Point[]>([]), [unavailable, setUnavailable] = useState<string[]>([]), [customLat, setCustomLat] = useState('-89.5'), [customLon, setCustomLon] = useState('0')
  const [sensitivity, setSensitivity] = useState<{complete:boolean;ranges:Record<string,{min:number;max:number}>}|null>(null)
  const [sensitivityBusy, setSensitivityBusy] = useState(false)
  const [assistantPoints, setAssistantPoints] = useState<Point[]>([])
  const [assistantAnswer, setAssistantAnswer] = useState('')
  const [assistantRegion,setAssistantRegion] = useState<QueryRegion|null>(null)
  const [assistantEvaluated,setAssistantEvaluated] = useState(false)
  const [assistantBusy,setAssistantBusy] = useState(false)
  const assistantRef = useRef<AssistantSearchHandle>(null)
  const explorerRef = useRef<HTMLElement>(null)
  const [mapFocus,setMapFocus] = useState<{point:Point;id:number}|null>(null)
  function showQueryMap() {
    setView('map');setTab('explore')
    requestAnimationFrame(()=>explorerRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}))
  }
  function previewAssistant(points:Point[],region?:QueryRegion|null) {
    operation.current++;setBusy('');setMapFocus(null);setAssistantPoints(points);setAssistantRegion(region||null);setAssistantEvaluated(false)
    setOptions([]);setUnavailable([]);setAssistantAnswer('');setResult(null);setHour(0);setPlaying(false)
    if(points.length){setSelected(points[0]);showQueryMap()}
  }
  function focusQueryPoint(point:Point) {selectQueryPoint(point);setMapFocus({point,id:Date.now()});showQueryMap()}
  function selectQueryPoint(point:Point) {
    const option=options.find(o=>Math.abs(o.site.latitude_deg-point.latitude_deg)<1e-7&&Math.abs(o.site.longitude_deg-point.longitude_deg)<1e-7)
    if(option){openOption(option,false);return}
    operation.current++;setSelected(point);setResult(null);setHour(0);setPlaying(false);setError('')
  }
  const operation = useRef(0)
  const [resultsRequired, setResultsRequired] = useState(6)
  const [slopeValue, setSlopeValue] = useState<{slope_deg: number; baseline_m: number} | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [profile, setProfile] = useState<{ azimuth_deg: number; elevation_deg: number }[] | null>(null)
  const [profileLoading, setProfileLoading] = useState(false), [profileError, setProfileError] = useState('')
  useEffect(() => {
    const c = new AbortController()
    Promise.all([request<CatalogSite[]>('/api/v1/sites', undefined, c.signal), request<{ dem_ready: boolean }>('/api/v1/status', undefined, c.signal)])
      .then(([catalog, state]) => { setSites(catalog); setSelected({ ...catalog[0], label: catalog[0].name }); setStatus(state) })
      .catch(e => { if (!c.signal.aborted) setError(`No se pudo conectar con el backend: ${e.message}`) })
    return () => c.abort()
  }, [])
  useEffect(() => {
    setTerrain(null); setTerrainError('')
    if (!selected) return
    const c = new AbortController()
    setSlopeValue(null)
    request<{slope_deg: number; baseline_m: number}>('/api/v1/terrain/slope', {site: selected}, c.signal).then(setSlopeValue).catch(() => {})
    request<Mesh>('/api/v1/terrain/mesh', { site: selected, radius_km: selected.latitude_deg <= -87.7 || result?.horizon_source === 'LOLA_MULTIRESOLUTION_20_240M' ? 1 : 5, resolution: selected.latitude_deg <= -87.7 || result?.horizon_source === 'LOLA_MULTIRESOLUTION_20_240M' ? 101 : 65 }, c.signal).then(setTerrain)
      .catch(e => { if (!c.signal.aborted) setTerrainError(e.message) })
    return () => c.abort()
  }, [selected, result?.horizon_source])
  useEffect(() => {
    if (!playing || !result) return
    const timer = setInterval(() => setHour(i => (i + 1) % result.samples.length), 180)
    return () => clearInterval(timer)
  }, [playing, result])
  useEffect(() => {
    setProfile(null); setProfileError(''); setSensitivity(null)
    if (!result) { setProfileLoading(false); return }
    if (result.horizon_profile?.length) { setProfile(result.horizon_profile); setProfileLoading(false); return }
    const c = new AbortController(); setProfileLoading(true)
    request<{ profile: { azimuth_deg: number; elevation_deg: number }[] }>('/api/v1/terrain/horizon', { site: result.scenario.site, max_distance_km: result.scenario.max_horizon_distance_km || 250, observer_height_m: 2, azimuth_step_deg: 1 }, c.signal)
      .then(data => { setProfile(data.profile); setProfileLoading(false) })
      .catch(e => { if (!c.signal.aborted) { setProfileError(e.message); setProfileLoading(false) } })
    return () => c.abort()
  }, [result])
  function select(point: Point) { if (point.latitude_deg > -75 || point.latitude_deg < -90 || Math.abs(point.longitude_deg) > 180) { setError("El punto debe estar dentro de la cobertura polar (75 a 90 grados sur)"); return } if (!('id' in point)) { const next = [...customPoints.filter(p => p.latitude_deg !== point.latitude_deg || p.longitude_deg !== point.longitude_deg), {...point, label: `Punto ${customPoints.length + 1}`}].slice(-3); setCustomPoints(next); setChecked(ids => ids.slice(0, Math.max(0, 3-next.length))) } operation.current++; setBusy(''); setSelected(point); setResult(null); setHour(0); setPlaying(false); setError('') }
  function scenario(site: Point) {
    const start = `${date}T00:00:00Z`
    return { site, start_utc: start, end_utc: new Date(Date.parse(start) + days * 86400000).toISOString(), step_minutes: step,
      use_dem_horizon: true, observer_height_m: 2, max_horizon_distance_km: distance,
      constraints: { min_concurrent_hours: required, min_sunlit_fraction: minSun / 100, min_earth_visible_fraction: minEarth / 100 } }
  }
  async function analyze() {
    if (!selected) return
    const id = ++operation.current; setBusy('Consultando Horizons y horizonte LOLA…'); setError(''); setPlaying(false)
    try { const data = await request<Result>('/api/v1/scenarios/evaluate', scenario(selected)); if (id === operation.current) { setResult(data); setHour(0) } }
    catch (e) { if (id === operation.current) setError((e as Error).message) }
    finally { if (id === operation.current) setBusy('') }
  }
  async function compare() {
    if (!selected) return
    const chosen = [...sites.filter(s => checked.includes(s.id)).map(s => ({ ...s, label: s.name })), ...customPoints].slice(0,3)
    const id = ++operation.current; setBusy(`Evaluando ${chosen.length * (searchDates ? Math.min(lookAhead, 14-days)+1 : 1)} alternativas con datos NASA…`); setError(''); setTab('compare'); setPlaying(false)
    try { const data = await request<SearchResult>('/api/v1/scenarios/search', { scenario: scenario(selected), sites: chosen, search_days: searchDates ? Math.min(lookAhead, 14-days) : 0 }); if (id === operation.current) { setOptions(data.options); setUnavailable((data.unavailable || []).map(u => `${u.site.label || 'Punto'}: ${u.detail}`)); setResultsRequired(required) } }
    catch (e) { if (id === operation.current) setError((e as Error).message) }
    finally { if (id === operation.current) setBusy('') }
  }
  function applyAssistant(data: AssistantResult) {
    operation.current++; setBusy(''); setError(''); setPlaying(false)
    setAssistantPoints(data.points);setAssistantRegion(data.plan.region||null);setAssistantEvaluated(true); setAssistantAnswer(`${data.answer} ${data.evaluated_count ?? data.options.length} alternativas evaluadas; ${data.options.length} mostradas. ${data.scope}`)
    setOptions(data.options.map(o=>{const i=data.points.findIndex(p=>Math.abs(p.latitude_deg-o.site.latitude_deg)<1e-7&&Math.abs(p.longitude_deg-o.site.longitude_deg)<1e-7);return {...o,site:{...o.site,label:i>=0?`Punto ${i+1}`:o.site.label}}})); setUnavailable((data.unavailable || []).map(u => `${u.site.label || 'Punto'}: ${u.detail}`))
    setResultsRequired(data.plan.constraints.min_concurrent_hours)
    setDate(data.plan.start_date); setDays(data.plan.duration_days); setStep(60)
    setRequired(data.plan.constraints.min_concurrent_hours); setMinSun(data.plan.constraints.min_sunlit_fraction*100)
    setMinEarth(data.plan.constraints.min_earth_visible_fraction*100)
    setCustomPoints(data.points.slice(0,3)); setChecked([]); setResult(null); setHour(0)
    setSearchDates(data.plan.search_days > 0); setLookAhead(Math.min(7,data.plan.search_days))
    if(data.options[0]){setSelected(data.options[0].site);setResult(data.options[0].result)}else if(data.points[0])setSelected(data.points[0])
    setView('map');setTab('compare')
  }
  function openOption(o: Option, moveToMap=true) { operation.current++; setBusy(''); setSelected(o.site); setResult(o.result); setHour(o.recommended_window ? Math.max(0, o.result.samples.findIndex(s => Date.parse(s.time_utc) >= Date.parse(o.recommended_window!.start_utc))) : 0); setDate(o.result.scenario.start_utc.slice(0, 10)); setTab('explore'); setPlaying(false); setFocus(f => f + 1);if(moveToMap){setMapFocus({point:o.site,id:Date.now()});showQueryMap()} }
  async function checkSensitivity() {
    if (!result) return
    const id = operation.current
    setSensitivityBusy(true)
    try { const value = await request<{complete:boolean;ranges:Record<string,{min:number;max:number}>}>('/api/v1/scenarios/sensitivity', {scenario:result.scenario,radius_m:100}); if (id === operation.current) setSensitivity(value) }
    catch(e) { setError((e as Error).message) } finally { setSensitivityBusy(false) }
  }
  function downloadJson() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...result, spatial_sensitivity: sensitivity }, null, 2)], {type:'application/json'}))
    const a = document.createElement('a'); a.href = url; a.download = `lunar-${result.scenario.start_utc.slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function download() {
    if (!result) return
    const rows = ['time_utc,sun_azimuth_deg,sun_elevation_deg,sun_horizon_deg,sun_visible,earth_azimuth_deg,earth_elevation_deg,earth_horizon_deg,earth_visible,latitude_deg,longitude_deg,observer_height_km,horizon_source,time_step_minutes', ...result.samples.map(s => [s.time_utc, s.sun.azimuth_deg, s.sun.elevation_deg, s.sun.horizon_deg, s.sun.visible, s.earth.azimuth_deg, s.earth.elevation_deg, s.earth.horizon_deg, s.earth.visible, result.scenario.site.latitude_deg, result.scenario.site.longitude_deg, result.site_height_km_used, result.horizon_source, result.scenario.step_minutes].join(','))]
    const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `lunar-${result.scenario.start_utc.slice(0,10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const sample = result?.samples[Math.min(hour, result.samples.length - 1)]
  const sceneSites = useMemo(() => [...sites, ...assistantPoints.map((p,i) => ({...p,id:`assistant-${i}`,name:p.label || `Consulta ${i+1}`,description:'Candidato de la consulta; consultar evaluaci?n',scientific_interest:'',region:'Consulta'}))], [sites, assistantPoints])
  const region = sites.find(s => s.latitude_deg === selected?.latitude_deg && s.longitude_deg === selected?.longitude_deg)
  const total = result ? Date.parse(result.scenario.end_utc) - Date.parse(result.scenario.start_utc) : 1
  return <div className="navigator">
    {assistantAnswer && <div className="assistant-answer" role="status">{assistantAnswer}<button aria-label="Cerrar resumen de consulta" onClick={() => setAssistantAnswer('')}><X size={14}/></button></div>}
    <header className="nav-header"><a className="nav-brand" href="#"><span className="brand-orbit"><Moon size={21}/></span><span>LUNAR<span className="brand-light">PATH</span><small>SOUTH POLE NAVIGATOR</small></span></a><nav aria-label="Navegación principal">{[['explore', 'Explorador'], ['compare', 'Comparar ventanas'], ['sources', 'Datos y método']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}>{label}</button>)}</nav><span className="connection"><i className={status?.dem_ready ? 'ready' : ''}/>{status?.dem_ready ? 'NASA DATA CONNECTED' : 'CONECTANDO BACKEND'}</span></header>
    <div className={`nav-intro ${tab === 'sources' ? 'nav-intro-method' : ''}`}><div><div className="eyebrow">NASA SPACE APPS / LUNAR LANDING SITE NAVIGATOR</div><h1>El próximo paso empieza<br/>con una buena <em>ventana.</em></h1><p>Explora el polo sur. Sigue al Sol y a la Tierra. Compara dónde y cuándo coinciden las condiciones que necesitas.</p></div><div className="intro-aside"><span>01 — EXPLORA</span><span>02 — DEFINE TU MISIÓN</span><span>03 — COMPARA VENTANAS</span><a href="https://github.com/ELkin2624/Lunar-Landing-Site-Navigator/tree/main/frontend/public/luna" target="_blank" rel="noreferrer">Ver modelo Blender integrado <ExternalLink size={13}/></a></div></div>
    {error && <div className="nav-error" role="alert"><AlertCircle size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}
    {busy && <div className="nav-loading" role="status"><LoaderCircle className="spin" size={18}/>{busy}<span>La primera consulta puede tardar. No se sustituyen fallos por datos demo.</span></div>}
    {tab === 'sources' ? <section className="source-page"><MethodExplainer/><span className="section-label">TRAZABILIDAD / CÓMO SE CALCULA</span><h2>Fuentes científicas y visuales.</h2><div className="source-cards">{[
      ['01', 'JPL Horizons', '¿Dónde están el Sol y la Tierra?', 'Calcula azimut y elevación desde las coordenadas lunares elegidas, para cada instante UTC.', 'https://ssd.jpl.nasa.gov/horizons/'],
      ['02', 'Blender + Moon Trek', 'El lugar y su contexto', 'El globo conserva los modelos Blender. El mapa local usa capas oficiales NAC y LOLA de Moon Trek, con cobertura y escala. Las fotos son de archivo, no sombras actuales.', 'https://trek.nasa.gov/moon/'],
      ['03', 'LOLA / PDS y PGDA', '¿Qué bloquea el horizonte?', 'El motor combina DEM LOLA de 20 m en el entorno cercano con 240 m para el relieve lejano cuando hay cobertura. También conserva acceso a los productos PGDA 78 y 90.', 'https://pgda.gsfc.nasa.gov/products/90']
    ].map(([n, title, question, text, link]) => <article key={n}><span>{n}</span><h3>{title}</h3><strong>{question}</strong><p>{text}</p><a href={link} target="_blank" rel="noreferrer">Fuente oficial <ExternalLink size={14}/></a></article>)}</div><div className="method-note"><h3>Qué significa “cumple”</h3><p>Se cumplen tus mínimos de iluminación, visibilidad de la Tierra y duración continua. El orden prioriza cumplimiento, ventana simultánea más larga y fracción simultánea. Métricas iguales representan empates.</p><p>Solo se comparan los sitios y fechas solicitados. El paso temporal puede omitir eventos breves; la resolución del terreno y la distancia de trazado limitan el horizonte. No se calcula trayectoria de descenso, seguridad de aterrizaje, energía de equipos ni enlace con estaciones terrestres.</p><a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">Consultar documentación de la API <ExternalLink size={14}/></a></div></section> : <>
      <AssistantSearch ref={assistantRef} date={date} selected={selected} disabled={!!busy} onPoints={previewAssistant} onResult={applyAssistant} onShowMap={showQueryMap} onActivity={setAssistantBusy} onSelectPoint={focusQueryPoint}/>
      <div className="exploration-layout"><aside className="mission-setup"><div className="section-label">TU EXPLORACIÓN <span>01</span></div><h2>Define el escenario</h2><label>Buscar sitio<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre o región"/></label><div className="catalog-list">{sites.filter(s => s.name.toLowerCase().includes(query.toLowerCase())).map((s, i) => <div className={`catalog-row ${region?.id === s.id ? 'selected' : ''}`} key={s.id}><button className="catalog-select" onClick={() => select({ ...s, label: s.name })}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{s.name}</strong><small>{coords(s)}</small></div></button><input type="checkbox" aria-label={`Comparar ${s.name}`} disabled={!checked.includes(s.id) && checked.length + customPoints.length >= 3} checked={checked.includes(s.id)} onChange={e => setChecked(ids => e.target.checked ? [...ids, s.id].slice(-3) : ids.filter(id => id !== s.id))}/></div>)}</div>
        <details className="custom-point"><summary>Elegir coordenadas propias</summary><div className="field-pair"><label>Latitud<input type="number" min="-90" max="-75" step="0.01" value={customLat} onChange={e => setCustomLat(e.target.value)}/></label><label>Longitud<input type="number" min="-180" max="180" step="0.01" value={customLon} onChange={e => setCustomLon(e.target.value)}/></label></div><button className="nav-secondary" onClick={() => { const lat = Number(customLat), lon = Number(customLon); if (!customLat || !customLon || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > -75 || Math.abs(lon) > 180) { setError('Usa latitud entre −90 y −75 y longitud entre −180 y 180.'); return } select({ latitude_deg: lat, longitude_deg: lon, label: 'Punto personalizado' }) }}>Marcar punto</button></details>
        {customPoints.map((p,i) => <div className="custom-chip" key={i}><span>{p.label} / {coords(p)}</span><button aria-label={`Quitar ${p.label}`} onClick={() => setCustomPoints(points => points.filter((_, n) => n !== i))}><X size={12}/></button></div>)}<div className="setup-divider"/><label>Inicio del análisis · UTC<input type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value) }}/></label><div className="field-pair"><label>Periodo<select value={days} onChange={e => { const d = Number(e.target.value); setDays(d); if (d * 1440 / step > 500) setStep(60) }}><option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días</option><option value="14">14 días</option></select></label><label>Paso temporal<select value={step} onChange={e => setStep(Number(e.target.value))}><option value="60">60 minutos</option><option value="30" disabled={days > 7}>30 minutos</option><option value="15" disabled={days > 3}>15 minutos</option></select></label></div>
        <label>Ambas condiciones durante<strong className="range-value">{required} h continuas</strong><input type="range" min="0" max={Math.max(24,required)} step="0.25" value={required} onChange={e => setRequired(Number(e.target.value))}/></label><details className="advanced"><summary>Umbrales y modelo del terreno</summary><label>Iluminación mínima: {minSun}%<input type="range" min="0" max="100" value={minSun} onChange={e => setMinSun(Number(e.target.value))}/></label><label>Tierra visible mínima: {minEarth}%<input type="range" min="0" max="100" value={minEarth} onChange={e => setMinEarth(Number(e.target.value))}/></label><label>Horizonte hasta<select value={distance} onChange={e => setDistance(Number(e.target.value))}><option value="50">50 km</option><option value="100">100 km</option><option value="250">250 km</option></select></label></details>
        <button className="nav-primary" disabled={!!busy || assistantBusy || !selected || !status?.dem_ready} onClick={analyze}>{busy ? <LoaderCircle size={17} className="spin"/> : <Crosshair size={17}/>}Analizar este sitio<ArrowRight size={16}/></button><p className="setup-foot">Horizons + horizonte LOLA · Observador a 2 m<br/>Puntos de referencia regionales, no sitios aprobados.</p></aside>
      <section className="scene-section" ref={explorerRef}><div className="scene-header"><div><span className="section-label">EXPLORADOR LUNAR <span>02</span></span><h2>{assistantPoints.some(p=>p.latitude_deg===selected?.latitude_deg&&p.longitude_deg===selected?.longitude_deg)?`Punto ${assistantPoints.findIndex(p=>p.latitude_deg===selected?.latitude_deg&&p.longitude_deg===selected?.longitude_deg)+1} de tu consulta`:selected?.label || region?.name || 'Polo sur lunar'}</h2><span className="selected-coords">{selected && coords(selected)}</span></div><div className="view-toggle"><button className={view === 'globe' ? 'active' : ''} onClick={() => setView('globe')}><Globe2 size={15}/>Globo</button><button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Mapa NASA</button><button disabled={!terrain} className={view === 'local' ? 'active' : ''} onClick={() => setView('local')}><Layers3 size={15}/>Terreno</button><button onClick={() => setFocus(f => f + 1)} title="Centrar sitio" aria-label="Centrar sitio"><Crosshair size={16}/></button></div></div>
        {view === 'map' && selected ? <SurfaceMap site={selected} points={assistantPoints} region={assistantRegion} onPick={select} onSelectPoint={selectQueryPoint} focusRequest={mapFocus} options={assistantEvaluated?options:[]} evaluated={assistantEvaluated} onCompare={assistantPoints.length?()=>assistantRef.current?.execute():undefined} comparing={assistantBusy||!!busy}/> : <MoonScene sites={sceneSites} selected={selected} result={result} sampleIndex={hour} terrain={terrain} view={view === 'map' ? 'globe' : view} focus={focus} onSelect={s => select({ ...s, label: s.name })} onPick={p => { if (p.latitude_deg > -75) { setError('Selecciona un punto al sur de 75° S, dentro de la cobertura LOLA.'); return } select(p) }}/>}
        <div className="scene-bottom"><span><i className="legend-marker site"/>Sitios</span><span><i className="legend-marker selected"/>Punto elegido</span><span><i className="legend-marker sun"/>Sol</span><span><i className="legend-marker earth"/>Tierra</span><span className="scene-scale">Direcciones reales · Tamaños y distancias simbólicos</span></div>
        {terrainError && <div className="terrain-warning" role="status">Terreno: {terrainError}</div>}<div className="site-context"><MapPin size={18}/><div><strong>{region?.name || 'Punto personalizado'}</strong><p>{region?.description || 'Coordenadas seleccionadas para explorar sus condiciones.'}</p></div><span className="terrain-badge">{terrain ? `LOLA · ${terrain.pixel_size_m} m/píxel` : 'Cargando relieve'}</span></div>
        {slopeValue && <div className="slope-strip">Pendiente regional {slopeValue.slope_deg.toFixed(1)} grados / base {slopeValue.baseline_m} m. No representa seguridad de aterrizaje.</div>}
        {sample && <div className="scene-live"><span>{utcLabel(sample.time_utc)}</span><button onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pausar' : 'Reproducir'}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button><input aria-label="Tiempo en el visor 3D" type="range" min="0" max={result!.samples.length - 1} value={hour} onChange={e => { setHour(Number(e.target.value)); setPlaying(false) }}/></div>}
      </section></div>
      <div className="comparison-callout"><div><span className="section-label">BUSCA UNA MEJOR VENTANA</span><h2>Un lugar cambia con el tiempo.</h2><p>Marca hasta tres sitios en la lista y compara con los mismos requisitos.</p></div><div className="comparison-actions"><label className="checkbox-label"><input type="checkbox" checked={searchDates} onChange={e => setSearchDates(e.target.checked)}/><select aria-label="Dias de busqueda" value={lookAhead} onChange={e => setLookAhead(Number(e.target.value))}>{[0,1,2,3,4,5,6,7].map(v => <option key={v} value={v} disabled={days+v>14}>{v+1} fechas de inicio</option>)}</select></label><button className="nav-primary" onClick={compare} disabled={!!busy || assistantBusy || !(checked.length + customPoints.length) || !status?.dem_ready}>Comparar {Math.min(3, checked.length + customPoints.length)} sitios <ArrowRight size={17}/></button></div></div>
      {tab === 'compare' && <section className="results-section">{unavailable.map((msg,i) => <p key={i} className="terrain-warning">No evaluado: {msg}</p>)}{options.some(o => o.recommended_window) && <div className="recommended-windows"><h2>Ventanas disponibles</h2>{options.filter(o => o.recommended_window).slice(0,3).map((o,i) => <button key={i} onClick={() => openOption(o)}><strong>{o.site.label}</strong><span>{utcLabel(o.recommended_window!.start_utc)} - {utcLabel(o.recommended_window!.end_utc)}</span><b>{o.recommended_window!.duration_hours.toFixed(1)} h continuas</b></button>)}</div>}<ResultsPanel options={options} selectedIndex={options.some(o => o.result === result) ? options.findIndex(o => o.result === result) : null} requiredHours={resultsRequired} loading={!!busy} error={error || null} onSelect={i => openOption(options[i])}/></section>}
      {result && sample ? <section className="analysis-section"><div className="analysis-heading"><div><span className="section-label">TU VENTANA EN DETALLE</span><h2>{result.scenario.site.label || 'Sitio elegido'} <span className={result.metrics.constraints_met ? 'result-pass' : 'result-fail'}>{result.metrics.constraints_met ? 'Cumple los requisitos' : 'No cumple los requisitos'}</span></h2><p>{utcLabel(result.scenario.start_utc)} — {utcLabel(result.scenario.end_utc)}</p></div><button className="nav-secondary" onClick={downloadJson}>JSON</button><button className="nav-secondary" onClick={download}><Download size={15}/>Exportar CSV</button></div>
        <div className="condition-cards"><article><Sun className="solar-color" size={20}/><small>Iluminación solar</small><strong>{pct(result.metrics.sunlit_fraction)}</strong><p>del periodo analizado</p></article><article><Earth className="earth-color" size={20}/><small>Tierra visible</small><strong>{pct(result.metrics.earth_visible_fraction)}</strong><p>visibilidad geométrica</p></article><article><Radio size={20}/><small>Ventana simultánea</small><strong>{result.metrics.longest_concurrent_hours.toFixed(1)} h</strong><p>máxima duración continua</p></article><article><Moon size={20}/><small>Oscuridad más larga</small><strong>{result.metrics.longest_darkness_hours.toFixed(1)} h</strong><p>intervalo continuo sin Sol</p></article></div>
        <div className="live-time"><div className="analysis-heading"><h3>{utcLabel(sample.time_utc)}</h3><div className="play-controls"><button onClick={() => setHour(0)} aria-label="Volver al inicio"><RotateCcw size={17}/></button><button onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pausar animación' : 'Reproducir animación'}>{playing ? <Pause size={17}/> : <Play size={17}/>}</button></div></div>{(['sun', 'earth', 'both'] as const).map(body => <div className={`real-timeline ${body}`} key={body}><span>{body === 'sun' ? 'Sol visible' : body === 'earth' ? 'Tierra visible' : 'Ambas'}</span><div>{result.timeline.segments.map((s, i) => <i key={i} className={(body === 'both' ? s.sun_visible && s.earth_visible : body === 'sun' ? s.sun_visible : s.earth_visible) ? 'on' : ''} style={{ width: `${s.duration_hours * 3600000 / total * 100}%` }} title={`${utcLabel(s.start_utc)} — ${utcLabel(s.end_utc)}`}/>)}</div></div>)}<input aria-label="Hora de simulación" type="range" min="0" max={result.samples.length - 1} value={hour} onChange={e => { setHour(Number(e.target.value)); setPlaying(false) }}/><div className="timeline-ends"><span>{utcLabel(result.scenario.start_utc)}</span><span>{utcLabel(result.scenario.end_utc)}</span></div></div>
        <div className="body-readouts">{(['sun', 'earth'] as const).map(body => <article key={body}><span className={body === 'sun' ? 'solar-color' : 'earth-color'}>{body === 'sun' ? <Sun size={23}/> : <Earth size={23}/>}</span><div><h3>{body === 'sun' ? 'Sol' : 'Tierra'} · {sample[body].visible ? 'Centro visible' : 'Centro bajo el horizonte'}</h3><p>Azimut {sample[body].azimuth_deg.toFixed(2)}° · Elevación {sample[body].elevation_deg.toFixed(2)}° · Horizonte {sample[body].horizon_deg.toFixed(2)}°</p><p>Margen sobre el horizonte: {(sample[body].elevation_deg - sample[body].horizon_deg).toFixed(2)} grados.</p><small>Disco visible: {pct(sample[body].disk_fraction)}. {body === 'sun' ? 'La flecha amarilla muestra la luz hacia tu punto.' : 'La flecha azul muestra la vista hacia la Tierra.'}</small></div></article>)}</div>
        <div className="sensitivity-panel"><button className="nav-secondary" disabled={sensitivityBusy} onClick={checkSensitivity}>{sensitivityBusy ? 'Evaluando 5 puntos...' : 'Comparar variacion a 100 m'}</button>{sensitivity && <div><strong>{sensitivity.complete ? 'Cinco puntos evaluados' : 'Cobertura parcial'}</strong><p>Luz: {((sensitivity.ranges.sunlit_fraction?.min || 0)*100).toFixed(1)} a {((sensitivity.ranges.sunlit_fraction?.max || 0)*100).toFixed(1)}%. Ventana continua: {sensitivity.ranges.longest_concurrent_hours?.min.toFixed(1)} a {sensitivity.ranges.longest_concurrent_hours?.max.toFixed(1)} h.</p><small>Sensibilidad espacial determinista; no es un intervalo de confianza ni una cota de toda la zona.</small></div>}</div><div className="window-strip"><strong>Ventanas con ambas condiciones</strong>{result.metrics.concurrent_windows.length ? result.metrics.concurrent_windows.slice(0, 4).map(w => <span key={w.start_utc}>{utcLabel(w.start_utc)} <ArrowRight size={13}/> {utcLabel(w.end_utc)} <b>{w.duration_hours.toFixed(1)} h</b></span>) : <p>No hay coincidencia detectada. Compara otras fechas o sitios.</p>}</div><p className="precision-note">Modelo: {result.horizon_source} &middot; Paso: {result.scenario.step_minutes} min &middot; Relieve: {result.horizon_source.includes('MULTIRESOLUTION') ? '20/240' : '240'} m/píxel. {result.precision_note}</p>
      </section> : <div className="analysis-empty"><Sun size={25}/><div><h3>Elige un sitio. Descubre su ventana.</h3><p>Al analizar, las posiciones del Sol y la Tierra aparecerán en el 3D y podrás recorrer el tiempo.</p></div></div>}
    </>}
    {tab !== 'sources' && result && <section className="analysis-section"><HorizonPanel profile={profile} sample={sample || null} timeUtc={sample?.time_utc || null} source={result.horizon_source} loading={profileLoading} error={profileError || null}/></section>}
    <footer className="navigator-footer"><span>LUNARPATH / NASA SPACE APPS</span><p>Estimaciones de iluminación y visibilidad. No certifican seguridad de alunizaje.</p><button onClick={() => setGuideOpen(true)}>Cómo usar el explorador <ArrowRight size={14}/></button><button onClick={() => { setTab('sources'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Fuentes y límites <ArrowRight size={14}/></button></footer>
    <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)}/>
  </div>
}
