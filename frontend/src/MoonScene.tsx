import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { CatalogSite, Result, Mesh, Point } from './plannerApi'

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
  useEffect(() => {
    const host = mount.current!
    let disposed = false
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#050a12')
    const camera = new THREE.PerspectiveCamera(42, 1, 0.000001, 100)
    camera.position.set(0.8, -2.1, 1.8)
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }) } catch { setWebglError('No se pudo iniciar WebGL. Activa la aceleración gráfica del navegador.'); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
    host.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.minDistance = 0.00001; controls.maxDistance = 7; controls.enablePan = true
    const ambient = new THREE.AmbientLight('#b3c8e2', 1.2); scene.add(ambient)
    const light = new THREE.DirectionalLight('#fff3dd', 2); light.position.set(4, 2, 4); scene.add(light)
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.001, 24, 12)), new THREE.LineBasicMaterial({ color: '#7bd9cc', transparent: true, opacity: 0.035 })); scene.add(grid)
    const starGeometry = new THREE.BufferGeometry(), positions: number[] = []
    for (let i = 0; i < 650; i++) { const t = i * 2.399963, y = 1 - 2 * i / 650, r = Math.sqrt(1 - y * y); positions.push(15 * r * Math.cos(t), 15 * y, 15 * r * Math.sin(t)) }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#94a8b8', size: 0.012 })))
    let moonRoot: THREE.Object3D | null = null
    let moonMeshes: THREE.Object3D[] = []
    const modelRay = new THREE.Raycaster()
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
    scene.add(sunLabel, earthLabel)
    scene.add(sun, earth, sunArrow, earthArrow)
    let patch: THREE.Mesh | null = null, lastTerrain: Mesh | null = null, lastSites: CatalogSite[] | null = null
    focusSite.current = (site, view) => {
      if (!site) return
      const surface = observerPosition(latest.current)
      const up = surface.clone().normalize(), east = bodyDirection(site, 90, 0), north = bodyDirection(site, 0, 0)
      if (view === 'local') {
        controls.target.copy(surface)
        const span = (latest.current.terrain?.radius_km || 5) / R
        camera.position.copy(controls.target).add(up.clone().multiplyScalar(span*1.2)).add(north.multiplyScalar(-span*1.4)).add(east.multiplyScalar(span*.8))
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
        gltf.scene.position.sub(center); group.add(gltf.scene)
        group.userData.normalization = 1 / Math.max(size.x, size.y, size.z, 0.001)
        bodyModels[body] = group; scene.add(group)
      }, undefined, () => { if (!disposed) setModelState('Modelo de cuerpo no disponible; marcador angular activo') })
    }
    focusBody.current = body => {
      const p = latest.current
      if (!p.result || !p.selected) return
      const target = body === 'sun' ? sun.position : earth.position
      const distance = p.view === 'local' ? (p.terrain?.radius_km || 5) / R * .7 : .12
      controls.target.copy(target)
      camera.position.copy(target).addScaledVector(lunarVector(p.selected.latitude_deg, p.selected.longitude_deg), distance)
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
    const observer = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix() }); observer.observe(host)
    let frame: number
    function animate() {
      const p = latest.current
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
          patch = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#c4c9b8', roughness: 1, side: THREE.DoubleSide })); scene.add(patch)
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
        selectedMarker.position.copy(selectedPosition); selectedMarker.scale.setScalar(p.view === 'local' ? (p.terrain?.radius_km || 5)/R*.015/.004 : 1)
        const sample = p.result?.samples[p.sampleIndex]
        sunLabel.visible = earthLabel.visible = !!sample
        Object.values(bodyModels).forEach(model => { if (model) model.visible = !!sample })
        for (const [key, ball, arrow] of [['sun', sun, sunArrow], ['earth', earth, earthArrow]] as const) {
          ball.visible = arrow.visible = !!sample
          if (sample) {
            const direction = bodyDirection(p.selected, sample[key].azimuth_deg, sample[key].elevation_deg)
            const length = p.view === 'local' ? (p.terrain?.radius_km || 5)/R*1.1 : 0.65
            ball.position.copy(selectedPosition).addScaledVector(direction, length); ball.scale.setScalar(p.view === 'local' ? length*.03/.012 : 1)
            const model = bodyModels[key]
            if (model) {
              model.visible = true; ball.visible = false; model.position.copy(ball.position)
              model.scale.setScalar(model.userData.normalization * (p.view === 'local' ? length*.07 : 0.035))
            }
            const text = key === 'sun' ? sunLabel : earthLabel
            text.position.copy(ball.position).add(lunarVector(p.selected.latitude_deg, p.selected.longitude_deg).multiplyScalar(length * 0.12))
            text.scale.set(length * 0.42, length * 0.105, 1)
            arrow.position.copy(selectedPosition); arrow.setDirection(direction); arrow.setLength(length, length * 0.07, length * 0.035)
            if (key === 'sun') light.position.copy(direction).multiplyScalar(5)
          }
        }
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate)
    }
    animate(); focusSite.current(latest.current.selected, latest.current.view)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('click', pick); disposeObject(scene); renderer.dispose(); host.replaceChildren() }
  }, [])
  useEffect(() => { focusSite.current(props.selected, props.view) }, [props.selected, props.view, props.focus, props.terrain])
  return <div className="scene-wrapper"><div ref={mount} className="three-mount" aria-label="Explorador lunar 3D Blender MOON_ME: arrastra para orbitar, rueda para acercar"/>{webglError && <div className="scene-error" role="alert">{webglError}</div>}<div className="texture-credit">{modelState}</div><div className="scene-body-controls"><button disabled={!props.result} onClick={() => focusBody.current('sun')}>Sol</button><button disabled={!props.result} onClick={() => focusBody.current('earth')}>Tierra</button></div><div className="scene-instructions">Arrastra para orbitar · Rueda para zoom · Mayús + clic para marcar un punto</div></div>
}
