from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app


class SunEarth:
    async def positions(self, body_id, site, start, end, step_minutes):
        rows = []
        instant = start
        while instant <= end:
            rows.append((instant, 90, 5 if site.longitude_deg == 0 else -5))
            instant += timedelta(minutes=step_minutes)
        return rows


def test_search_dates_and_constraints():
    with TestClient(app) as client:
        app.state.horizons = SunEarth()
        scenario = {'site': {'latitude_deg': -89.5, 'longitude_deg': 0},
                    'start_utc': '2026-11-14T00:00:00Z', 'end_utc': '2026-11-15T00:00:00Z',
                    'constraints': {'min_concurrent_hours': 6}}
        response = client.post('/api/v1/scenarios/search', json={'scenario': scenario,
            'sites': [scenario['site'], {'latitude_deg': -89.5, 'longitude_deg': 10}], 'date_offsets_days': [0, 3]})
        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data['options']) == 4
        assert data['any_feasible']
        assert all(o['result']['metrics']['constraints_met'] for o in data['options'][:2])
        assert not any(o['result']['metrics']['constraints_met'] for o in data['options'][2:])
        assert data['options'][1]['result']['scenario']['start_utc'].startswith('2026-11-17')
        assert data['options'][0]['result']['metrics']['longest_concurrent_hours'] == 24


def test_invalid_search_and_tile_bounds():
    with TestClient(app) as client:
        scenario = {'site': {'latitude_deg': -89, 'longitude_deg': 0},
                    'start_utc': '2026-11-14T00:00:00Z', 'end_utc': '2026-11-15T00:00:00Z'}
        assert client.post('/api/v1/scenarios/search', json={'scenario': scenario, 'sites': [scenario['site']],
                           'date_offsets_days': [0, 0]}).status_code == 422
        assert client.get('/api/v1/maps/tiles/8/0/0').status_code == 422
        assert client.get('/api/v1/maps/tiles/2/4/0').status_code == 422


def test_missing_dem_is_explicit():
    with TestClient(app) as client:
        app.state.dem = None
        assert not client.get('/api/v1/status').json()['dem_ready']
        response = client.post('/api/v1/terrain/mesh', json={'site': {'latitude_deg': -89.5, 'longitude_deg': 0}})
        assert response.status_code == 503


def test_dem_grid_uses_coordinates_and_source():
    from app.planner import terrain_grid, MeshRequest
    class FlatDem:
        def height_m(self, lat, lon):
            assert -90 <= lat <= -75
            return 100
    grid = terrain_grid(FlatDem(), MeshRequest(site={'latitude_deg': -89, 'longitude_deg': 0}, resolution=9))
    assert len(grid['points']) == 81
    assert grid['points'][40] == pytest.approx([-89.0, 0.0, 100])
    assert grid['pixel_size_m'] == 240
