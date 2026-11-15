import { useState } from 'react'
import { ArrowRight, MapPin, Mountain, Clock3 } from 'lucide-react'
import './method-explainer.css'

export default function MethodExplainer() {
  const [visible, setVisible] = useState(true)
  const sunY = visible ? 18 : 105
  return <section className="method-explainer" aria-labelledby="method-title">
    <div className="method-intro"><div><span className="section-label">LA IDEA, DE UN VISTAZO</span>
      <h2 id="method-title">De un punto en la Luna a una ventana para explorar.</h2></div>
      <p>Calculamos cuándo el Sol y la Tierra se ven desde tu punto, por encima del relieve.</p></div>
    <div className="method-steps">
      <article className="method-step">
        <div className="method-step-label"><span>01</span><MapPin size={16}/> TU PUNTO Y TUS FECHAS</div>
        <svg viewBox="0 0 320 185" role="img" aria-label="Un punto personalizado en la Luna y un periodo de búsqueda">
          <circle cx="112" cy="90" r="65" fill="#1a3033" stroke="#5e8580"/>
          <path d="M48 90h128M112 25c-35 30-35 100 0 130M112 25c35 30 35 100 0 130M60 53q52 25 104 0M60 127q52-25 104 0" fill="none" stroke="#375957"/>
          <circle cx="85" cy="69" r="10" fill="#233e40"/><circle cx="139" cy="90" r="17" fill="#233e40"/><circle cx="100" cy="116" r="6" fill="#304d4c"/>
          <circle cx="121" cy="139" r="12" fill="#a4f4c5" opacity=".13"/><circle cx="121" cy="139" r="4" fill="#a4f4c5"/>
          <path d="M125 141h60l12-13" fill="none" stroke="#a4f4c5"/>
          <text x="189" y="117" fill="#c8f7db" fontSize="12">Tu coordenada</text>
          <rect x="199" y="38" width="86" height="58" rx="7" fill="#14292b" stroke="#4e736d"/>
          <path d="M199 55h86M217 32v12M266 32v12" fill="none" stroke="#86b4a1" strokeWidth="2"/>
          {[0,1,2,3].map(i => <rect key={i} x={212+i*17} y="67" width="10" height="10" rx="2" fill={i===2 ? '#a4f4c5' : '#35544e'}/>)}
          <path d="M176 82h15" stroke="#597e74" strokeDasharray="3 4"/>
        </svg>
        <h3>Eliges dónde y cuándo</h3><p>Marca cualquier coordenada o pide puntos nuevos y un periodo de búsqueda.</p>
        <span className="method-source">Mapa + coordenadas + consulta</span><ArrowRight className="method-flow-arrow" size={20} aria-hidden="true"/>
      </article>
      <article className="method-step method-step-horizon">
        <div className="method-step-label"><span>02</span><Mountain size={16}/> POSICIONES + TERRENO</div>
        <svg viewBox="0 0 320 185" role="img" aria-label={visible ? 'El Sol supera la montaña y llega al observador; la Tierra también es visible' : 'La montaña bloquea el Sol aunque esté por encima del horizonte plano; la Tierra sigue visible'}>
          <path d="M38 135h260" stroke="#43615d" strokeDasharray="4 5"/>
          <text x="210" y="150" fill="#89aaa3" fontSize="9">Horizonte plano</text>
          <path d="M38 135L280 18" fill="none" stroke="#a4f4c5" opacity=".25" strokeDasharray="3 5"/>
          <path d="M38 135L82 27" fill="none" stroke="#76cddd" strokeWidth="1.5" strokeDasharray="5 4"/>
          <path d={`M38 135L280 ${sunY}`} fill="none" stroke="#f3c56e" strokeWidth="2" strokeDasharray={visible ? undefined : '5 4'}/>
          <path d="M0 161L38 135L66 144L96 128L126 136L155 87L183 106L211 130L240 125L273 145L320 140V185H0Z" fill="#203935" stroke="#6a8c7d" strokeLinejoin="round"/>
          {!visible && <g stroke="#efb190" strokeWidth="2"><path d="M142 111l10 10m-10 0l10-10"/></g>}
          <path d="M38 135v-14m-5 4l5-4 5 4" stroke="#a4f4c5" strokeWidth="2" fill="none"/><circle cx="38" cy="135" r="4" fill="#a4f4c5"/>
          <text x="12" y="113" fill="#c8f7db" fontSize="10">Tu punto</text>
          <circle cx="82" cy="27" r="8" fill="#76cddd"/><path d="M78 21l5 5-4 4 5 3" fill="none" stroke="#2b6474" strokeWidth="2"/>
          <text x="98" y="30" fill="#9fdae6" fontSize="10">Tierra</text>
          <circle cx="280" cy={sunY} r="9" fill="#f3c56e"/>
          <text x="298" y={sunY+4} fill="#f3c56e" fontSize="10">Sol</text>
          <text x="152" y="74" fill="#b4c8bb" fontSize="10">Relieve LOLA</text>
        </svg>
        <h3>Comprobamos qué se ve</h3><p>Horizons sitúa el Sol y la Tierra. LOLA revela si una montaña los oculta.</p>
        <span className="method-source">JPL Horizons + DEM LOLA</span><ArrowRight className="method-flow-arrow" size={20} aria-hidden="true"/>
      </article>
      <article className="method-step">
        <div className="method-step-label"><span>03</span><Clock3 size={16}/> VENTANAS Y COMPARACIÓN</div>
        <svg viewBox="0 0 320 185" role="img" aria-label="Tres líneas temporales: luz solar, Tierra visible y el intervalo donde coinciden ambas">
          <text x="16" y="47" fill="#f3c56e" fontSize="11">Sol</text><text x="16" y="85" fill="#76cddd" fontSize="11">Tierra</text><text x="16" y="123" fill="#a4f4c5" fontSize="11">Ambas</text>
          {[39,77,115].map(y => <rect key={y} x="72" y={y} width="230" height="12" rx="6" fill="#213b37"/>)}
          <rect x="130" y="39" width="140" height="12" rx="6" fill="#f3c56e"/><rect x="177" y="77" width="125" height="12" rx="6" fill="#76cddd"/>
          <rect x="177" y="115" width="93" height="12" rx="6" fill="#a4f4c5"/>
          <path d="M177 100v37h93v-37" stroke="#a4f4c5" fill="none" opacity=".5"/>
          <text x="223" y="156" textAnchor="middle" fill="#c8f7db" fontSize="11">Ventana simultánea</text>
          <path d={`M${visible ? 215 : 100} 27v103`} stroke="#eff9ed" strokeWidth="1.5" strokeDasharray="3 3"/>
          <circle cx={visible ? 215 : 100} cy="21" r="3" fill="#eff9ed"/>
        </svg>
        <h3>Encontramos cuándo coinciden</h3><p>Repetimos el cálculo en tus puntos y fechas, y comparamos las ventanas con tus requisitos.</p>
        <span className="method-source">Motor de cálculo + tus condiciones</span>
      </article>
    </div>
    <div className="method-demo"><div><span className="method-demo-label">PRUEBA EL ESQUEMA</span><div className="method-demo-switch" role="group" aria-label="Ejemplo de posición solar">
      <button aria-pressed={!visible} onClick={() => setVisible(false)}>Sol oculto</button><button aria-pressed={visible} onClick={() => setVisible(true)}>Sol visible</button>
    </div></div><p role="status">{visible ? 'El Sol supera el relieve y la Tierra se ve: en este instante coinciden ambas condiciones.' : 'La montaña tapa el Sol: ver la Tierra por sí sola no basta para una ventana simultánea.'}</p></div>
    <div className="method-caption"><span>Esquema ilustrativo · posiciones y tiempos sin escala; no son resultados de tu análisis.</span><span>Gemini interpreta tu consulta. El motor calcula con datos NASA.</span></div>
  </section>
}
