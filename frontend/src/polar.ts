// Match backend/app/terrain.py and the LOLA PDS3 label. The image covers
// +/-800 source pixels around the pole at 240 m/pixel.
const radiusM = 1_737_400
const scaleM = 240
const halfWidthPixels = 800

export function polarMeters(latitude: number, longitude: number): { x: number; y: number } {
  const rho = 2 * radiusM * Math.tan(((90 + latitude) * Math.PI / 180) / 2)
  const longitudeRad = longitude * Math.PI / 180
  return { x: rho * Math.sin(longitudeRad), y: rho * Math.cos(longitudeRad) }
}

export function coordinatesFromPolarMeters(x: number, y: number): { latitude: number; longitude: number } {
  const rho = Math.hypot(x, y)
  return {
    latitude: 2 * Math.atan(rho / (2 * radiusM)) * 180 / Math.PI - 90,
    longitude: rho === 0 ? 0 : Math.atan2(x, y) * 180 / Math.PI,
  }
}

export function polarMapCoordinates(horizontalFraction: number, verticalFraction: number): { latitude: number; longitude: number } {
  const dx = (horizontalFraction - 0.5) * 2 * halfWidthPixels * scaleM
  const dy = (verticalFraction - 0.5) * 2 * halfWidthPixels * scaleM
  return coordinatesFromPolarMeters(dx, -dy)
}

export function isWithinPolarMap(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > -75 || longitude < -180 || longitude > 180) return false
  const position = polarMapPosition(latitude, longitude)
  const left = Number.parseFloat(position.left)
  const top = Number.parseFloat(position.top)
  // Allow a small rounding margin for coordinates displayed to 0.001°.
  return left >= -0.1 && left <= 100.1 && top >= -0.1 && top <= 100.1
}

export function polarMapPosition(latitude: number, longitude: number): { left: string; top: string } {
  const point = polarMeters(latitude, longitude)
  const dx = point.x / scaleM
  const dy = -point.y / scaleM
  return {
    left: `${50 + dx / (2 * halfWidthPixels) * 100}%`,
    top: `${50 + dy / (2 * halfWidthPixels) * 100}%`,
  }
}
