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


def test_fine_grid_matches_frontend_and_contains_observer():
    from app.planner import terrain_grid, MeshRequest
    from pydantic import ValidationError
    class FineDem:
        scale_m = 20
        product_id = 'LDEM_875S_20M'
        def height_m(self, lat, lon):
            return 50
    point = {'latitude_deg': -89.5, 'longitude_deg': 0}
    grid = terrain_grid(FineDem(), MeshRequest(site=point, radius_km=1, resolution=101))
    assert len(grid['points']) == 10201
    assert grid['points'][5100] == pytest.approx([-89.5, 0, 50])
    assert grid['pixel_size_m'] == grid['grid_spacing_m'] == 20
    with pytest.raises(ValidationError):
        MeshRequest(site=point, radius_km=1, resolution=100)


def test_daily_search_reuses_ephemerides_and_returns_concrete_window():
    class Counting(SunEarth):
        calls = 0
        async def positions(self, *args):
            self.calls += 1
            return await super().positions(*args)
    with TestClient(app) as client:
        upstream = Counting()
        app.state.horizons = upstream
        scenario = {'site': {'latitude_deg': -89.5, 'longitude_deg': 0},
                    'start_utc': '2026-11-15T00:00:00Z', 'end_utc': '2026-11-16T00:00:00Z',
                    'constraints': {'min_concurrent_hours': 6}}
        response = client.post('/api/v1/scenarios/search', json={'scenario': scenario,
            'sites': [scenario['site'], {'latitude_deg': -89.5, 'longitude_deg': 10}], 'search_days': 2})
        assert response.status_code == 200
        assert len(response.json()['options']) == 6
        assert upstream.calls == 4
        assert response.json()['options'][0]['recommended_window']['duration_hours'] == 24


def test_search_reports_unavailable_separately():
    from app.horizons import HorizonsError
    class Broken:
        async def positions(self, *args): raise HorizonsError('test unavailable')
    with TestClient(app) as client:
        app.state.horizons = Broken()
        scenario = {'site': {'latitude_deg': -89.5, 'longitude_deg': 0},
                    'start_utc': '2026-11-15T00:00:00Z', 'end_utc': '2026-11-16T00:00:00Z'}
        data = client.post('/api/v1/scenarios/search', json={'scenario': scenario, 'sites': [scenario['site']], 'search_days': 0}).json()
        assert data['options'] == []
        assert data['unavailable'][0]['status'] == 502


def test_spatial_sensitivity_has_explicit_sample_count_and_ranges():
    with TestClient(app) as client:
        app.state.horizons = SunEarth()
        scenario = {'site': {'latitude_deg': -89.5, 'longitude_deg': 0},
                    'start_utc': '2026-11-15T00:00:00Z', 'end_utc': '2026-11-15T03:00:00Z',
                    'max_horizon_distance_km': 1}
        response = client.post('/api/v1/scenarios/sensitivity', json={'scenario': scenario})
        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data['evaluated']) == 5
        assert data['complete']
        assert data['ranges']['sunlit_fraction']['min'] <= data['ranges']['sunlit_fraction']['max']
