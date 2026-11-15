"""Provider calls are simulated here; scientific search uses its real code path."""
import json
from datetime import timedelta

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.generative import SearchPlan


def plan(**updates):
    return {'start_date': '2026-11-15', 'duration_days': 1, 'search_days': 2,
            'site_ids': ['mouton', 'malapert'], 'coordinates': [],
            'constraints': {'min_concurrent_hours': 6, 'min_sunlit_fraction': .4,
                            'min_earth_visible_fraction': .4},
            'assumptions': ['Paso horario y dos sitios del catálogo.'], 'clarification': None, **updates}


def test_missing_key_is_explicit_and_does_not_return_results(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    with TestClient(app) as client:
        assert client.get('/api/v1/assistant/status').json()['configured'] is False
        response = client.post('/api/v1/assistant/plan', json={'text': 'Compara dos sitios', 'reference_date': '2026-11-15'})
        assert response.status_code == 503
        assert 'options' not in response.json()


@pytest.mark.parametrize('updates', [
    {'site_ids': ['invented']}, {'coordinates': [{'latitude_deg': 0, 'longitude_deg': 0}]},
    {'duration_days': 14, 'search_days': 1}, {'site_ids': []},
    {'site_ids': ['mouton', 'malapert'], 'coordinates': [
        {'latitude_deg': -89, 'longitude_deg': 0}, {'latitude_deg': -89, 'longitude_deg': 1}]},
])
def test_plan_rejects_unknown_uncovered_or_excessive_search(updates):
    with pytest.raises(ValidationError):
        SearchPlan(**plan(**updates))


def test_structured_provider_plan_resolves_catalog_coordinates(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-test-secret')
    class Provider:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, headers, json):
            assert headers['x-goog-api-key'] == 'synthetic-test-secret'
            assert 'responseJsonSchema' in json['generationConfig']
            return httpx.Response(200, request=httpx.Request('POST', url), json={'candidates': [
                {'finishReason': 'STOP', 'content': {'parts': [{'text': __import__('json').dumps(plan())}]}}]})
    monkeypatch.setattr('app.generative.httpx.AsyncClient', Provider)
    with TestClient(app) as client:
        response = client.post('/api/v1/assistant/plan', json={'text': 'Compara Mouton y Malapert', 'reference_date': '2026-11-15'})
        assert response.status_code == 200, response.text
        assert response.json()['points'][0]['latitude_deg'] == -84.6
        assert 'synthetic-test-secret' not in response.text
        assert 'metrics' not in response.json()


def test_quota_failure_does_not_leak_provider_or_secret(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-test-secret')
    class Provider:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            return httpx.Response(429, text='synthetic-test-secret', request=httpx.Request('POST', url))
    monkeypatch.setattr('app.generative.httpx.AsyncClient', Provider)
    with TestClient(app) as client:
        response = client.post('/api/v1/assistant/plan', json={'text': 'Compara dos sitios', 'reference_date': '2026-11-15'})
        assert response.status_code == 429
        assert 'synthetic-test-secret' not in response.text


def test_search_executes_engine_not_model_and_preserves_constraints(monkeypatch):
    from app.models import HorizonPoint
    monkeypatch.setattr('app.main.horizon_profile', lambda *args, **kwargs: (
        [HorizonPoint(azimuth_deg=0, elevation_deg=0), HorizonPoint(azimuth_deg=180, elevation_deg=0)], 0))
    monkeypatch.setattr('app.main.product_manifest', lambda dem: {'id': 'synthetic-flat-terrain'})
    class Positions:
        calls = 0
        async def positions(self, body, site, start, end, step):
            self.calls += 1
            rows = []
            while start <= end:
                rows.append((start, 90, 60))
                start += timedelta(minutes=step)
            return rows
    class Dem:
        scale_m = 240
        def height_m(self, lat, lon): return 0
        def close(self): pass
    with TestClient(app) as client:
        app.state.horizons = Positions()
        app.state.dem = Dem()
        app.state.fine_dem = None
        response = client.post('/api/v1/assistant/search', json=plan())
        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data['options']) == 6
        assert app.state.horizons.calls == 4
        assert data['any_feasible']
        assert data['options'][0]['result']['scenario']['constraints']['min_concurrent_hours'] == 6
        assert data['options'][0]['recommended_window']['duration_hours'] == 24
        assert client.post('/api/v1/assistant/search', json=plan(clarification='¿Qué fecha?')).status_code == 422
