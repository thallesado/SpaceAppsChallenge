from datetime import datetime
import math

from .models import (BodyPosition, HorizonPoint, Metrics, Sample, Scenario, Timeline,
                     TimelineEvent, TimelineSegment, Window)

SUN_ANGULAR_RADIUS_DEG = 0.267
EARTH_ANGULAR_RADIUS_DEG = 0.950


def disk_exposure(center_elevation: float, horizon_elevation: float, angular_radius: float) -> tuple[float, str]:
    delta = center_elevation - horizon_elevation
    if delta >= angular_radius:
        return 1.0, "full"
    if delta <= -angular_radius:
        return 0.0, "none"
    x = max(-1.0, min(1.0, delta / angular_radius))
    fraction = (math.acos(-x) + x * math.sqrt(max(0.0, 1.0 - x * x))) / math.pi
    return round(float(fraction), 4), "partial"


def horizon_at(profile: list[HorizonPoint] | None, azimuth: float) -> float:
    if profile is None:
        return 0.0
    points = [(p.azimuth_deg, p.elevation_deg) for p in profile]
    points = [(points[-1][0] - 360, points[-1][1]), *points, (points[0][0] + 360, points[0][1])]
    for (a0, h0), (a1, h1) in zip(points, points[1:]):
        if a0 <= azimuth <= a1:
            return h0 + (h1 - h0) * (azimuth - a0) / (a1 - a0)
    raise ValueError("Invalid azimuth")


def position(
    azimuth: float,
    elevation: float,
    profile: list[HorizonPoint] | None,
    clearance: float = 0,
    is_sun: bool = False,
) -> BodyPosition:
    horizon = horizon_at(profile, azimuth)
    radius = SUN_ANGULAR_RADIUS_DEG if is_sun else EARTH_ANGULAR_RADIUS_DEG
    fraction, state = disk_exposure(elevation, horizon + clearance, radius)
    return BodyPosition(
        azimuth_deg=azimuth,
        elevation_deg=elevation,
        horizon_deg=horizon,
        visible=elevation > horizon + clearance,
        disk_fraction=fraction,
        disk_state=state,
    )



def build_timeline(scenario: Scenario, samples: list[Sample]) -> Timeline:
    if not samples or samples[0].time_utc != scenario.start_utc:
        raise ValueError("Timeline requires a sample at the start of the scenario")
    if any(a.time_utc >= b.time_utc for a, b in zip(samples, samples[1:])):
        raise ValueError("Timeline samples must be strictly increasing")
    segments: list[TimelineSegment] = []
    events: list[TimelineEvent] = []
    previous: Sample | None = None
    for index, sample in enumerate(samples):
        if sample.time_utc >= scenario.end_utc:
            raise ValueError("Timeline samples must precede the scenario end")
        if previous is not None:
            if previous.sun.visible != sample.sun.visible:
                events.append(TimelineEvent(time_utc=sample.time_utc,
                                            kind="sun_visibility_start" if sample.sun.visible else "sun_visibility_end",
                                            bracket_start_utc=previous.time_utc, bracket_end_utc=sample.time_utc,
                                            estimated_time_utc=previous.time_utc + (sample.time_utc - previous.time_utc) / 2))
            if previous.earth.visible != sample.earth.visible:
                events.append(TimelineEvent(time_utc=sample.time_utc,
                                            kind="earth_visibility_start" if sample.earth.visible else "earth_visibility_end",
                                            bracket_start_utc=previous.time_utc, bracket_end_utc=sample.time_utc,
                                            estimated_time_utc=previous.time_utc + (sample.time_utc - previous.time_utc) / 2))
        end = samples[index + 1].time_utc if index + 1 < len(samples) else scenario.end_utc
        hours = (end - sample.time_utc).total_seconds() / 3600
        if segments and segments[-1].sun_visible == sample.sun.visible and segments[-1].earth_visible == sample.earth.visible:
            segments[-1].end_utc = end
            segments[-1].duration_hours += hours
        else:
            segments.append(TimelineSegment(start_utc=sample.time_utc, end_utc=end,
                                            duration_hours=hours, sun_visible=sample.sun.visible,
                                            earth_visible=sample.earth.visible))
        previous = sample

    def first_event(kind: str) -> datetime | None:
        return next((event.estimated_time_utc for event in events if event.kind == kind), None)

    return Timeline(initial_sun_visible=samples[0].sun.visible,
                    initial_earth_visible=samples[0].earth.visible,
                    segments=segments, events=events,
                    next_sun_visibility_start_utc=first_event("sun_visibility_start"),
                    next_sun_visibility_end_utc=first_event("sun_visibility_end"),
                    next_earth_visibility_start_utc=first_event("earth_visibility_start"),
                    next_earth_visibility_end_utc=first_event("earth_visibility_end"),
                    transition_resolution_minutes=scenario.step_minutes)


