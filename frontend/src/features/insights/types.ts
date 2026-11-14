export type Point = {
  latitude_deg: number
  longitude_deg: number
  height_km?: number
  label?: string
}

export type Body = {
  azimuth_deg: number
  elevation_deg: number
  horizon_deg: number
  visible: boolean
  disk_fraction: number
  disk_state: string
}

export type Window = {
  start_utc: string
  end_utc: string
  duration_hours: number
}

export type Result = {
  scenario: {
    site: Point
    start_utc: string
    end_utc: string
    step_minutes: number
  }
  samples: {
    time_utc: string
    sun: Body
    earth: Body
  }[]
  metrics: {
    sunlit_fraction: number
    earth_visible_fraction: number
    concurrent_fraction: number
    longest_concurrent_hours: number
    longest_darkness_hours: number
    longest_earth_blackout_hours: number
    concurrent_windows: Window[]
    constraints_met: boolean
  }
  horizon_source: string
  site_height_km_used: number
  precision_note: string
}

export type Option = {
  site: Point
  offset_days: number
  result: Result
  explanation: string
}

export interface ResultsPanelProps {
  options: Option[]
  selectedIndex: number | null
  requiredHours: number
  loading: boolean
  error: string | null
  onSelect: (index: number) => void
}

export type HorizonProfilePoint = {
  azimuth_deg: number
  elevation_deg: number
}

export type HorizonSample = {
  sun: Body
  earth: Body
}

export interface HorizonPanelProps {
  profile: HorizonProfilePoint[] | null
  sample: HorizonSample | null
  timeUtc: string | null
  source: string
  loading: boolean
  error: string | null
}

export interface GuidePanelProps {
  open: boolean
  onClose: () => void
}
