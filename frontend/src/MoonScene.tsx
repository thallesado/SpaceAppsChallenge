import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { CatalogSite, Result, Mesh, Point } from './plannerApi'
import {Sun as SunIcon,Earth as EarthIcon,Crosshair,Lightbulb,Maximize2} from 'lucide-react'
import './scene-clarity.css'

const R = 1737.4
const MODEL_URL = `${import.meta.env.BASE_URL}luna/luna_cientifica.glb`
const MODEL_SURFACE_OFFSET = 0.0015
function observerPosition(p: Props) {
  if (!p.selected) return new THREE.Vector3()
  const heightM = p.terrain?.points[Math.floor(p.terrain.points.length / 2)]?.[2] ?? 0
  return lunarVector(p.selected.latitude_deg, p.selected.longitude_deg, 1 + (p.result?.site_height_km_used ?? (heightM + 2) / 1000) / R)
}
export function lunarVector(lat: number, lon: number, radius = 1) {
  const a = lat * Math.PI / 180, b = lon * Math.PI / 180
  return new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)).multiplyScalar(radius)
}
export function bodyDirection(site: Point, az: number, el: number) {
  const up = lunarVector(site.latitude_deg, site.longitude_deg)
  const east = new THREE.Vector3(-Math.sin(site.longitude_deg * Math.PI / 180), 0, -Math.cos(site.longitude_deg * Math.PI / 180))
  const north = new THREE.Vector3().crossVectors(up, east).normalize()
  const a = az * Math.PI / 180, e = el * Math.PI / 180
  return north.multiplyScalar(Math.cos(a) * Math.cos(e)).add(east.multiplyScalar(Math.sin(a) * Math.cos(e))).add(up.multiplyScalar(Math.sin(e))).normalize()
}

function disposeObject(root: THREE.Object3D) {
  root.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => {
        Object.values(material).forEach(value => {
          if (value instanceof THREE.Texture) value.dispose()
        })
        material.dispose()
      })
    }
  })
}

