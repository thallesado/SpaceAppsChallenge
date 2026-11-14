from datetime import timedelta
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.sources import Sources, SourceError
from app.horizons import parse_ephemeris, HorizonsError


PAYLOAD = {"site": {"latitude_deg": -89.5, "longitude_deg": 0},
           "start_utc": "2026-11-15T00:00:00Z", "end_utc": "2026-11-15T03:00:00Z",
           "constraints": {"min_concurrent_hours": 2}}


class Positions:
    async def positions(self, body_id, site, start, end, step_minutes):
        return [(start + timedelta(hours=i), 90, 5 if i < 2 else -1) for i in range(4)]


def test_concurrent_windows_and_recommendation():
    with TestClient(app) as client:
        app.state.horizons = Positions()
        data = client.post('/api/v1/scenarios/evaluate', json=PAYLOAD).json()
        assert data['metrics']['longest_concurrent_hours'] == 2
        assert data['metrics']['concurrent_windows'][0]['duration_hours'] == 2
        assert data['metrics']['constraints_met']
        response = client.post('/api/v1/scenarios/recommend', json={'scenarios': [PAYLOAD, PAYLOAD]})
        assert response.status_code == 200
        assert response.json()['any_constraints_met']


def test_legacy_endpoint_and_validation():
    with TestClient(app) as client:
        app.state.horizons = Positions()
        data = {'latitude': -89.5, 'longitude': 0, 'start_time': PAYLOAD['start_utc'], 'hours': 3}
        response = client.post('/api/scenarios/analyze', json=data)
        assert response.status_code == 200
        assert len(response.json()['samples']) == 3
        assert response.json()['samples'][-1]['hour'] == 2
        data['start_time'] = '2026-11-15T00:00:00'
        assert client.post('/api/scenarios/analyze', json=data).status_code == 422


def test_empty_upstream_is_502():
    class Empty:
        async def positions(self, *args): return []
    with TestClient(app) as client:
        app.state.horizons = Empty()
        assert client.post('/api/v1/scenarios/evaluate', json=PAYLOAD).status_code == 502


def test_reject_nonfinite_horizons():
    with pytest.raises(HorizonsError):
        parse_ephemeris('$$SOE\n2026-Nov-15 00:00:00,*, ,nan,5,\n$$EOE')


def test_catalog_resolves_only_official_tiffs():
    import asyncio
    async def run():
        def handler(request):
            return httpx.Response(200, text='<a href="/data/LDEM_test.TIF">DEM</a><a href="https://evil.example/a.tif">bad</a>')
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await Sources(client).products(90)
            assert len(result) == 1
            assert result[0]['url'] == 'https://pgda.gsfc.nasa.gov/data/LDEM_test.TIF'
    asyncio.run(run())


def test_dem_sampling_and_outside_coverage(tmp_path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_origin
    from app.sources import sample_dem
    path = tmp_path / 'terrain.tif'
    crs = '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +a=1737400 +b=1737400 +units=m'
    with rasterio.open(path, 'w', driver='GTiff', width=4, height=4, count=1,
                       dtype='float32', crs=crs, transform=from_origin(-200, 200, 100, 100), nodata=-9999) as dem:
        dem.write(np.full((1, 4, 4), 123, dtype='float32'))
    result = sample_dem({'url': str(path)}, -90, 0)
    assert result['elevation_m'] == 123
    assert result['pixel_size_m'] == [100, 100]
    with pytest.raises(SourceError, match='outside'):
        sample_dem({'url': str(path)}, -80, 0)


def test_source_failure_is_not_demo():
    class Broken:
        async def layers(self, projection): raise SourceError('NASA unavailable')
    with TestClient(app) as client:
        app.state.sources = Broken()
        response = client.get('/api/v1/maps/layers')
        assert response.status_code == 502
        assert response.json() == {'detail': 'NASA unavailable'}


def test_product_path_and_query_coercion():
    class Catalog:
        async def products(self, product): return [{'product': product}]
        async def elevation(self, product, dataset_id, lat, lon): return {'product': product}
    with TestClient(app) as client:
        app.state.sources = Catalog()
        assert client.get('/api/v1/terrain/products/78').json() == [{'product': 78}]
        assert client.get('/api/v1/terrain/products/90').status_code == 200
        assert client.get('/api/v1/terrain/products/79').status_code == 422
        assert client.get('/api/v1/terrain/elevation?product=90&dataset_id=LDEM_x&latitude_deg=-89&longitude_deg=0').json() == {'product': 90}
