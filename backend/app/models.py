from datetime import datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class Site(BaseModel):
    latitude_deg: float = Field(ge=-90, le=90)
    longitude_deg: float = Field(ge=-180, le=180)
    height_km: float = Field(default=0, ge=-10, le=20, description="Height above the Horizons lunar reference ellipsoid, in km")
    label: str | None = Field(default=None, max_length=100)


class HorizonPoint(BaseModel):
    azimuth_deg: float = Field(ge=0, lt=360)
    elevation_deg: float = Field(ge=-90, le=90)
    source: str | None = None
    distance_km: float | None = None


class Constraints(BaseModel):
    min_concurrent_hours: float = Field(default=0, ge=0, le=336)
    min_sunlit_fraction: float = Field(default=0, ge=0, le=1)
    min_earth_visible_fraction: float = Field(default=0, ge=0, le=1)
    max_darkness_hours: float | None = Field(default=None, ge=0)
    max_earth_blackout_hours: float | None = Field(default=None, ge=0)
    min_earth_elevation_deg: float = Field(default=0, ge=0, le=90)


class Scenario(BaseModel):
    site: Site
    start_utc: datetime
    end_utc: datetime
    step_minutes: int = Field(default=60, ge=15, le=1440)
    refine_transitions: bool = False
    refinement_step_minutes: int = Field(default=5, ge=1, le=15)
    horizon_profile: list[HorizonPoint] | None = None
    use_dem_horizon: bool = False
    observer_height_m: float = Field(default=2, ge=0, le=100)
    max_horizon_distance_km: float = Field(default=250, ge=1, le=300)
    constraints: Constraints = Field(default_factory=Constraints)

    @field_validator("start_utc", "end_utc")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Date and time must include a UTC offset")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def validate_range(self) -> "Scenario":
        duration = self.end_utc - self.start_utc
        if duration <= timedelta(0) or duration > timedelta(days=14):
            raise ValueError("Time range must be greater than zero and at most 14 days")
        if duration.total_seconds() / (self.step_minutes * 60) > 500:
            raise ValueError("Time range exceeds 500 steps")
        if self.refine_transitions and self.refinement_step_minutes >= self.step_minutes:
            raise ValueError("refinement_step_minutes must be smaller than step_minutes")
        if self.horizon_profile is not None:
            if self.use_dem_horizon:
                raise ValueError("Choose either horizon_profile or use_dem_horizon")
            if not 2 <= len(self.horizon_profile) <= 360:
                raise ValueError("Horizon profile needs 2 to 360 points")
            azimuths = [p.azimuth_deg for p in self.horizon_profile]
            if azimuths != sorted(set(azimuths)):
                raise ValueError("Horizon azimuths must be sorted and unique")
        return self


class CompareRequest(BaseModel):
    scenarios: list[Scenario] = Field(min_length=2, max_length=5)


class BodyPosition(BaseModel):
    azimuth_deg: float
    elevation_deg: float
    horizon_deg: float
    visible: bool
    disk_fraction: float = Field(default=1.0, ge=0.0, le=1.0, description="Visible fraction of the celestial disk (0.0=occulted, 1.0=full)")
    disk_state: str = Field(default="full", description="'full', 'partial', or 'none'")



class Sample(BaseModel):
    time_utc: datetime
    sun: BodyPosition
    earth: BodyPosition


class Window(BaseModel):
    start_utc: datetime
    end_utc: datetime
    duration_hours: float


class TimelineSegment(BaseModel):
    start_utc: datetime
    end_utc: datetime
    duration_hours: float
    sun_visible: bool
    earth_visible: bool


class TimelineEvent(BaseModel):
    time_utc: datetime
    kind: Literal["sun_visibility_start", "sun_visibility_end", "earth_visibility_start", "earth_visibility_end"]
    bracket_start_utc: datetime
    bracket_end_utc: datetime
    estimated_time_utc: datetime
    method: Literal["sample_grid", "horizons_refined"] = "sample_grid"


class Timeline(BaseModel):
    initial_sun_visible: bool
    initial_earth_visible: bool
    segments: list[TimelineSegment]
    events: list[TimelineEvent]
    next_sun_visibility_start_utc: datetime | None
    next_sun_visibility_end_utc: datetime | None
    next_earth_visibility_start_utc: datetime | None
    next_earth_visibility_end_utc: datetime | None
    transition_resolution_minutes: int
    refined_transition_resolution_minutes: int | None = None
    note: str = "Event times are estimated within the reported brackets. The timeline segments and metrics use the returned sampling grid; events shorter than its interval can be missed."


