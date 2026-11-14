export type Point = { latitude_deg: number; longitude_deg: number; height_km?: number; label?: string }
export type CatalogSite = Point & { id: string; name: string; description: string; scientific_interest: string; region: string }
export type Body = { azimuth_deg: number; elevation_deg: number; horizon_deg: number; visible: boolean; disk_fraction: number; disk_state: string }
export type Window = { start_utc: string; end_utc: string; duration_hours: number }
export type Result = {
  scenario: { site: Point; start_utc: string; end_utc: string; step_minutes: number; max_horizon_distance_km?: number }
  samples: { time_utc: string; sun: Body; earth: Body }[]
  metrics: { sunlit_fraction: number; earth_visible_fraction: number; concurrent_fraction: number; longest_concurrent_hours: number; longest_darkness_hours: number; longest_earth_blackout_hours: number; concurrent_windows: Window[]; constraints_met: boolean }
  timeline: { segments: { start_utc: string; end_utc: string; duration_hours: number; sun_visible: boolean; earth_visible: boolean }[] }
  horizon_source: string; site_height_km_used: number; precision_note: string
}
export type Mesh = { resolution: number; points: number[][]; source: string; pixel_size_m: number }
export type Option = { site: Point; offset_days: number; result: Result; explanation: string }
export type SearchResult = { options: Option[]; any_feasible: boolean; criterion: string; scope: string }
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export const apiUrl = (path: string) => `${base}${path}`
export async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : `Error ${response.status}: revisa fechas y parámetros`)
  }
  return response.json() as Promise<T>
}
export const utcLabel = (date: string) => new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(date)) + ' UTC'
