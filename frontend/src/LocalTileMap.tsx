import { useEffect, useRef, useState } from 'react'
import { LOCAL_LAYERS, localTiles, type LocalLayer } from './moontrek'

export function LocalTileMap({ layer, centerX, centerY, viewWidthM }: { layer: LocalLayer; centerX: number; centerY: number; viewWidthM: number }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [pixels, setPixels] = useState(420)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(() => setPixels(host.clientWidth))
    observer.observe(host)
    setPixels(host.clientWidth)
    return () => observer.disconnect()
  }, [])
  const { tiles, inCoverage, partialCoverage, sourcePixelM } = localTiles(layer, centerX, centerY, viewWidthM, pixels)
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set())
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const signature = tiles.map(tile => tile.key).join('|')
  useEffect(() => { setLoaded(new Set()); setFailed(new Set()) }, [signature])
  const remember = (key: string, ok: boolean) => {
    const setter = ok ? setLoaded : setFailed
    setter(previous => new Set(previous).add(key))
  }
  const noData = !inCoverage || tiles.length === 0 || (loaded.size === 0 && failed.size === tiles.length)
  const partial = partialCoverage || (failed.size > 0 && loaded.size > 0)
  return <>
    <div className="local-tile-layer" aria-hidden="true" ref={hostRef}>
      {tiles.map(tile => <img key={tile.key} src={tile.url} alt="" draggable={false} style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }} onLoad={() => remember(tile.key, true)} onError={event => { event.currentTarget.style.visibility = 'hidden'; remember(tile.key, false) }}/>)}
    </div>
    <div className={`local-coverage ${noData ? 'unavailable' : ''}`} role="status">
      {noData ? `Sin cobertura ${layer === 'lroc' ? 'NAC' : 'LOLA 5 m'} en esta vista` : partial ? 'Cobertura local parcial' : loaded.size ? `${LOCAL_LAYERS[layer].label} · píxel de tesela ${sourcePixelM.toFixed(1)} m` : 'Cargando teselas locales…'}
    </div>
  </>
}