type Props = { sites: CatalogSite[]; selected: Point | null; result: Result | null; sampleIndex: number; terrain: Mesh | null; view: 'globe' | 'local'; focus: number; onSelect: (site: CatalogSite) => void; onPick: (site: Point) => void }
export default function MoonScene(props: Props) {
  const mount = useRef<HTMLDivElement>(null)
  const latest = useRef(props); latest.current = props
  const focusSite = useRef<(site: Point | null, view: string) => void>(() => {})
  const focusBody = useRef<(body: 'sun' | 'earth') => void>(() => {})
  const [modelState, setModelState] = useState('Cargando modelo Blender…')
  const [webglError, setWebglError] = useState('')
  const [largeBodies,setLargeBodies]=useState(true),[shadows,setShadows]=useState(true)
  const [focusTarget,setFocusTarget]=useState<'site'|'sun'|'earth'>('site')
  const settings=useRef({largeBodies,shadows});settings.current={largeBodies,shadows}
  useEffect(() => {
    const host = mount.current!
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#050a12')
    const camera = new THREE.PerspectiveCamera(42, 1, 0.000001, 100)
    camera.position.set(0.8, -2.1, 1.8)
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) } catch { setWebglError('No se pudo iniciar WebGL. Activa la aceleración gráfica del navegador.'); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false
    host.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.minDistance = 0.00001; controls.maxDistance = 7; controls.enablePan = true
    const ambient = new THREE.AmbientLight('#b3c8e2', .18); scene.add(ambient)
    const light = new THREE.DirectionalLight('#fff0d5', 2.8); light.position.set(4, 2, 4); scene.add(light,light.target)
    light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.00012
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.001, 24, 12)), new THREE.LineBasicMaterial({ color: '#7bd9cc', transparent: true, opacity: 0.035 })); scene.add(grid)
    const starGeometry = new THREE.BufferGeometry(), positions: number[] = []
    for (let i = 0; i < 650; i++) { const t = i * 2.399963, y = 1 - 2 * i / 650, r = Math.sqrt(1 - y * y); positions.push(15 * r * Math.cos(t), 15 * y, 15 * r * Math.sin(t)) }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#94a8b8', size: 0.012 })))
    let moonRoot: THREE.Object3D | null = null
    let moonMeshes: THREE.Object3D[] = []
    const modelRay = new THREE.Raycaster()
    let lastLightingKey = ''
    let cameraFocus:'site'|'sun'|'earth'='site'
    let selectedPositionKey = ''
    let selectedPosition = new THREE.Vector3()
    const surfacePosition = (site: Point, offset = MODEL_SURFACE_OFFSET) => {
      const direction = lunarVector(site.latitude_deg, site.longitude_deg).normalize()
      if (moonRoot) {
        modelRay.ray.set(direction.clone().multiplyScalar(1.1), direction.clone().negate())
        const hit = modelRay.intersectObjects(moonMeshes, true)[0]
        if (hit) return hit.point.clone().addScaledVector(direction, offset)
      }
      return direction.multiplyScalar(1 + offset)
    }
    const loader = new GLTFLoader()
    loader.load(
      MODEL_URL,
      gltf => {
        if (disposed) { disposeObject(gltf.scene); return }
        moonRoot = gltf.scene
        moonMeshes = []
        moonRoot.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          moonMeshes.push(object)
          object.castShadow = false
          object.receiveShadow = true
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.roughness = 0.95
              material.metalness = 0
              material.needsUpdate = true
            }
          })
        })
        scene.add(moonRoot)
        moonRoot.updateMatrixWorld(true)
        lastSites = null
        selectedPositionKey = ''
        focusSite.current(latest.current.selected, latest.current.view)
        setModelState('Modelo Blender MOON_ME · texturas integradas')
      },
      event => {
        if (!disposed && event.total > 0) setModelState(`Cargando modelo Blender… ${Math.round(event.loaded / event.total * 100)}%`)
      },
      () => {
        if (!disposed) {
          setModelState('No se pudo cargar el modelo Blender')
          setWebglError('No se pudo cargar luna_cientifica.glb. Verifica que el modelo exista en /luna/.')
        }
      },
    )
    const markers = new THREE.Group(); scene.add(markers)
    const selectedMarker = new THREE.Mesh(new THREE.SphereGeometry(0.004, 16, 12), new THREE.MeshBasicMaterial({ color: '#a4f4c5', depthTest: false })); selectedMarker.renderOrder = 5; scene.add(selectedMarker)
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 16), new THREE.MeshBasicMaterial({ color: '#ffd08a', depthTest: false }))
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.009, 20, 16), new THREE.MeshBasicMaterial({ color: '#75d4f8', depthTest: false }))
    const sunArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.3, '#ffd08a', 0.02, 0.01)
    const earthArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.3, '#75d4f8', 0.02, 0.01)
    function label(text: string, color: string) {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64
      const context = canvas.getContext('2d')!; context.font = '500 28px monospace'; context.fillStyle = color; context.textAlign = 'center'; context.fillText(text, 128, 40)
      const map = new THREE.CanvasTexture(canvas)
      return new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }))
    }
    const sunLabel = label('SOL', '#ffd08a'), earthLabel = label('TIERRA', '#75d4f8')
    const pointLabel=label('TU PUNTO','#b9efcb');scene.add(pointLabel)
    const beacon=new THREE.Group()
    const base=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.08,40),new THREE.MeshBasicMaterial({color:'#b9efcb',transparent:true,opacity:.34,depthTest:false}))
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.07,8,48),new THREE.MeshBasicMaterial({color:'#b9efcb',depthTest:false}));ring.rotation.x=Math.PI/2
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1.5,12),new THREE.MeshBasicMaterial({color:'#d9ffea',depthTest:false}));mast.position.y=.75
    beacon.add(base,ring,mast);beacon.renderOrder=12;scene.add(beacon)
    function glow(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!,g=ctx.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(255,214,127,.6)');g.addColorStop(.45,'rgba(255,173,56,.22)');g.addColorStop(1,'rgba(255,140,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthTest:false}))}
    const sunGlow=glow();sunGlow.renderOrder=13;scene.add(sunGlow)
    const dashed=new THREE.LineDashedMaterial({color:'#ffd08a',dashSize:.01,gapSize:.007,depthTest:false,transparent:true,opacity:.75})
    const sunBlockedLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1,0,0)]),dashed)
    const earthBlockedLine=new THREE.Line(sunBlockedLine.geometry.clone(),new THREE.LineDashedMaterial({color:'#75d4f8',dashSize:.01,gapSize:.007,depthTest:false,transparent:true,opacity:.75}))
    scene.add(sunBlockedLine,earthBlockedLine)
    for(const arrow of [sunArrow,earthArrow])for(const object of [arrow.line,arrow.cone]){const material=object.material as THREE.Material;material.depthTest=false;object.renderOrder=11}
    const photons=new THREE.Group();for(let i=0;i<5;i++)photons.add(new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:'#ffe4a5',depthTest:false})));scene.add(photons)
    for(const object of [selectedMarker,sun,earth,sunArrow,earthArrow,sunLabel,earthLabel,pointLabel,beacon,sunGlow,photons,sunBlockedLine,earthBlockedLine])object.visible=false
    scene.add(sunLabel, earthLabel)
    scene.add(sun, earth, sunArrow, earthArrow)
    let patch: THREE.Mesh | null = null, lastTerrain: Mesh | null = null, lastSites: CatalogSite[] | null = null
    focusSite.current = (site, view) => {
      if (!site) return
      cameraFocus='site';setFocusTarget('site')
      const surface = observerPosition(latest.current)
      const up = surface.clone().normalize(), east = bodyDirection(site, 90, 0), north = bodyDirection(site, 0, 0)
      if (view === 'local') {
        controls.target.copy(surface)
        const span = (latest.current.terrain?.radius_km || 5) / R
        const offset=up.clone().multiplyScalar(.65).add(north.multiplyScalar(-.9)).add(east.multiplyScalar(.6)).normalize()
        const right=new THREE.Vector3().crossVectors(offset.clone().negate(),up).normalize(),vertical=new THREE.Vector3().crossVectors(right,offset.clone().negate()).normalize()
        controls.target.addScaledVector(vertical,span*.3)
        const tanV=Math.tan(camera.fov*Math.PI/360),tanH=tanV*camera.aspect
        let distance=span*2.8
        const include=(position:THREE.Vector3,radius=0)=>{const relative=position.clone().sub(controls.target),z=relative.dot(offset);distance=Math.max(distance,z+Math.abs(relative.dot(right))/tanH+radius/Math.sin(Math.atan(tanH)),z+Math.abs(relative.dot(vertical))/tanV+radius/Math.sin(Math.atan(tanV)))}
        for(const [lat,lon,height] of latest.current.terrain?.points||[])include(lunarVector(lat,lon,1+height/(R*1000)))
        const sample=latest.current.result?.samples[latest.current.sampleIndex]
        if(sample)for(const key of ['sun','earth'] as const){const length=span*(key==='sun'?2.6:1.4),diameter=span*(key==='sun'?.85:.65)*(settings.current.largeBodies?1.35:1);include(surface.clone().addScaledVector(bodyDirection(site,sample[key].azimuth_deg,sample[key].elevation_deg),length),diameter*.75)}
        distance*=1.15
        camera.position.copy(controls.target).addScaledVector(offset,distance)
        camera.up.copy(up)
      } else { controls.target.set(0, 0, 0); camera.up.set(0, 1, 0); camera.position.copy(up.multiplyScalar(2.65)).add(new THREE.Vector3(0.15, 0.12, 0.15)) }
      controls.update()
    }
    const bodyModels: Partial<Record<'sun' | 'earth', THREE.Object3D>> = {}
    for (const [body, url] of [['sun', 'sol/sol_cientifico.glb'], ['earth', 'tierra/tierra_cientifica.glb']] as const) {
      loader.load(`${import.meta.env.BASE_URL}${url}`, gltf => {
        if (disposed) { disposeObject(gltf.scene); return }
        const group = new THREE.Group(), box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
        gltf.scene.position.sub(center); group.add(gltf.scene);group.visible=false
        group.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=false;object.receiveShadow=false;object.renderOrder=14;for(const material of Array.isArray(object.material)?object.material:[object.material]){material.depthTest=false;material.transparent=true;if(body==='sun'&&material instanceof THREE.MeshStandardMaterial){material.emissiveIntensity=1.5}}}})
        group.userData.normalization = 1 / Math.max(size.x, size.y, size.z, 0.001)
        bodyModels[body] = group; scene.add(group)
      }, undefined, () => { if (!disposed) setModelState('Modelo de cuerpo no disponible; marcador angular activo') })
    }
    focusBody.current = body => {
      const p = latest.current
      if (!p.result || !p.selected) return
      cameraFocus=body;setFocusTarget(body)
      const target = body === 'sun' ? sun.position : earth.position
      const diameter=bodyModels[body]?.userData.displayDiameter || (p.view==='local'?(p.terrain?.radius_km||5)/R*.7:.1)
      const distance = diameter/(2*Math.tan(camera.fov*Math.PI/360))*1.6
      controls.target.copy(target)
      const towardObserver=observerPosition(p).sub(target).normalize().addScaledVector(lunarVector(p.selected.latitude_deg,p.selected.longitude_deg),.3).normalize()
      camera.position.copy(target).addScaledVector(towardObserver, distance)
      controls.update()
    }
    const pointer = new THREE.Vector2(), ray = new THREE.Raycaster()
    let downX = 0, downY = 0
    const down = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY }
    const pick = (event: MouseEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      ray.setFromCamera(pointer, camera)
      for (const body of ['sun', 'earth'] as const) {
        const model = bodyModels[body]
        if (model?.visible && ray.intersectObject(model, true).length) { focusBody.current(body); return }
      }
      const hit = latest.current.view === 'globe' ? ray.intersectObjects(markers.children)[0] : undefined
      if (hit) { latest.current.onSelect(hit.object.userData.site); return }
      if (!event.shiftKey) return
      const localTerrain = latest.current.view === 'local' && patch
      const target = localTerrain || moonRoot
      if (!target) return
      const surface = ray.intersectObject(target, true)[0]
      if (surface) {
        const point = moonRoot ? moonRoot.worldToLocal(surface.point.clone()) : surface.point.clone()
        const n = point.normalize()
        latest.current.onPick({ latitude_deg: Math.asin(n.y) * 180 / Math.PI, longitude_deg: Math.atan2(-n.z, n.x) * 180 / Math.PI, label: 'Punto personalizado' })
      }
    }
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('click', pick)
    const observer = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix();if(latest.current.view==='local')focusSite.current(latest.current.selected,'local') }); observer.observe(host)
    let frame: number
    function animate() {
      const p = latest.current
      if(!p.selected)for(const object of [selectedMarker,sun,earth,sunArrow,earthArrow,sunLabel,earthLabel,pointLabel,beacon,sunGlow,photons,sunBlockedLine,earthBlockedLine,...Object.values(bodyModels)])if(object)object.visible=false
      if (lastSites !== p.sites) {
        while (markers.children.length) { const m = markers.children[0] as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); markers.remove(m) }
        p.sites.forEach(site => { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 12, 10), new THREE.MeshBasicMaterial({ color: '#63d4e0' })); dot.position.copy(surfacePosition(site)); dot.userData.site = site; markers.add(dot) }); lastSites = p.sites
      }
      if (lastTerrain !== p.terrain) {
        if (patch) { scene.remove(patch); patch.geometry.dispose(); (patch.material as THREE.Material).dispose(); patch = null }
        if (p.terrain) {
          const n = p.terrain.resolution, vertices: number[] = [], indices: number[] = []
          p.terrain.points.forEach(([lat, lon, h]) => { vertices.push(...lunarVector(lat, lon, 1 + h / (R * 1000)).toArray()) })
          for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const a = y * n + x; indices.push(a, a+n, a+1, a+1, a+n, a+n+1) }
          const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals()
          patch = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#a6aca9', roughness: 1, side: THREE.DoubleSide }));patch.castShadow=true;patch.receiveShadow=true; scene.add(patch)
          renderer.shadowMap.needsUpdate=true
        }
        lastTerrain = p.terrain
      }
      if (moonRoot) moonRoot.visible = p.view === 'globe' || !p.terrain
      grid.visible = p.view === 'globe'; if (patch) patch.visible = p.view === 'local'
      markers.children.forEach(marker => marker.scale.setScalar(p.view === 'local' ? 0.065 : 1))
      markers.visible = p.view === 'globe'
      if (p.selected) {
        const key = `${p.selected.latitude_deg},${p.selected.longitude_deg},${p.result?.site_height_km_used},${p.terrain?.source},${p.terrain?.points.length}`
        if (key !== selectedPositionKey || p.terrain !== lastTerrain) {
          selectedPosition = observerPosition(p)
          selectedPositionKey = key
        }
        const local=p.view==='local',span=(p.terrain?.radius_km||5)/R,up=lunarVector(p.selected.latitude_deg,p.selected.longitude_deg)
        const pointPixelWorld=2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(selectedPosition)/Math.max(1,host.clientHeight)
        selectedMarker.visible=cameraFocus==='site';selectedMarker.position.copy(selectedPosition);selectedMarker.scale.setScalar(local?Math.max(span*.025,pointPixelWorld*3)/.004:1)
        beacon.visible=pointLabel.visible=local&&cameraFocus==='site'
        beacon.position.copy(selectedPosition);beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);beacon.scale.setScalar(Math.max(span*.14,pointPixelWorld*14))
        const labelWidth=Math.max(span*1.3,pointPixelWorld*150),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),side=earth.position.clone().sub(selectedPosition).dot(right)>0?-1:1
        pointLabel.position.copy(selectedPosition).addScaledVector(up,Math.max(span*.49,pointPixelWorld*35)).addScaledVector(right,side*labelWidth*.3);pointLabel.scale.set(labelWidth,labelWidth/4,1)
        const sample = p.result?.samples[p.sampleIndex]
        sunLabel.visible = earthLabel.visible = !!sample&&cameraFocus==='site'
        Object.values(bodyModels).forEach(model => { if (model) model.visible = !!sample })
        sunGlow.visible=!!sample&&(cameraFocus==='site'||cameraFocus==='sun');photons.visible=!!sample&&cameraFocus==='site';sunBlockedLine.visible=earthBlockedLine.visible=false
        ambient.intensity=local?.14:.18
        light.castShadow=local&&settings.current.shadows&&!!sample
        if(!sample){light.intensity=1.4;light.target.position.copy(selectedPosition);light.position.copy(selectedPosition).addScaledVector(up,span*5).addScaledVector(bodyDirection(p.selected,45,0),span*3)}
        for (const [key, ball, arrow] of [['sun', sun, sunArrow], ['earth', earth, earthArrow]] as const) {
          ball.visible = !!sample&&(cameraFocus==='site'||cameraFocus===key);arrow.visible=!!sample&&cameraFocus==='site'
          if (sample) {
            const direction = bodyDirection(p.selected, sample[key].azimuth_deg, sample[key].elevation_deg)
            const length = local ? span*(key==='sun'?2.6:1.4) : key==='sun'?.9:.6
            const diameter=local?span*(key==='sun'?.85:.65)*(settings.current.largeBodies?1.35:1):key==='sun'?.12:.09
            ball.position.copy(selectedPosition).addScaledVector(direction,length);ball.scale.setScalar(diameter/(key==='sun'?.024:.018))
            const model = bodyModels[key]
            if (model) {
              model.visible = cameraFocus==='site'||cameraFocus===key; ball.visible = false; model.position.copy(ball.position)
              model.scale.setScalar(model.userData.normalization*diameter);model.userData.displayDiameter=diameter
              model.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])material.opacity=sample[key].visible?1:.6})
            }
            const text = key === 'sun' ? sunLabel : earthLabel
            text.position.copy(ball.position).addScaledVector(up,diameter*.85)
            const bodyPixelWorld=2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(ball.position)/Math.max(1,host.clientHeight),textWidth=Math.max(diameter*1.7,bodyPixelWorld*150)
            text.scale.set(textWidth,textWidth/4,1)
            const visible=sample[key].visible
            arrow.visible=visible&&cameraFocus==='site'
            if(key==='sun'){
              arrow.position.copy(ball.position).addScaledVector(direction,-diameter*.6);arrow.setDirection(direction.clone().negate());arrow.setLength(Math.max(span*.1,length-diameter*.6),span*.11,span*.065)
              light.intensity=3.2;light.target.position.copy(selectedPosition);light.position.copy(selectedPosition).addScaledVector(direction,local?span*8:5)
              const shadowCamera=light.shadow.camera;shadowCamera.left=shadowCamera.bottom=-span*2.8;shadowCamera.right=shadowCamera.top=span*2.8;shadowCamera.near=span*.02;shadowCamera.far=span*18;shadowCamera.updateProjectionMatrix();light.shadow.normalBias=span*.00025
              sunGlow.position.copy(ball.position);sunGlow.scale.setScalar(diameter*2);sunGlow.material.opacity=visible?.8:.35
              photons.visible=visible&&local&&cameraFocus==='site'
              photons.children.forEach((photon,i)=>{const t=reducedMotion?i/5:((performance.now()/4000+i/5)%1);photon.position.copy(ball.position).lerp(selectedPosition,t);photon.scale.setScalar(span*.013)})
            }else{arrow.position.copy(selectedPosition);arrow.setDirection(direction);arrow.setLength(Math.max(span*.1,length-diameter*.6),span*.1,span*.06)}
            const blocked=key==='sun'?sunBlockedLine:earthBlockedLine
            blocked.visible=!visible&&cameraFocus==='site';blocked.geometry.setFromPoints([selectedPosition,ball.position]);blocked.computeLineDistances();const material=blocked.material as THREE.LineDashedMaterial;material.dashSize=local?span*.07:.035;material.gapSize=local?span*.045:.025
          }
        }
        const lightingKey=`${p.view},${sample?.time_utc},${p.selected.latitude_deg},${p.selected.longitude_deg},${p.terrain?.source},${settings.current.shadows}`
        if(lightingKey!==lastLightingKey){renderer.shadowMap.needsUpdate=true;lastLightingKey=lightingKey}
        if(sample){
          const solarDirection=bodyDirection(p.selected,sample.sun.azimuth_deg,sample.sun.elevation_deg)
          const lightDirection=light.position.clone().sub(light.target.position).normalize()
          const projectSize=(key:'sun'|'earth')=>{const body=key==='sun'?sun:earth,diameter=bodyModels[key]?.userData.displayDiameter||0;return diameter/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(camera.position.distanceTo(body.position),1e-9))*host.clientHeight}
          host.dataset.sceneDiagnostics=JSON.stringify({view:p.view,time:sample.time_utc,observer:selectedPosition.toArray(),solarDirection:solarDirection.toArray(),lightDirection:lightDirection.toArray(),sunArrowDirection:new THREE.Vector3(0,1,0).applyQuaternion(sunArrow.quaternion).toArray(),earthArrowDirection:new THREE.Vector3(0,1,0).applyQuaternion(earthArrow.quaternion).toArray(),earthTargetDirection:earth.position.clone().sub(selectedPosition).normalize().toArray(),shadows:light.castShadow,terrainSource:p.terrain?.source,terrainPixelSize:p.terrain?.pixel_size_m,terrainCastsShadow:!!patch?.castShadow,terrainReceivesShadow:!!patch?.receiveShadow,shadowMapSize:light.shadow.mapSize.toArray(),sunDiameterPixels:projectSize('sun'),earthDiameterPixels:projectSize('earth'),solarArrow:'sun_to_observer',earthArrow:'observer_to_earth',sunVisible:sample.sun.visible,earthVisible:sample.earth.visible,bodyModels:Object.keys(bodyModels),reducedMotion})
        }
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate)
    }
    animate(); focusSite.current(latest.current.selected, latest.current.view)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('click', pick); disposeObject(scene); light.shadow.dispose();renderer.dispose(); host.replaceChildren() }
  }, [])
  useEffect(() => { focusSite.current(props.selected, props.view) }, [props.selected, props.view, props.focus, props.terrain])
  const currentSample=props.result?.samples[props.sampleIndex]
  return <div className="scene-wrapper scene-clarity">
    <div ref={mount} className="three-mount" aria-label="Explorador lunar 3D Blender MOON_ME: arrastra para orbitar, rueda para acercar"/>
    {webglError&&<div className="scene-error" role="alert">{webglError}</div>}
    <div className="texture-credit">{props.view==='local'&&props.terrain?`Terreno LOLA · ${props.terrain.pixel_size_m} m/píxel`:modelState}</div>
    <div className="scene-body-controls">
      <button aria-pressed={focusTarget==='site'} onClick={()=>focusSite.current(props.selected,props.view)}><Crosshair size={14}/>Tu punto</button>
      <button aria-pressed={focusTarget==='sun'} disabled={!props.result} onClick={()=>focusBody.current('sun')}><SunIcon size={14}/>Sol</button>
      <button aria-pressed={focusTarget==='earth'} disabled={!props.result} onClick={()=>focusBody.current('earth')}><EarthIcon size={14}/>Tierra</button>
      <button aria-pressed={largeBodies} onClick={()=>{setLargeBodies(v=>!v);requestAnimationFrame(()=>focusSite.current(latest.current.selected,latest.current.view))}}><Maximize2 size={14}/>Astros grandes</button>
      {props.view==='local'&&<button aria-pressed={shadows} onClick={()=>setShadows(v=>!v)}><Lightbulb size={14}/>Sombras</button>}
    </div>
    {currentSample&&<div className="scene-direction-key">
      <div><SunIcon size={24}/><div><strong>Sol → tu punto</strong><span>{currentSample.sun.visible?'Luz directa':'Sol oculto por el horizonte'}</span></div></div>
      <div><EarthIcon size={24}/><div><strong>Tu punto → Tierra</strong><span>{currentSample.earth.visible?'Tierra visible':'Tierra oculta por el horizonte'}</span></div></div>
      <div><Crosshair size={24}/><div><strong>Baliza verde = observador</strong><span>Origen de las direcciones</span></div></div>
    </div>}
    <div className="scene-light-state" role="status">
      <Lightbulb size={15}/>{currentSample?currentSample.sun.disk_state==='partial'?'Sol parcialmente visible':currentSample.sun.visible?'Sol sobre el horizonte':'Punto en sombra según el horizonte LOLA':'Relieve sin fecha calculada'}
      <span>{props.view==='local'?'Sombras locales de la malla; el horizonte científico incluye relieve lejano.':'Fase visual según la dirección solar.'} Astros y baliza a escala simbólica.</span>
    </div>
    <div className="scene-instructions">Arrastra para orbitar · Rueda para zoom · Mayús + clic para marcar un punto</div>
  </div>
}
