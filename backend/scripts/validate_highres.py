"""Compare the PDS LOLA 20 m and 240 m south-polar DEMs at covered sites."""

import hashlib
import json
from pathlib import Path

from app.models import Site
from app.slope import _horn
from app.terrain import LolaDem, horizon_profile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend" / "data"
SITES = (
    Site(latitude_deg=-88.3, longitude_deg=-59.5, label="de Gerlache sample"),
    Site(latitude_deg=-89.0, longitude_deg=120.0, label="polar reference"),
    Site(latitude_deg=-87.8, longitude_deg=20.0, label="outer coverage sample"),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    at = (len(ordered) - 1) * fraction
    low = int(at)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (at - low)


def main() -> None:
    results = []
    with LolaDem(DATA / "ldem_75s_240m.img") as broad, LolaDem(DATA / "ldem_875s_20m.img") as fine:
        for site in SITES:
            broad_row, broad_col = broad.pixel_index(site.latitude_deg, site.longitude_deg)
            fine_row, fine_col = fine.pixel_index(site.latitude_deg, site.longitude_deg)
            broad_height = broad.pixel_height_m(broad_row, broad_col)
            fine_height = fine.pixel_height_m(fine_row, fine_col)
            broad_slope, _ = _horn(broad, broad_row, broad_col, 1)
            fine_slope_240, _ = _horn(fine, fine_row, fine_col, 12)
            fine_slope_20, _ = _horn(fine, fine_row, fine_col, 1)
            broad_horizon, _ = horizon_profile(broad, site, max_distance_km=5, azimuth_step_deg=5)
            fine_horizon, _ = horizon_profile(fine, site, max_distance_km=5, azimuth_step_deg=5)
            differences = [abs(a.elevation_deg - b.elevation_deg) for a, b in zip(broad_horizon, fine_horizon)]
            results.append({
                "site": site.label, "latitude_deg": site.latitude_deg, "longitude_deg": site.longitude_deg,
                "height_240m_m": broad_height, "height_20m_m": fine_height,
                "absolute_height_difference_m": abs(fine_height - broad_height),
                "slope_240m_dem_deg": broad_slope,
                "slope_20m_dem_at_240m_baseline_deg": fine_slope_240,
                "slope_20m_dem_at_20m_baseline_deg": fine_slope_20,
                "horizon_mean_absolute_difference_deg": sum(differences) / len(differences),
                "horizon_p90_absolute_difference_deg": percentile(differences, 0.9),
                "horizon_max_absolute_difference_deg": max(differences),
            })
    report = {
        "source": "NASA PDS LOLA LDEM_75S_240M and LDEM_875S_20M",
        "sha256": {name: sha256(DATA / name) for name in ("ldem_75s_240m.img", "ldem_875s_20m.img")},
        "coverage_20m": "South pole to 87.5 degrees south; sampled sites lie within coverage",
        "pixel_scale_m": [240, 20], "horizon_range_km": 5, "horizon_azimuth_step_deg": 5,
        "sites": results,
        "limit": "Both grids derive from LOLA, with distinct resolution/interpolation. No independent terrain survey. The 20 m grid does not resolve lander-footprint hazards or certify landing safety.",
    }
    path = ROOT / "docs" / "VALIDACION_DEM_20M.json"
    path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(path)
    for item in results:
        print(item["site"], "height difference", item["absolute_height_difference_m"], "horizon mean", item["horizon_mean_absolute_difference_deg"])


if __name__ == "__main__":
    main()
