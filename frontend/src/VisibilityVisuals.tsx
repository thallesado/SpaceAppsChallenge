import {Sun,Earth,Clock3,Mountain,CheckCircle2,EyeOff,Database} from 'lucide-react'
import type {Result} from './features/insights/types'
import './visibility-visuals.css'

const hoursLabel=(hours:number)=>hours>=1?`${hours.toFixed(1)} h`:hours>=1/60?`${Math.round(hours*60)} min`:`${Math.round(hours*3600)} s`
const percentLabel=(fraction:number)=>fraction>0&&fraction<.001?'<0.1%':fraction<1&&fraction>.999?'>99.9%':`${Number((fraction*100).toFixed(1))}%`

function Ring({fraction,color,label}:{fraction:number;color:string;label:string}){
  const valid=Number.isFinite(fraction),value=valid?Math.max(0,Math.min(1,fraction)):0
  const text=valid?percentLabel(fraction):'—'
  return <svg className="visibility-ring" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${valid?text:'sin dato'}`}><circle cx="50" cy="50" r="39" fill="none" stroke="#28423f" strokeWidth="7"/><circle cx="50" cy="50" r="39" fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${value*245.04} 245.04`} strokeLinecap={value?'round':'butt'} transform="rotate(-90 50 50)"/><text x="50" y="54" textAnchor="middle" fill={color} fontSize={text.length>4?20:24} fontWeight="600">{text}</text><text x="50" y="71" textAnchor="middle" fill="#b1c7be" fontSize="8">DEL PERIODO</text></svg>
}

function ClearanceChart({samples,body,color,startUtc,endUtc}:{samples:Result['samples'];body:'sun'|'earth';color:string;startUtc:string;endUtc:string}){
  if(!samples.length)return null
  const values=samples.flatMap(s=>[s[body].elevation_deg,s[body].horizon_deg]),min=Math.min(0,...values)-.5,max=Math.max(0,...values)+.5
  const period=Date.parse(endUtc)-Date.parse(startUtc)
  const x=(i:number)=>8+(Date.parse(samples[i].time_utc)-Date.parse(startUtc))/period*244,y=(v:number)=>9+(max-v)/(max-min)*60
  const line=(field:'elevation_deg'|'horizon_deg')=>samples.map((s,i)=>`${i?'L':'M'}${x(i)},${y(s[body][field])}`).join(' ')
  const title=body==='sun'?'Sol':'Tierra'
  return <svg className="visibility-clearance" viewBox="0 0 260 88" role="img" aria-label={`Altura de ${title} en color y del relieve en línea de puntos durante el periodo`}>
    <path d={`${line('horizon_deg')} L${x(samples.length-1)},71 L8,71Z`} fill="#819b8a16"/>
    <path d={`M8,${y(0)}H252`} stroke="#39534b" strokeWidth=".7"/><path d={line('horizon_deg')} fill="none" stroke="#a3b7aa" strokeWidth="1.6" strokeDasharray="4 3"/>
    <path d={line('elevation_deg')} fill="none" stroke={color} strokeWidth="2.6"/>
    <circle cx={x(samples.length-1)} cy={y(samples[samples.length-1][body].elevation_deg)} r="2" fill={color}/>
    <text x="8" y="83" fill="#93afa2" fontSize="8">Inicio</text><text x="252" y="83" textAnchor="end" fill="#93afa2" fontSize="8">Fin</text>
  </svg>
}

function bodyReason(result:Result,body:'sun'|'earth'){
  const samples=result.samples,fraction=body==='sun'?result.metrics.sunlit_fraction:result.metrics.earth_visible_fraction
  if(!samples.length)return 'Sin muestras para explicar el dato'
  if(fraction===0){
    if(Math.max(...samples.map(s=>s[body].elevation_deg))<=0)return body==='sun'?'Sol bajo el horizonte':'Tierra bajo el horizonte'
    const maxMargin=Math.max(...samples.map(s=>s[body].elevation_deg-s[body].horizon_deg))
    if(maxMargin<=0)return body==='sun'?'El relieve tapa el Sol':'El relieve tapa la Tierra'
    return 'No supera el margen requerido'
  }
  if(fraction>=.999999)return 'Visible durante todo el periodo'
  return 'Visible parte del periodo'
}