class Metrics(BaseModel):
    concurrent_windows: list[Window] = Field(default_factory=list)
    longest_concurrent_hours: float = 0
    sunlit_fraction: float
    earth_visible_fraction: float
    concurrent_fraction: float
    longest_darkness_hours: float
    longest_earth_blackout_hours: float
    sunlit_windows: list[Window]
    earth_visible_windows: list[Window]
    constraints_met: bool


class ScenarioResult(BaseModel):
    scenario: Scenario
    samples: list[Sample]
    metrics: Metrics
    timeline: Timeline
    ephemeris_source: str = "JPL Horizons"
    horizon_source: str
    horizon_profile: list[HorizonPoint] = Field(default_factory=list)
    provenance: dict = Field(default_factory=dict)
    site_height_km_used: float
    precision_note: str = "Windows use the reported temporal grid and estimated transition midpoints. Events shorter than that grid can be missed; partial disk exposure is reported separately."


class TerrainRequest(BaseModel):
    site: Site
    observer_height_m: float = Field(default=2, ge=0, le=100)
    max_distance_km: float = Field(default=250, ge=1, le=300)
    azimuth_step_deg: int = Field(default=1)

    @field_validator("azimuth_step_deg")
    @classmethod
    def allowed_azimuth_step(cls, value: int) -> int:
        if value not in (1, 2, 5, 10):
            raise ValueError("Use 1, 2, 5 or 10 degrees")
        return value


class TerrainResult(BaseModel):
    site: Site
    profile: list[HorizonPoint]
    site_height_km_used: float
    source: str = "LOLA_LDEM_75S_240M_PDS"
    pixel_scale_m: float = 240
    reference_radius_m: float = 1_737_400
    note: str = "Interpolated 240 m LOLA terrain, sampled to the requested maximum distance; this is a planning estimate, not landing certification."


class LegacyAnalyzeRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    height_km: float = Field(default=0, ge=-10, le=20)
    start_time: datetime
    hours: int = Field(default=168, ge=1, le=336)
    step_minutes: int = Field(default=60, ge=15, le=1440)
    use_dem_horizon: bool = False
    observer_height_m: float = Field(default=2, ge=0, le=100)
    max_horizon_distance_km: float = Field(default=250, ge=1, le=300)
    min_earth_elevation_deg: float = Field(default=0, ge=0, le=90)

    @field_validator("start_time")
    @classmethod
    def require_tz(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("start_time must include UTC timezone offset")
        return value.astimezone(timezone.utc)


class LegacySample(BaseModel):
    hour: int
    sun_elevation: float
    earth_elevation: float
    horizon_sun: float
    horizon_earth: float
    sun_visible: bool
    earth_visible: bool
    sun_disk_fraction: float = 1.0
    earth_disk_fraction: float = 1.0


class LegacyAnalyzeResponse(BaseModel):
    site: dict
    start: str
    hours: int
    samples: list[LegacySample]
    source: str = "api"
    metrics: dict


class EphemerisRequest(BaseModel):
    site: Site
    start_utc: datetime
    end_utc: datetime
    step_minutes: int = Field(default=60, ge=15, le=1440)
    body_id: Literal[10, 399] | None = Field(default=None, description="Optional body ID (10=Sun, 399=Earth). If omitted, returns both.")

    @field_validator("start_utc", "end_utc")
    @classmethod
    def require_tz(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Date and time must include a UTC offset")
        return value.astimezone(timezone.utc)


    @model_validator(mode="after")
    def bounded_query(self):
        duration = (self.end_utc - self.start_utc).total_seconds()
        if duration <= 0 or duration > 14 * 86400 or duration / (self.step_minutes * 60) > 500:
            raise ValueError("Use a positive interval up to 14 days and 500 steps")
        return self


class EphemerisPoint(BaseModel):
    time_utc: datetime
    azimuth_deg: float
    elevation_deg: float


class EphemerisResponse(BaseModel):
    site: Site
    start_utc: datetime
    end_utc: datetime
    step_minutes: int
    source: str = "JPL Horizons"
    sun: list[EphemerisPoint] | None = None
    earth: list[EphemerisPoint] | None = None


