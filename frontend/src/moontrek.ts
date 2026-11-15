/** Moon Trek south-polar WMTS parameters verified against GetCapabilities. */
export type LocalLayer = 'lroc' | 'lola'
export type Tile = { key: string; url: string; left: number; top: number; size: number }

const root = 'https://trek.nasa.gov/tiles/Moon/SP'
const origin = 1_095_930
const scaleAtFive = 955_575.1255580344
const tileSize = 256

export const LOCAL_LAYERS: Record<LocalLayer, { id: string; bounds: [number, number, number, number]; maxZoom: number; label: string }> = {
  lroc: { id: 'LRO_NAC_Mosaic_SPole85.5_1mp', bounds: [-136_526, -136_526, 136_526, 136_526], maxZoom: 11, label: 'LROC NAC · ~1 m de origen' },
  lola: { id: 'LRO_LOLA_Shade_SPole875_5mp_v04', bounds: [-75_840, -75_840, 75_840, 75_840], maxZoom: 9, label: 'LOLA · 5 m de origen' },
}

export function localTiles(layer: LocalLayer, centerX: number, centerY: number, viewWidthM: number, viewPixels: number): { tiles: Tile[]; inCoverage: boolean; partialCoverage: boolean; sourcePixelM: number } {
  const config = LOCAL_LAYERS[layer]
  const zoom = Math.min(config.maxZoom, Math.max(0, Math.round(Math.log2(2_192_000 / viewWidthM))))
  const sourcePixelM = scaleAtFive * 0.00028 * 2 ** (5 - zoom)
  const leftM = centerX - viewWidthM / 2
  const rightM = centerX + viewWidthM / 2
  const topM = centerY + viewWidthM / 2
  const bottomM = centerY - viewWidthM / 2
  const [minX, minY, maxX, maxY] = config.bounds
  const inCoverage = leftM < maxX && rightM > minX && bottomM < maxY && topM > minY
  const partialCoverage = inCoverage && (leftM < minX || rightM > maxX || bottomM < minY || topM > maxY)
  if (!inCoverage) return { tiles: [], inCoverage, partialCoverage, sourcePixelM }
  const span = tileSize * sourcePixelM
  const firstCol = Math.floor((leftM + origin) / span)
  const lastCol = Math.floor((rightM + origin) / span)
  const firstRow = Math.floor((origin - topM) / span)
  const lastRow = Math.floor((origin - bottomM) / span)
  const tiles: Tile[] = []
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const tileLeftM = -origin + col * span
      const tileTopM = origin - row * span
      if (tileLeftM >= maxX || tileLeftM + span <= minX || tileTopM <= minY || tileTopM - span >= maxY) continue
      tiles.push({
        key: `${layer}-${zoom}-${row}-${col}`,
        url: `${root}/${config.id}/1.0.0/default/default028mm/${zoom}/${row}/${col}.png`,
        left: (tileLeftM - leftM) / viewWidthM * viewPixels,
        top: (topM - tileTopM) / viewWidthM * viewPixels,
        size: span / viewWidthM * viewPixels,
      })
    }
  }
  return { tiles, inCoverage, partialCoverage, sourcePixelM }
}

