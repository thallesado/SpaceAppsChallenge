import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, Crosshair } from 'lucide-react'
import { LocalTileMap } from './LocalTileMap'
import { polarMeters, coordinatesFromPolarMeters } from './polar'
import type { Point } from './plannerApi'
import type { LocalLayer } from './moontrek'

export default function SurfaceMap({ site, points = [], onPick }: { site: Point; points?: Point[]; onPick: (point: Point) => void }) {
  const origin = polarMeters(site.latitude_deg, site.longitude_deg)
  const [offset, setOffset] = useState({ x: 0, y: 0 }), [span, setSpan] = useState(30000)
  const [layer, setLayer] = useState<LocalLayer>('lroc'), [cursor, setCursor] = useState('')
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  useEffect(() => { setOffset({x:0,y:0}) }, [site.latitude_deg,site.longitude_deg])
  const center = { x: origin.x + offset.x, y: origin.y + offset.y }
  return <section className="surface-map-section"><div className="analysis-heading"><div><span className="section-label">NASA MOON TREK</span><h3>Superficie local</h3></div><div className="view-toggle"><button className={layer === 'lroc' ? 'active' : ''} onClick={() => setLayer('lroc')}>LROC NAC</button><button className={layer === 'lola' ? 'active' : ''} onClick={() => setLayer('lola')}>Relieve LOLA</button></div></div>
    <div className="surface-map" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y } }} onPointerMove={e => {
      const rect = e.currentTarget.getBoundingClientRect(), point = coordinatesFromPolarMeters(center.x + ((e.clientX - rect.left) / rect.width - .5) * span, center.y - ((e.clientY - rect.top) / rect.height - .5) * span)
      setCursor(`${point.latitude.toFixed(4)}° · ${point.longitude.toFixed(4)}°`)
      if (drag.current) setOffset({ x: drag.current.ox - (e.clientX - drag.current.x) / rect.width * span, y: drag.current.oy + (e.clientY - drag.current.y) / rect.height * span })
    }} onPointerUp={e => { const start = drag.current; drag.current = null; if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) { const r = e.currentTarget.getBoundingClientRect(), p = coordinatesFromPolarMeters(center.x + ((e.clientX-r.left)/r.width-.5)*span, center.y-((e.clientY-r.top)/r.height-.5)*span); onPick({ latitude_deg: p.latitude, longitude_deg: p.longitude, label: 'Punto personalizado' }) } }} onPointerCancel={() => { drag.current = null }}>
      <LocalTileMap layer={layer} centerX={center.x} centerY={center.y} viewWidthM={span}/><span className="map-center-pin" style={{left:`${(0.5-offset.x/span)*100}%`,top:`${(0.5+offset.y/span)*100}%`}}>+</span>{points.map((p,i) => { const position = polarMeters(p.latitude_deg,p.longitude_deg), x=(.5+(position.x-center.x)/span)*100, y=(.5-(position.y-center.y)/span)*100; return x>=0 && x<=100 && y>=0 && y<=100 ? <span key={i} className="assistant-map-pin" style={{left:`${x}%`,top:`${y}%`}} title={p.label}>{i+1}</span> : null })}<span className="map-scale-bar">{(span / 4000).toFixed(1)} km</span>
    </div><div className="surface-map-controls"><span>{cursor || 'Imagen de archivo · no representa sombras de la fecha elegida'}</span><button aria-label="Alejar mapa" onClick={() => setSpan(v => Math.min(160000, v*2))}><Minus size={16}/></button><button aria-label="Acercar mapa" onClick={() => setSpan(v => Math.max(2000, v/2))}><Plus size={16}/></button><button aria-label="Centrar mapa" onClick={() => setOffset({ x: 0, y: 0 })}><Crosshair size={16}/></button></div><p className="map-disclaimer">Cartografía de archivo Moon Trek. La iluminación de esta fotografía no se actualiza con el tiempo del análisis.</p></section>
  }
