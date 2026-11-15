from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.analysis import disk_exposure
from app.cache import EphemerisCache
from app.catalog import find_site, list_sites
from app.horizons import HorizonsClient
from app.main import app
from app.models import Site
from app.power import PowerConfig, PowerSimulationRequest
from app.ranking import RankingWeights


class MockHorizons:
    """Mock Horizons client for unit tests."""
    def __init__(self, sun_elev: float = 3.0, earth_elev: float = 4.0):
        self.sun_elev = sun_elev
        self.earth_elev = earth_elev

    async def positions(self, body_id, site, start, end, step_minutes):
        elev = self.sun_elev if body_id == 10 else self.earth_elev
        # step in hours
        hours = int((end - start).total_seconds() / 3600)
        return [(start + timedelta(hours=i), 90.0, elev) for i in range(hours)]


def test_ephemeris_cache_sqlite(tmp_path: Path):
    db_file = tmp_path / "cache.sqlite"
    cache = EphemerisCache(db_file)
    assert cache.count() == 0

    start = datetime(2026, 11, 15, 0, 0, tzinfo=timezone.utc)
    end = datetime(2026, 11, 15, 4, 0, tzinfo=timezone.utc)
    data = [(start + timedelta(hours=i), 45.0, 2.5) for i in range(4)]

    # Miss
    assert cache.get(10, -89.5, 0.0, 0.0, start, end, 60) is None

    # Set
    cache.set(10, -89.5, 0.0, 0.0, start, end, 60, data)
    assert cache.count() == 1

    # Hit
    cached = cache.get(10, -89.5, 0.0, 0.0, start, end, 60)
    assert cached is not None
    assert len(cached) == 4
    assert cached[0][1] == 45.0
    assert cached[0][2] == 2.5

    # Clear
    assert cache.clear() == 1
    assert cache.count() == 0


def test_catalog_sites():
    sites = list_sites()
    assert len(sites) >= 10

    artemis_sites = list_sites(artemis_only=True)
    assert len(artemis_sites) >= 5

    mouton = find_site("mouton")
    assert mouton is not None
    assert mouton.name == "Mons Mouton"
    assert mouton.latitude_deg == -84.6

    query_res = list_sites(query="Malapert")
    assert len(query_res) == 1
    assert query_res[0].id == "malapert"

    with TestClient(app) as client:
        res = client.get("/api/v1/sites")
        assert res.status_code == 200
        assert len(res.json()) >= 10

        res_single = client.get("/api/v1/sites/mouton")
        assert res_single.status_code == 200
        assert res_single.json()["name"] == "Mons Mouton"

        res_404 = client.get("/api/v1/sites/unknown-crater")
        assert res_404.status_code == 404


def test_solar_disk_partial_exposure():
    # Completely above horizon: center >= horizon + radius (0.267)
    frac, state = disk_exposure(1.0, 0.0, 0.267)
    assert frac == 1.0
    assert state == "full"

    # Completely occulted: center <= horizon - radius
    frac, state = disk_exposure(-1.0, 0.0, 0.267)
    assert frac == 0.0
    assert state == "none"

    # Half disk: center == horizon
    frac, state = disk_exposure(0.0, 0.0, 0.267)
    assert abs(frac - 0.5) < 0.01
    assert state == "partial"

    # Upper limb barely visible: center = -0.20, horizon = 0, radius = 0.267
    frac, state = disk_exposure(-0.20, 0.0, 0.267)
    assert 0.0 < frac < 0.5
    assert state == "partial"