def apply_refined_events(scenario: Scenario, timeline: Timeline) -> Timeline:
    """Rebuild half-open intervals from the same transition times used by metrics."""
    if not timeline.events or timeline.refined_transition_resolution_minutes is None:
        return timeline
    events = sorted(timeline.events, key=lambda event: event.estimated_time_utc)
    sun_visible = timeline.initial_sun_visible
    earth_visible = timeline.initial_earth_visible
    cursor = scenario.start_utc
    segments: list[TimelineSegment] = []

    def append_until(end: datetime) -> None:
        nonlocal cursor
        if end > cursor:
            segments.append(TimelineSegment(
                start_utc=cursor, end_utc=end,
                duration_hours=(end - cursor).total_seconds() / 3600,
                sun_visible=sun_visible, earth_visible=earth_visible,
            ))
            cursor = end

    for event in events:
        if not scenario.start_utc < event.estimated_time_utc < scenario.end_utc:
            raise ValueError("Refined event falls outside the scenario range")
        append_until(event.estimated_time_utc)
        if event.kind.startswith("sun_"):
            sun_visible = event.kind.endswith("_start")
        else:
            earth_visible = event.kind.endswith("_start")
    append_until(scenario.end_utc)
    timeline.segments = segments
    timeline.note = (
        "Segments and metrics use the midpoint of each refined transition bracket. "
        "The bracket gives its time uncertainty; events entirely between coarse samples may still be missed."
    )
    return timeline


def _windows(segments: list[TimelineSegment], visible_field: str) -> tuple[list[Window], float, float]:
    windows: list[Window] = []
    visible_total = 0.0
    longest_hidden = 0.0
    hidden_run = 0.0
    for segment in segments:
        if ((segment.sun_visible and segment.earth_visible) if visible_field == "both" else getattr(segment, visible_field)):
            visible_total += segment.duration_hours
            if windows and windows[-1].end_utc == segment.start_utc:
                windows[-1].end_utc = segment.end_utc
                windows[-1].duration_hours += segment.duration_hours
            else:
                windows.append(Window(start_utc=segment.start_utc, end_utc=segment.end_utc,
                                      duration_hours=segment.duration_hours))
            longest_hidden = max(longest_hidden, hidden_run)
            hidden_run = 0.0
        else:
            hidden_run += segment.duration_hours
    longest_hidden = max(longest_hidden, hidden_run)
    return windows, visible_total, longest_hidden


def analyze(scenario: Scenario, timeline: Timeline) -> Metrics:
    duration_hours = (scenario.end_utc - scenario.start_utc).total_seconds() / 3600
    sun_windows, sun_hours, darkness = _windows(timeline.segments, "sun_visible")
    earth_windows, earth_hours, blackout = _windows(timeline.segments, "earth_visible")
    concurrent_hours = sum(segment.duration_hours for segment in timeline.segments
                           if segment.sun_visible and segment.earth_visible)
    concurrent_windows, _, _ = _windows(timeline.segments, "both")
    longest_concurrent = max((w.duration_hours for w in concurrent_windows), default=0)
    constraints = scenario.constraints
    sun_fraction = sun_hours / duration_hours
    earth_fraction = earth_hours / duration_hours
    met = sun_fraction >= constraints.min_sunlit_fraction and earth_fraction >= constraints.min_earth_visible_fraction
    met &= longest_concurrent >= constraints.min_concurrent_hours
    if constraints.max_darkness_hours is not None:
        met &= darkness <= constraints.max_darkness_hours
    if constraints.max_earth_blackout_hours is not None:
        met &= blackout <= constraints.max_earth_blackout_hours
    return Metrics(concurrent_windows=concurrent_windows, longest_concurrent_hours=longest_concurrent, sunlit_fraction=sun_fraction, earth_visible_fraction=earth_fraction,
                   concurrent_fraction=concurrent_hours / duration_hours,
                   longest_darkness_hours=darkness, longest_earth_blackout_hours=blackout,
                   sunlit_windows=sun_windows, earth_visible_windows=earth_windows, constraints_met=met)
