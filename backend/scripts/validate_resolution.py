"""Measure temporal and DEM-resolution sensitivity for one polar scenario.

Run with the backend virtual environment. Writes docs/VALIDACION_RESOLUCION.json.
The 480/960 m DEM variants are coarsenings of the same LOLA product, not
independent high-resolution terrain references.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import json
from pathlib import Path

import httpx

from app.analysis import horizon_at
from app.horizons import HorizonsClient
from app.main import evaluate
from app.models import Scenario, Site
from app.terrain import LolaDem, horizon_profile

ROOT = Path(__file__).resolve().parents[2]


class CoarsenedDem:
    def __init__(self, original: LolaDem, factor: int):
        self.original = original
        self.factor = factor
        self.radius_m = original.radius_m
        self.scale_m = original.scale_m * factor

    @lru_cache(maxsize=100_000)
    def _block_height(self, row: int, col: int) -> float:
        return sum(self.original.pixel_height_m(row + dr, col + dc)
                   for dr in range(self.factor) for dc in range(self.factor)) / self.factor ** 2

    def height_m(self, latitude_deg: float, longitude_deg: float) -> float:
        row, col = self.original.pixel_index(latitude_deg, longitude_deg)
        return self._block_height(row // self.factor * self.factor, col // self.factor * self.factor)


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = fraction * (len(ordered) - 1)
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


async def main() -> None:
    start = datetime(2026, 11, 15, tzinfo=timezone.utc)
    end = start + timedelta(hours=24)
    site = Site(latitude_deg=-86.0, longitude_deg=3.8, label="Malapert sample coordinate")
    dem_path = ROOT / "backend/data/ldem_75s_240m.img"
    profiles = {}
    heights = {}
    with LolaDem(dem_path) as dem:
        for factor in (1, 2, 4):
            source = dem if factor == 1 else CoarsenedDem(dem, factor)
            profiles[factor], heights[factor] = horizon_profile(source, site, max_distance_km=50, azimuth_step_deg=5)
        site.height_km = heights[1]

    async with httpx.AsyncClient(timeout=60) as client:
        horizons = HorizonsClient(client)
        results = {}
        for minutes in (60, 15, 5):
            scenario = Scenario(site=site, start_utc=start, end_utc=end, step_minutes=60,
                                refine_transitions=minutes < 60,
                                refinement_step_minutes=minutes if minutes < 60 else 5,
                                horizon_profile=profiles[1])
            results[minutes] = await evaluate(scenario, horizons)
        equator_results = {}
        equator_start = datetime(2026, 11, 16, tzinfo=timezone.utc)
        for minutes in (60, 15, 5):
            scenario = Scenario(site=Site(latitude_deg=0, longitude_deg=0, label="Geometric temporal reference"),
                                start_utc=equator_start, end_utc=equator_start + timedelta(days=2),
                                step_minutes=60, refine_transitions=minutes < 60,
                                refinement_step_minutes=minutes if minutes < 60 else 5)
            equator_results[minutes] = await evaluate(scenario, horizons)

    temporal = {str(minutes): {
        "samples": len(result.samples),
        "sunlit_fraction": result.metrics.sunlit_fraction,
        "earth_visible_fraction": result.metrics.earth_visible_fraction,
        "longest_darkness_hours": result.metrics.longest_darkness_hours,
        "longest_earth_blackout_hours": result.metrics.longest_earth_blackout_hours,
        "transition_bracket_minutes": result.timeline.transition_resolution_minutes,
        "events": len(result.timeline.events),
    } for minutes, result in results.items()}
    equator_temporal = {str(minutes): {
        "samples": len(result.samples),
        "sunlit_fraction": result.metrics.sunlit_fraction,
        "longest_darkness_hours": result.metrics.longest_darkness_hours,
        "transition_bracket_minutes": result.timeline.transition_resolution_minutes,
        "events": len(result.timeline.events),
    } for minutes, result in equator_results.items()}
    reference = profiles[1]
    fine_samples = results[5].samples
    dem_sensitivity = {}
    for factor in (2, 4):
        candidate = profiles[factor]
        errors = [abs(a.elevation_deg - b.elevation_deg) for a, b in zip(reference, candidate)]
        sun_disagreement = sum(
            (sample.sun.elevation_deg > horizon_at(reference, sample.sun.azimuth_deg))
            != (sample.sun.elevation_deg > horizon_at(candidate, sample.sun.azimuth_deg))
            for sample in fine_samples
        )
        earth_disagreement = sum(
            (sample.earth.elevation_deg > horizon_at(reference, sample.earth.azimuth_deg))
            != (sample.earth.elevation_deg > horizon_at(candidate, sample.earth.azimuth_deg))
            for sample in fine_samples
        )
        dem_sensitivity[str(240 * factor)] = {
            "mean_absolute_horizon_difference_deg": sum(errors) / len(errors),
            "p90_absolute_horizon_difference_deg": percentile(errors, 0.9),
            "max_absolute_horizon_difference_deg": max(errors),
            "sun_center_visibility_disagreement_fraction": sun_disagreement / len(fine_samples),
            "earth_center_visibility_disagreement_fraction": earth_disagreement / len(fine_samples),
        }

    report = {
        "site": {"latitude_deg": site.latitude_deg, "longitude_deg": site.longitude_deg},
        "period_start_utc": start.isoformat(), "period_end_utc": end.isoformat(),
        "ephemeris_source": "JPL Horizons", "terrain_source": "NASA PDS LOLA LDEM_75S_240M",
        "horizon_range_km": 50, "azimuth_step_deg": 5,
        "temporal_minutes": temporal,
        "temporal_equator_geometric_reference_minutes": equator_temporal,
        "temporal_difference_60_vs_5": {
            "sunlit_fraction_abs": abs(results[60].metrics.sunlit_fraction - results[5].metrics.sunlit_fraction),
            "earth_visible_fraction_abs": abs(results[60].metrics.earth_visible_fraction - results[5].metrics.earth_visible_fraction),
        },
        "equator_sunlit_fraction_difference_60_vs_5": abs(equator_results[60].metrics.sunlit_fraction - equator_results[5].metrics.sunlit_fraction),
        "dem_coarsening_from_240m": dem_sensitivity,
        "limits": "Sensitivity of this site and period only. Coarsened DEMs are not independent terrain data; fine obstacles remain unresolved. Visibility comparison uses body centers, not disk fractions. No landing certification.",
    }
    output = ROOT / "docs/VALIDACION_RESOLUCION.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
