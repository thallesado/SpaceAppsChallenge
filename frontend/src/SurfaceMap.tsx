import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Crosshair, MapPin, Sun, Earth, Clock3 } from 'lucide-react'
import { LocalTileMap } from './LocalTileMap'
import { polarMeters, coordinatesFromPolarMeters } from './polar'
import { queryBounds, regionBoundary } from './queryMapGeometry'
import type { QueryRegion } from './queryMapGeometry'
import type { Point, Option } from './plannerApi'
import type { LocalLayer } from './moontrek'
import './query-map.css'

const samePoint=(a:Point,b:Point)=>Math.abs(a.latitude_deg-b.latitude_deg)<1e-7&&Math.abs(a.longitude_deg-b.longitude_deg)<1e-7
export default function SurfaceMap({site,points=[],region,onPick,onSelectPoint,options=[],evaluated=false,onCompare,comparing=false,focusRequest}:{
  site:Point;points?:Point[];region?:QueryRegion|null;onPick:(point:Point)=>void;onSelectPoint?:(point:Point)=>void
  options?:Option[];evaluated?:boolean;onCompare?:()=>void;comparing?:boolean
  focusRequest?:{point:Point;id:number}|null
}){
  const origin=polarMeters(site.latitude_deg,site.longitude_deg)
  const [center,setCenter]=useState(origin),[span,setSpan]=useState(30000)
  const [layer,setLayer]=useState<LocalLayer>('lroc'),[cursor,setCursor]=useState('')
  const drag=useRef<{x:number;y:number;cx:number;cy:number}|null>(null)
  const boundary=useMemo(()=>region?regionBoundary(region):[],[region])
  function fitQuery(){if(points.length){const fit=queryBounds(points,region);setCenter({x:fit.x,y:fit.y});setSpan(fit.span)}else{setCenter(origin);setSpan(30000)}}
  useEffect(()=>{if(points.length){const fit=queryBounds(points,region);setCenter({x:fit.x,y:fit.y});setSpan(fit.span)}},[points,region])
  useEffect(()=>{if(!points.length)setCenter(polarMeters(site.latitude_deg,site.longitude_deg))},[site.latitude_deg,site.longitude_deg,points.length])
  useEffect(()=>{if(focusRequest)setCenter(polarMeters(focusRequest.point.latitude_deg,focusRequest.point.longitude_deg))},[focusRequest])
  const viewPoint=(p:{x:number;y:number})=>({x:(.5+(p.x-center.x)/span)*1000,y:(.5-(p.y-center.y)/span)*1000})
  const selectedIndex=points.findIndex(p=>samePoint(p,site)),selectedOption=options.find(o=>samePoint(o.site,site)),selectedPosition=viewPoint(origin)
  const regionCenter=region?viewPoint(polarMeters(region.center.latitude_deg,region.center.longitude_deg)):null
  return <section className="surface-map-section"><div className="analysis-heading"><div><span className="section-label">EXPLORADOR LUNAR · MAPA NASA</span><h3>{points.length?'Tu búsqueda en la Luna':'Superficie local'}</h3></div><div className="view-toggle"><button className={layer==='lroc'?'active':''} onClick={()=>setLayer('lroc')}>LROC NAC</button><button className={layer==='lola'?'active':''} onClick={()=>setLayer('lola')}>Relieve LOLA</button></div></div>
    {points.length>0&&<div className="query-map-toolbar"><span><MapPin size={16}/><b>{points.length} puntos</b>{region&&<span>· alrededor de un centro</span>}</span>{onCompare&&<button className="nav-primary" disabled={comparing} onClick={onCompare}>{comparing?'Calculando…':evaluated?'Volver a comparar':'Comparar estos puntos'}</button>}</div>}
    <div className="surface-map query-map" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,cx:center.x,cy:center.y}}} onPointerMove={e=>{
      const r=e.currentTarget.getBoundingClientRect(),p=coordinatesFromPolarMeters(center.x+((e.clientX-r.left)/r.width-.5)*span,center.y-((e.clientY-r.top)/r.height-.5)*span)
      setCursor(`${p.latitude.toFixed(4)}° · ${p.longitude.toFixed(4)}°`)
      if(drag.current)setCenter({x:drag.current.cx-(e.clientX-drag.current.x)/r.width*span,y:drag.current.cy+(e.clientY-drag.current.y)/r.height*span})
    }} onPointerUp={e=>{const start=drag.current;drag.current=null;if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<4){const r=e.currentTarget.getBoundingClientRect(),p=coordinatesFromPolarMeters(center.x+((e.clientX-r.left)/r.width-.5)*span,center.y-((e.clientY-r.top)/r.height-.5)*span);onPick({latitude_deg:p.latitude,longitude_deg:p.longitude,label:'Punto personalizado'})}}} onPointerCancel={()=>{drag.current=null}}>
      <LocalTileMap layer={layer} centerX={center.x} centerY={center.y} viewWidthM={span}/>
      <svg className="query-region-overlay" viewBox="0 0 1000 1000" aria-label={region?`Área de búsqueda de ${region.radius_km} kilómetros de radio`:'Referencias de la consulta'} role="img">
        {region&&regionCenter&&<><path className="query-region-boundary" d={boundary.map((p,i)=>{const v=viewPoint(p);return`${i?'L':'M'}${v.x},${v.y}`}).join(' ')+' Z'}/><path d={`M${regionCenter.x-9},${regionCenter.y}h18M${regionCenter.x},${regionCenter.y-9}v18`} stroke="#b8edff" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
          <text x={regionCenter.x} y={Math.max(35,Math.min(960,Math.min(...boundary.map(p=>viewPoint(p).y))-65))} textAnchor="middle" className="query-region-label">Radio {region.radius_km} km</text></>}
      </svg>
      {points.map((p,i)=>{const v=viewPoint(polarMeters(p.latitude_deg,p.longitude_deg));if(v.x<0||v.x>1000||v.y<0||v.y>1000)return null;const match=options.find(o=>samePoint(o.site,p)),status=match?(match.result.metrics.constraints_met?'fits':'fails'):evaluated?'evaluated':'pending';return <button key={i} type="button" disabled={comparing} className={`assistant-map-pin query-pin ${status} ${i===selectedIndex?'active':''}`} style={{left:`${v.x/10}%`,top:`${v.y/10}%`}} aria-label={`Explorar punto ${i+1}${match?match.result.metrics.constraints_met?', cumple tus condiciones':', no cumple tus condiciones':''}`} aria-pressed={i===selectedIndex} title={`Punto ${i+1}${i===0&&region?' · centro':''}`} onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();(onSelectPoint||onPick)(p)}}>{i+1}</button>})}
      {(!points.length||selectedIndex<0)&&<span className="map-center-pin" style={{left:`${selectedPosition.x/10}%`,top:`${selectedPosition.y/10}%`}}>+</span>}
      <span className="map-scale-bar">{(span/4000).toFixed(1)} km</span>
    </div>
    {points.length>0&&<><div className="query-map-legend"><span><i className="query-legend pending"/>Punto por comparar</span><span><i className="query-legend fits"/>Cumple</span><span><i className="query-legend fails"/>No cumple</span>{evaluated&&<span><i className="query-legend evaluated"/>Sin detalle</span>}{region&&<span><i className="query-legend area"/>Área de búsqueda</span>}</div><div className="query-point-inspector"><div><b>{selectedIndex>=0?`Punto ${selectedIndex+1}`:'Punto personalizado'}</b><span>{selectedOption?selectedOption.result.metrics.constraints_met?'Cumple tus condiciones':'No cumple tus condiciones':selectedIndex<0?'Punto fuera de esta búsqueda':selectedIndex===0&&region?'Centro de búsqueda':evaluated?'Sin detalle entre las opciones mostradas':'Listo para comparar'}</span></div>{selectedOption&&<div className="query-point-metrics"><span title="Porcentaje del periodo con Sol visible"><Sun size={15}/>{Math.round(selectedOption.result.metrics.sunlit_fraction*100)}%</span><span title="Porcentaje del periodo con Tierra visible"><Earth size={15}/>{Math.round(selectedOption.result.metrics.earth_visible_fraction*100)}%</span><span title="Ventana simultánea continua más larga"><Clock3 size={15}/>{selectedOption.result.metrics.longest_concurrent_hours.toFixed(1)} h</span></div>}</div></>}
    <div className="surface-map-controls"><span>{cursor||'Imágenes de archivo · no muestran sombras actuales'}</span><button aria-label="Alejar mapa" onClick={()=>setSpan(v=>Math.min(1600000,v*2))}><Minus size={16}/></button><button aria-label="Acercar mapa" onClick={()=>setSpan(v=>Math.max(1000,v/2))}><Plus size={16}/></button><button aria-label={points.length?'Ver todos los puntos':'Centrar mapa'} onClick={fitQuery}><Crosshair size={16}/></button></div>
    <p className="map-disclaimer">Las imágenes pueden no cubrir toda el área. El contorno y los marcadores usan coordenadas reales; no indican por sí solos un lugar adecuado.</p>
  </section>
}