def test_ranking_scenarios():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=2.0, earth_elev=3.0)
        payload = {
            "scenarios": [
                {
                    "site": {"latitude_deg": -85.4, "longitude_deg": -29.2, "label": "Site Alpha"},
                    "start_utc": "2026-11-15T00:00:00Z",
                    "end_utc": "2026-11-15T06:00:00Z",
                    "step_minutes": 60,
                },
                {
                    "site": {"latitude_deg": -86.0, "longitude_deg": 3.8, "label": "Site Beta"},
                    "start_utc": "2026-11-15T00:00:00Z",
                    "end_utc": "2026-11-15T06:00:00Z",
                    "step_minutes": 60,
                },
            ],
            "weights": {
                "sun": 0.4,
                "earth": 0.3,
                "concurrent": 0.2,
                "darkness_penalty": 0.05,
                "blackout_penalty": 0.05,
            },
        }
        res = client.post("/api/v1/scenarios/rank", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "best_site" in data
        assert "ranked_sites" in data
        assert len(data["ranked_sites"]) == 2
        assert data["ranked_sites"][0]["rank"] == 1
        assert data["ranked_sites"][1]["rank"] == 2
        assert "score" in data["ranked_sites"][0]


def test_power_simulation():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=2.0, earth_elev=3.0)
        payload = {
            "scenario": {
                "site": {"latitude_deg": -85.4, "longitude_deg": -29.2, "label": "Mons Mouton"},
                "start_utc": "2026-11-15T00:00:00Z",
                "end_utc": "2026-11-15T06:00:00Z",
                "step_minutes": 60,
            },
            "config": {
                "solar_panel_area_m2": 3.0,
                "panel_efficiency": 0.30,
                "base_load_watts": 100.0,
                "battery_capacity_wh": 2000.0,
                "initial_soc_percent": 80.0,
                "min_allowable_soc_percent": 20.0,
            },
        }
        res = client.post("/api/v1/simulation/power", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["survives_mission"] is True
        assert "min_soc_percent" in data
        assert len(data["steps"]) == 6
        assert data["steps"][0]["power_generated_w"] > 0


def test_legacy_frontend_adapter():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=1.5, earth_elev=4.5)
        # Matches frontend/src/api.ts contract
        payload = {
            "latitude": -85.4,
            "longitude": -29.2,
            "start_time": "2026-11-15T00:00:00Z",
            "hours": 4,
            "step_minutes": 60,
        }
        res = client.post("/api/scenarios/analyze", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "samples" in data
        assert len(data["samples"]) == 4
        assert "sun_elevation" in data["samples"][0]
        assert "earth_elevation" in data["samples"][0]
        assert "horizon_sun" in data["samples"][0]
        assert "sun_visible" in data["samples"][0]
        assert "metrics" in data
        assert "sunPercent" in data["metrics"]


def test_csv_export():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=2.0, earth_elev=3.0)
        payload = {
            "site": {"latitude_deg": -85.4, "longitude_deg": -29.2, "label": "Mons Mouton"},
            "start_utc": "2026-11-15T00:00:00Z",
            "end_utc": "2026-11-15T04:00:00Z",
            "step_minutes": 60,
        }
        res = client.post("/api/v1/scenarios/export/csv", json=payload)
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("text/csv")
        assert "attachment" in res.headers["content-disposition"]
        text = res.text
        assert "time_utc,hour_offset,sun_azimuth_deg" in text
        lines = text.strip().split("\n")
        assert len(lines) == 5  # header + 4 rows


def test_mission_delta():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=2.0, earth_elev=3.0)
        payload = {
            "baseline_scenario": {
                "site": {"latitude_deg": -85.4, "longitude_deg": -29.2, "label": "Mons Mouton Base"},
                "start_utc": "2026-11-15T00:00:00Z",
                "end_utc": "2026-11-15T06:00:00Z",
                "step_minutes": 60,
            },
            "delay_days": 7.0,
            "delay_hours": 0.0,
            "displacement_meters": 500.0,
            "displacement_azimuth_deg": 90.0,
        }
        res = client.post("/api/v1/scenarios/delta", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "metrics" in data
        assert "risk_level" in data
        assert "executive_summary" in data
        assert data["delay_total_hours"] == 168.0
        assert data["displacement_meters"] == 500.0
        assert data["rescheduled_site"]["latitude_deg"] != 0.0


def test_ephemeris_endpoint():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=2.0, earth_elev=3.0)
        payload = {
            "site": {"latitude_deg": -85.4, "longitude_deg": -29.2},
            "start_utc": "2026-11-15T00:00:00Z",
            "end_utc": "2026-11-15T04:00:00Z",
            "step_minutes": 60,
        }
        res = client.post("/api/v1/ephemeris", json=payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["sun"] is not None
        assert data["earth"] is not None
        assert len(data["sun"]) == 4
        assert len(data["earth"]) == 4


def test_copilot_explain_and_parse():
    with TestClient(app) as client:
        app.state.horizons = MockHorizons(sun_elev=2.0, earth_elev=3.0)
        eval_payload = {
            "site": {"latitude_deg": -85.4, "longitude_deg": -29.2, "label": "Mons Mouton"},
            "start_utc": "2026-11-15T00:00:00Z",
            "end_utc": "2026-11-15T04:00:00Z",
            "step_minutes": 60,
        }
        eval_res = client.post("/api/v1/scenarios/evaluate", json=eval_payload)
        assert eval_res.status_code == 200
        scenario_result = eval_res.json()

        copilot_payload = {
            "scenario_result": scenario_result,
            "user_query": "¿Es suficiente la batería para este sitio?",
        }
        res = client.post("/api/v1/copilot/explain", json=copilot_payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "verdict" in data
        assert "illumination_diagnosis" in data
        assert "direct_answer" in data
        assert "batería" in data["direct_answer"].lower()

        # Parse natural constraints
        parse_res = client.post(
            "/api/v1/copilot/parse-constraints",
            json={"prompt": "Necesito al menos 70% de sol y máximo 8 horas de oscuridad continua con 5 grados de elevación de la tierra"},
        )
        assert parse_res.status_code == 200, parse_res.text
        constraints = parse_res.json()
        assert constraints["min_sunlit_fraction"] == 0.70
        assert constraints["max_darkness_hours"] == 8.0
        assert constraints["min_earth_elevation_deg"] == 5.0

