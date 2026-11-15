import math
from pathlib import Path
import struct

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Site
from app.slope import regional_slope
from app.terrain import LolaDem

from test_api import synthetic_dem

SITE = Site(latitude_deg=-89.5, longitude_deg=0)
DN_PER_CELL = 84  # 0.5 m/DN in the label -> 42 m rise per 240 m grid step


def tilted_dem(tmp_path: Path) -> Path:
    """Synthetic DEM: a plane rising toward image right (+x) around SITE."""
    image = synthetic_dem(tmp_path)
    with LolaDem(image) as dem:
        row, col = dem.pixel_index(SITE.latitude_deg, SITE.longitude_deg)
        size = dem.size
    half = 30
    with image.open("r+b") as output:
        for r in range(row - half, row + half + 1):
            output.seek(2 * (r * size + col - half))
            output.write(struct.pack(f"<{2 * half + 1}h", *(DN_PER_CELL * dc for dc in range(-half, half + 1))))
    return image


def test_flat_dem_has_zero_slope(tmp_path: Path):
    with LolaDem(synthetic_dem(tmp_path)) as dem:
        result = regional_slope(dem, SITE, neighborhood_radius_m=500, threshold_deg=5)
    assert result.slope_deg == 0
    assert result.aspect_deg is None
    assert result.neighborhood.max_deg == 0
    assert result.neighborhood.fraction_above_threshold == 0
    assert result.threshold_status == "at_or_below_user_threshold"


def test_tilted_plane_slope_aspect_and_scales(tmp_path: Path):
    with LolaDem(tilted_dem(tmp_path)) as dem:
        result = regional_slope(dem, SITE, neighborhood_radius_m=1000, threshold_deg=5)
        spacing = dem.pixel_ground_spacing_m(result.cell_row, result.cell_col)
    expected = math.degrees(math.atan(42 / spacing))
    assert result.slope_deg == pytest.approx(expected, abs=0.02)
    # Terrain rises toward image right = local east at longitude 0, so it faces west.
    assert result.aspect_deg == pytest.approx(270, abs=0.5)
    assert [s.baseline_m for s in result.multiscale] == pytest.approx([240, 480, 960], abs=0.1)
    assert all(s.slope_deg == pytest.approx(expected, abs=0.02) for s in result.multiscale)
    assert result.neighborhood.fraction_above_threshold == 1
    assert result.threshold_status == "above_user_threshold"
    assert "not a landing-safety assessment" in result.note


def test_no_threshold_means_not_evaluated(tmp_path: Path):
    with LolaDem(tilted_dem(tmp_path)) as dem:
        result = regional_slope(dem, SITE, neighborhood_radius_m=0)
    assert result.threshold_status == "not_evaluated"
    assert result.neighborhood.fraction_above_threshold is None
    assert result.neighborhood.cells == 1


def test_slope_endpoint(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("LUNARPATH_DEM_PATH", str(tilted_dem(tmp_path)))
    with TestClient(app) as client:
        payload = {"site": {"latitude_deg": -89.5, "longitude_deg": 0}, "baseline_pixels": 2,
                   "neighborhood_radius_m": 500, "threshold_deg": 12}
        response = client.post("/api/v1/terrain/slope", json=payload)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["baseline_m"] == pytest.approx(480, abs=0.1)
        assert data["threshold_status"] == "at_or_below_user_threshold"
        assert "safe" not in data["threshold_status"]
        assert client.post("/api/v1/terrain/slope", json={**payload, "baseline_pixels": 3}).status_code == 422
        assert client.get("/api/v1/sites/shackleton/slope?threshold_deg=15").status_code == 200
        assert client.get("/api/v1/sites/unknown/slope").status_code == 404
