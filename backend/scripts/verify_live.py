"""Explicit online check: python scripts/verify_live.py (from backend)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app


with TestClient(app) as client:
    checks = {}
    scenario = {"site": {"latitude_deg": -89.5, "longitude_deg": 0},
                "start_utc": "2026-11-15T00:00:00Z", "end_utc": "2026-11-15T03:00:00Z"}
    response = client.post("/api/v1/scenarios/evaluate", json=scenario)
    response.raise_for_status()
    checks["horizons"] = {"samples": len(response.json()["samples"]), "horizon_source": response.json()["horizon_source"]}
    response = client.get("/api/v1/maps/layers")
    response.raise_for_status()
    layers = response.json()
    checks["moon_trek_layers"] = len(layers)
    response = client.get(f"/api/v1/maps/layers/{layers[0]['id']}/capabilities")
    response.raise_for_status()
    checks["wmts"] = response.json()
    for product in (78, 90):
        response = client.get(f"/api/v1/terrain/products/{product}")
        response.raise_for_status()
        checks[f"pgda_{product}_datasets"] = len(response.json())
    response = client.get("/api/v1/terrain/elevation", params={"dataset_id": "LDEM_80S_80MPP_ADJ.TIF", "latitude_deg": -89.5, "longitude_deg": 0})
    response.raise_for_status()
    checks["elevation_m"] = response.json()["elevation_m"]
    response = client.post("/api/v1/scenarios/recommend", json={"scenarios": [scenario, {**scenario, "site": {"latitude_deg": -89, "longitude_deg": 20}}]})
    response.raise_for_status()
    checks["ranked_scenarios"] = len(response.json()["ranking"])
    print(json.dumps(checks, indent=2))