export default function VisibilityVisuals({result,requiredHours}:{result:Result;requiredHours:number}){
  const {metrics,samples}=result,duration=(Date.parse(result.scenario.end_utc)-Date.parse(result.scenario.start_utc))/3600000
  const simultaneous=metrics.longest_concurrent_hours>0
  const segments=result.timeline?.segments || []
  return <div className="visibility-visuals">
    <div className={`visibility-verdict ${metrics.constraints_met?'meets':'misses'}`}>
      {simultaneous?<Clock3 size={21}/>:<EyeOff size={21}/>}<div><strong>{simultaneous?`${hoursLabel(metrics.longest_concurrent_hours)} de Sol y Tierra a la vez`:'No se detectó coincidencia de Sol y Tierra'}</strong><span>{duration.toFixed(0)} h analizadas · {samples.length} posiciones por astro · paso {result.scenario.step_minutes} min</span></div>
    </div>
    <div className="visibility-cards">
      {(['sun','earth'] as const).map(body=>{const color=body==='sun'?'#f3c56e':'#79d5e4',fraction=body==='sun'?metrics.sunlit_fraction:metrics.earth_visible_fraction;return <div className="visibility-body-card" key={body}>
        <div className="visibility-body-top"><Ring fraction={fraction} color={color} label={body==='sun'?'Sol visible':'Tierra visible'}/><div><span style={{color}}>{body==='sun'?<Sun size={19}/>:<Earth size={19}/>} {body==='sun'?'Sol visible':'Tierra visible'}</span><strong>{bodyReason(result,body)}</strong></div></div>
        <ClearanceChart samples={samples} body={body} color={color} startUtc={result.scenario.start_utc} endUtc={result.scenario.end_utc}/><div className="visibility-chart-legend"><span style={{color}}>━ {body==='sun'?'Sol':'Tierra'}</span><span>┄ Relieve</span></div>
      </div>})}
      <div className="visibility-window-card"><Clock3 size={23}/><strong>{simultaneous?hoursLabel(metrics.longest_concurrent_hours):'Sin ventana'}</strong><span>Ventana continua más larga</span><div className="visibility-requirement"><span style={{width:`${requiredHours>0?Math.min(100,metrics.longest_concurrent_hours/requiredHours*100):simultaneous?100:0}%`}}/></div><small>Tu requisito: {hoursLabel(requiredHours)} continuas</small>{metrics.constraints_met&&<span className="visibility-window-pass"><CheckCircle2 size={15}/> Cumple tus filtros</span>}</div>
    </div>
    {segments.length>0&&<div className="visibility-timeline" aria-label="Cronología de visibilidad calculada">{[['sun_visible','Sol','#f3c56e'],['earth_visible','Tierra','#79d5e4'],['both','Ambos','#b9efcb']].map(([key,label,color])=><div className="visibility-timeline-row" key={key}><span>{label}</span><div className="visibility-timeline-track" role="img" aria-label={`${label}: intervalos visibles resaltados; fondo oscuro indica ocultación`}>{segments.map((s,i)=>{const visible=key==='both'?s.sun_visible&&s.earth_visible:key==='sun_visible'?s.sun_visible:s.earth_visible;return <span key={i} style={{left:`${(Date.parse(s.start_utc)-Date.parse(result.scenario.start_utc))/(duration*3600000)*100}%`,width:`${s.duration_hours/duration*100}%`,background:visible?color:'transparent'}} title={`${s.start_utc} — ${s.end_utc}: ${visible?'visible':'oculto'}`}/>})}</div></div>)}<div className="visibility-timeline-caption"><span>{new Date(result.scenario.start_utc).toISOString().slice(11,16)} UTC</span><span>Color = visible · rayado = oculto</span><span>{new Date(result.scenario.end_utc).toISOString().slice(11,16)} UTC</span></div></div>}
    <div className="visibility-data-caption"><Database size={12}/><span>Posiciones JPL Horizons · horizonte {result.horizon_source.includes('MULTIRESOLUTION')?'LOLA 20/240 m':result.horizon_source.startsWith('LOLA')?'LOLA 240 m':result.horizon_source}</span><Mountain size={12}/><span>Visibilidad del centro; el disco parcial se consulta en el detalle.</span></div>
  </div>
}
