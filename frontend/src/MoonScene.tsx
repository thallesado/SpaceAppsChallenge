import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CatalogSite, Result, Mesh, Point } from './plannerApi'
import { apiUrl } from './plannerApi'

const R = 1737.4
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

type Props = { sites: CatalogSite[]; selected: Point | null; result: Result | null; sampleIndex: number; terrain: Mesh | null; view: 'globe' | 'local'; focus: number; onSelect: (site: CatalogSite) => void; onPick: (site: Point) => void }
export default function MoonScene(props: Props) {
  const mount = useRef<HTMLDivElement>(null)
  const latest = useRef(props); latest.current = props
  const focusSite = useRef<(site: Point | null, view: string) => void>(() => {})
  const [textureState, setTextureState] = useState('Cargando imágenes de Moon Trek…')
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
    host.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.minDistance = 0.0001; controls.maxDistance = 7; controls.enablePan = true
    const ambient = new THREE.AmbientLight('#b3c8e2', 1.2); scene.add(ambient)
    const light = new THREE.DirectionalLight('#fff3dd', 2); light.position.set(4, 2, 4); scene.add(light)
    const material = new THREE.MeshStandardMaterial({ color: '#b6bcc5', roughness: 1, metalness: 0 })
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), material); scene.add(globe)
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.001, 24, 12)), new THREE.LineBasicMaterial({ color: '#7bd9cc', transparent: true, opacity: 0.035 })); scene.add(grid)
    const starGeometry = new THREE.BufferGeometry(), positions: number[] = []
    for (let i = 0; i < 650; i++) { const t = i * 2.399963, y = 1 - 2 * i / 650, r = Math.sqrt(1 - y * y); positions.push(15 * r * Math.cos(t), 15 * y, 15 * r * Math.sin(t)) }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#94a8b8', size: 0.012 })))
    const textureCanvas = document.createElement('canvas'); textureCanvas.width = 2048; textureCanvas.height = 1024
    const ctx = textureCanvas.getContext('2d')!; ctx.fillStyle = '#696e75'; ctx.fillRect(0, 0, 2048, 1024)
    const texture = new THREE.CanvasTexture(textureCanvas); texture.colorSpace = THREE.SRGBColorSpace; material.map = texture; material.needsUpdate = true
    let loaded = 0, failed = 0
    const images: HTMLImageElement[] = []
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      const image = new Image(); images.push(image); image.crossOrigin = 'anonymous'
      image.onload = () => { if (disposed) return; ctx.drawImage(image, col * 256, row * 256, 256, 256); texture.needsUpdate = true; loaded++; setTextureState(failed ? `Moon Trek: ${loaded}/32 teselas; ${failed} no disponibles` : loaded === 32 ? 'NASA Moon Trek · LRO WAC' : `Moon Trek · ${loaded}/32 teselas`) }
      image.onerror = () => { if (!disposed) { failed++; setTextureState(`Moon Trek: ${failed} teselas no disponibles; reintenta al recargar`) } }
      image.src = apiUrl(`/api/v1/maps/tiles/2/${row}/${col}`)
    }
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
      const up = lunarVector(site.latitude_deg, site.longitude_deg), east = bodyDirection(site, 90, 0), north = bodyDirection(site, 0, 0)
      if (view === 'local') {
        controls.target.copy(up.clone().multiplyScalar(1 + (latest.current.result?.site_height_km_used || 0) / R))
        camera.position.copy(controls.target).add(up.clone().multiplyScalar(0.024)).add(north.multiplyScalar(-0.03)).add(east.multiplyScalar(0.018))
        camera.up.copy(up)
      } else { controls.target.set(0, 0, 0); camera.up.set(0, 1, 0); camera.position.copy(up.multiplyScalar(2.65)).add(new THREE.Vector3(0.15, 0.12, 0.15)) }
      controls.update()
    }
    const pointer = new THREE.Vector2(), ray = new THREE.Raycaster()
    let downX = 0, downY = 0
    const down = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY }
    const pick = (event: MouseEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      ray.setFromCamera(pointer, camera)
      const hit = ray.intersectObjects(markers.children)[0]
      if (hit) { latest.current.onSelect(hit.object.userData.site); return }
      if (!event.shiftKey) return
      const surface = ray.intersectObject(globe)[0]
      if (surface) { const n = surface.point.normalize(); latest.current.onPick({ latitude_deg: Math.asin(n.y) * 180 / Math.PI, longitude_deg: Math.atan2(-n.z, n.x) * 180 / Math.PI, label: 'Punto personalizado' }) }
    }
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('click', pick)
    const observer = new ResizeObserver(() => { renderer.setSize(host.clientWidth, host.clientHeight); camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix() }); observer.observe(host)
    let frame: number
    function animate() {
      const p = latest.current
      if (lastSites !== p.sites) {
        while (markers.children.length) { const m = markers.children[0] as THREE.Mesh; m.geometry.dispose(); (m.material as THREE.Material).dispose(); markers.remove(m) }
        p.sites.forEach(site => { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 12, 10), new THREE.MeshBasicMaterial({ color: '#63d4e0' })); dot.position.copy(lunarVector(site.latitude_deg, site.longitude_deg, 1.003)); dot.userData.site = site; markers.add(dot) }); lastSites = p.sites
      }
      if (lastTerrain !== p.terrain) {
        if (patch) { scene.remove(patch); patch.geometry.dispose(); (patch.material as THREE.Material).dispose(); patch = null }
        if (p.terrain) {
          const n = p.terrain.resolution, vertices: number[] = [], uvs: number[] = [], indices: number[] = []
          p.terrain.points.forEach(([lat, lon, h]) => { vertices.push(...lunarVector(lat, lon, 1 + h / (R * 1000)).toArray()); uvs.push((lon + 180) / 360, (lat + 90) / 180) })
          for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const a = y * n + x; indices.push(a, a+n, a+1, a+1, a+n, a+n+1) }
          const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals()
          patch = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: texture, color: '#e4ecdf', roughness: 1, side: THREE.DoubleSide })); scene.add(patch)
        }
        lastTerrain = p.terrain
      }
      globe.visible = p.view === 'globe' || !p.terrain; grid.visible = p.view === 'globe'; if (patch) patch.visible = p.view === 'local'
      markers.children.forEach(marker => marker.scale.setScalar(p.view === 'local' ? 0.065 : 1))
      markers.visible = p.view === 'globe'
      if (p.selected) {
        const origin = lunarVector(p.selected.latitude_deg, p.selected.longitude_deg, 1 + (p.result?.site_height_km_used || 0) / R + 0.00001)
        selectedMarker.position.copy(origin); selectedMarker.scale.setScalar(p.view === 'local' ? 0.065 : 1)
        const sample = p.result?.samples[p.sampleIndex]
        sunLabel.visible = earthLabel.visible = !!sample
        for (const [key, ball, arrow] of [['sun', sun, sunArrow], ['earth', earth, earthArrow]] as const) {
          ball.visible = arrow.visible = !!sample
          if (sample) {
            const direction = bodyDirection(p.selected, sample[key].azimuth_deg, sample[key].elevation_deg)
            const length = p.view === 'local' ? 0.025 : 0.65
            ball.position.copy(origin).addScaledVector(direction, length); ball.scale.setScalar(p.view === 'local' ? 0.045 : 1)
            const text = key === 'sun' ? sunLabel : earthLabel
            text.position.copy(ball.position).add(lunarVector(p.selected.latitude_deg, p.selected.longitude_deg).multiplyScalar(length * 0.12))
            text.scale.set(length * 0.42, length * 0.105, 1)
            arrow.position.copy(origin); arrow.setDirection(direction); arrow.setLength(length, length * 0.07, length * 0.035)
            if (key === 'sun') light.position.copy(direction).multiplyScalar(5)
          }
        }
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate)
    }
    animate(); focusSite.current(latest.current.selected, latest.current.view)
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); images.forEach(i => { i.onload = null; i.onerror = null }); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('click', pick); scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) { o.geometry?.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m?.dispose()) } }); [sunLabel, earthLabel].forEach(s => { s.material.map?.dispose(); s.material.dispose() }); texture.dispose(); renderer.dispose(); host.replaceChildren() }
  }, [])
  useEffect(() => { focusSite.current(props.selected, props.view) }, [props.selected, props.view, props.focus])
  return <div className="scene-wrapper"><div ref={mount} className="three-mount" aria-label="Explorador lunar 3D: arrastra para orbitar, rueda para acercar"/>{webglError && <div className="scene-error">{webglError}</div>}<div className="texture-credit">{textureState}</div><div className="scene-instructions">Arrastra para orbitar · Rueda para zoom · Mayús + clic para marcar un punto</div></div>
}
