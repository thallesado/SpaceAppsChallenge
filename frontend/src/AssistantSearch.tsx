import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { request } from './plannerApi'
import type { Point, SearchResult } from './plannerApi'
import './assistant-examples.css'

type Plan = {
  start_date: string; duration_days: number; search_days: number; site_ids: string[]; coordinates: Point[]
  constraints: { min_concurrent_hours: number; min_sunlit_fraction: number; min_earth_visible_fraction: number; max_darkness_hours?: number | null; max_earth_blackout_hours?: number | null; min_earth_elevation_deg: number }
  assumptions: string[]; clarification: string | null; top_k?: number; alternative_query?: string | null; region?: {radius_km:number;count:number} | null
}
type Prepared = {plan: Plan; points: Point[]; scope: string}
export type AssistantResult = SearchResult & Prepared & {answer: string; evaluated_count?: number; requested_count?: number}

export default function AssistantSearch({ date, selected, disabled, onPoints, onResult }: {
  date: string; selected: Point | null; disabled: boolean
  onPoints: (points: Point[]) => void; onResult: (data: AssistantResult) => void
}) {
  const [text, setText] = useState(''), [prepared, setPrepared] = useState<Prepared | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null), [busy, setBusy] = useState(''), [error, setError] = useState('')
  const sequence = useRef(0)
  const questionInput = useRef<HTMLTextAreaElement>(null)
  const month = new Intl.DateTimeFormat('es', {month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))
  const examples = [
    {title:'Analizar mis coordenadas', description:'Comprueba luz, Tierra visible y horas continuas en tu punto.',
      text:`Analiza la coordenada latitud -89.5, longitud 0, desde ${date}, durante un día y sin buscar otras fechas. Necesito al menos 6 horas continuas de Sol y Tierra visibles y un máximo de 12 horas de oscuridad.`},
    {title:'Descubrir puntos nuevos', description:'Genera candidatos alrededor de una coordenada y compáralos.',
      text:`Genera 3 puntos nuevos alrededor de latitud -89, longitud 0, a 20 km. Compáralos desde ${date}, durante un día y sin otras fechas. Muéstrame las 2 mejores opciones con al menos 6 horas continuas de Sol y Tierra visibles.`},
    {title:'Encontrar dos fechas', description:`Busca oportunidades durante ${month} en una región.`,
      text:`Busca las 2 mejores fechas distintas de ${month} completo para explorar la superficie lunar, un día por escenario. Genera 3 puntos nuevos alrededor de latitud -89, longitud 0, a 20 km. Necesito al menos 6 horas continuas de Sol y Tierra visibles.`},
  ]
  useEffect(() => { const c = new AbortController(); request<{configured:boolean}>('/api/v1/assistant/status', undefined, c.signal)
    .then(s => setConfigured(s.configured)).catch(() => setConfigured(false)); return () => {c.abort(); sequence.current++} }, [])
  function change(value: string) { sequence.current++; setText(value); setPrepared(null); setBusy(''); setError(''); onPoints([]) }
  async function prepare() {
    const id = ++sequence.current; setBusy('Interpretando consulta'); setError(''); setPrepared(null); onPoints([])
    try {
      const data = await request<Prepared>('/api/v1/assistant/plan', {text, reference_date: date,
        current_site: selected ? {latitude_deg:selected.latitude_deg,longitude_deg:selected.longitude_deg,label:selected.label} : null})
      if (id === sequence.current) {setPrepared(data); if (!data.plan.clarification) onPoints(data.points)}
    } catch(e) { if (id === sequence.current) setError((e as Error).message) }
    finally {if (id === sequence.current) setBusy('')}
  }
  async function execute() {
    if (!prepared) return
    const id = ++sequence.current; setBusy('Evaluando alternativas con NASA'); setError('')
    try { const data = await request<AssistantResult>('/api/v1/assistant/search', prepared.plan)
      if (id === sequence.current) onResult(data)
    } catch(e) {if (id === sequence.current) setError((e as Error).message)}
    finally {if (id === sequence.current) setBusy('')}
  }
  return <section className="assistant-search" aria-label="Búsqueda por consulta">
    <div><span className="section-label"><Sparkles size={15}/> CONSULTA LUNAR</span><h2>¿Qué quieres explorar?</h2></div>
    <label htmlFor="lunar-question">Sitios, fechas y condiciones que necesitas</label>
    <p className="assistant-scope">Consulta por luz solar, Tierra visible, horas continuas o fechas favorables. Puedes usar tus coordenadas o pedir puntos nuevos en una región.</p>
    <textarea ref={questionInput} id="lunar-question" value={text} maxLength={2000} onChange={e => change(e.target.value)}
      placeholder="Describe dónde, cuándo y qué condiciones necesitas, o elige una idea de abajo." rows={3}/>
    <div className="assistant-examples"><h3>Prueba con una idea</h3><div className="assistant-examples-grid">{examples.map(example =>
      <button key={example.title} type="button" aria-label={`Usar ejemplo: ${example.title}`} disabled={disabled || !!busy} onClick={() => {change(example.text); questionInput.current?.focus()}}>
        <strong>{example.title}<span aria-hidden="true">↗</span></strong><span>{example.description}</span>
      </button>)}
    </div><small>Se completa el texto para que lo adaptes; la búsqueda comienza cuando pulses «Preparar búsqueda».</small></div>
    <div className="assistant-actions"><span>Gemini interpreta · Horizons y LOLA calculan</span><button className="nav-primary" onClick={prepare} disabled={configured !== true || disabled || !!busy || text.trim().length < 8}>{busy ? <LoaderCircle size={16} className="spin"/> : <Sparkles size={16}/>}Preparar búsqueda</button></div>
    {configured === false && <p role="status">Gemini pendiente de configuración en el servidor. Las búsquedas manuales siguen disponibles.</p>}
    {busy && <p role="status">{busy}…</p>}{error && <p role="alert">{error}</p>}
    {prepared && <div className="assistant-plan"><h3>{prepared.plan.clarification ? 'Necesito precisar tu consulta' : 'Tu búsqueda'}</h3>
      {prepared.plan.clarification ? <><p>{prepared.plan.clarification}</p>{prepared.plan.alternative_query && <button className="nav-secondary" onClick={() => change(prepared.plan.alternative_query!)}>Usar consulta de superficie propuesta</button>}</> : <>
        <div className="assistant-points">{prepared.points.map((p,i) => <span key={i}><b>{i+1}. {p.label || 'Coordenada'}</b> {p.latitude_deg.toFixed(4)}°, {p.longitude_deg.toFixed(4)}°</span>)}</div>
        <p>Inicio {prepared.plan.start_date} UTC · {prepared.plan.duration_days} día(s) por escenario · {prepared.points.length*(prepared.plan.search_days+1)} alternativas.</p>
        <p>Mínimos: {prepared.plan.constraints.min_concurrent_hours} h continuas · luz {(prepared.plan.constraints.min_sunlit_fraction*100).toFixed(0)}% · Tierra {(prepared.plan.constraints.min_earth_visible_fraction*100).toFixed(0)}%.</p>
        {prepared.plan.constraints.max_darkness_hours != null && <p>Oscuridad máxima: {prepared.plan.constraints.max_darkness_hours} h.</p>}
        {prepared.plan.constraints.max_earth_blackout_hours != null && <p>Sin Tierra visible: máximo {prepared.plan.constraints.max_earth_blackout_hours} h.</p>}
        {prepared.plan.constraints.min_earth_elevation_deg > 0 && <p>Elevación mínima de Tierra: {prepared.plan.constraints.min_earth_elevation_deg}°.</p>}
      </>}
      {!prepared.plan.clarification && prepared.plan.assumptions.length > 0 && <ul>{prepared.plan.assumptions.map((a,i) => <li key={i}>{a}</li>)}</ul>}
      {!prepared.plan.clarification && <><small>{prepared.scope} Ajusta el texto para cambiar las condiciones.</small><button className="nav-primary" onClick={execute} disabled={disabled || !!busy}>Buscar opciones con datos NASA</button></>}
    </div>}
  </section>
}
