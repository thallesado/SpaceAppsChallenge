"""UI-facing adapters on top of the existing scientific engine."""
from datetime import timedelta
from typing import Literal
import math
from fastapi import APIRouter, Request, HTTPException, Query, Response
from pydantic import BaseModel, Field, model_validator
from starlette.concurrency import run_in_threadpool
from .models import Scenario, Site, CompareRequest
from .terrain import _destination, TerrainError

router = APIRouter(prefix="/api/v1", tags=["Explorer"])


@router.get('/maps/layers')
async def layers(request: Request, projection: Literal['southpole', 'northpole', 'equirectangular'] = 'southpole'):
    return await request.app.state.sources.layers(projection)


@router.get('/maps/layers/{layer_id}/capabilities')
async def capabilities(request: Request, layer_id: str):
    return await request.app.state.sources.capabilities(layer_id)


@router.get('/maps/tiles/{level}/{row}/{col}')
async def tile(request: Request, level: int, row: int, col: int):
    if not (0 <= level <= 3 and 0 <= row < 2**level and 0 <= col < 2**(level+1)):
        raise HTTPException(422, 'Invalid tile coordinates')
    sources = request.app.state.sources
    key = ('tile', level, row, col)
    cache = getattr(sources, 'tiles', None)
    if cache is None:
        cache = sources.tiles = {}
    if key not in cache:
        url = f'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{level}/{row}/{col}.jpg'
        try:
            upstream = await sources.client.get(url)
            upstream.raise_for_status()
            if not upstream.headers.get('content-type', '').startswith('image/'):
                raise ValueError('Invalid image')
        except Exception as exc:
            raise HTTPException(502, 'Moon Trek tile unavailable') from exc
        if len(cache) >= 180:
            cache.clear()
        cache[key] = upstream.content
    return Response(cache[key], media_type='image/jpeg', headers={'Cache-Control': 'public, max-age=86400'})


@router.get('/terrain/products/{product}')
async def products(request: Request, product: int):
    if product not in (78, 90):
        raise HTTPException(422, 'Product must be 78 or 90')
    return await request.app.state.sources.products(product)


@router.get('/terrain/elevation')
async def elevation(request: Request, dataset_id: str, product: int = 90,
                    latitude_deg: float = Query(ge=-90, le=90), longitude_deg: float = Query(ge=-180, le=180)):
    if product not in (78, 90):
        raise HTTPException(422, 'Product must be 78 or 90')
    return await request.app.state.sources.elevation(product, dataset_id, latitude_deg, longitude_deg)


@router.get('/status')
def status(request: Request):
    return {'dem_ready': request.app.state.dem is not None, 'ephemeris': 'JPL Horizons',
            'imagery': 'NASA Moon Trek / LRO WAC', 'terrain': 'NASA PDS LOLA LDEM_75S_240M',
            'note': 'Visibility estimates, not certification of landing safety.'}


class MeshRequest(BaseModel):
    site: Site
    radius_km: float = Field(default=20, ge=1, le=50)
    resolution: int = Field(default=49, ge=9, le=81)


def terrain_grid(dem, payload):
    points = []
    n = payload.resolution
    for row in range(n):
        for col in range(n):
            east = (col / (n - 1) * 2 - 1) * payload.radius_km * 1000
            north = (1 - row / (n - 1) * 2) * payload.radius_km * 1000
            lat, lon = _destination(payload.site.latitude_deg, payload.site.longitude_deg,
                                    math.degrees(math.atan2(east, north)), math.hypot(east, north))
            points.append([lat, ((lon + 180) % 360) - 180, dem.height_m(lat, lon)])
    return {'resolution': n, 'points': points, 'source': 'LOLA_LDEM_75S_240M_PDS', 'pixel_size_m': 240,
            'frame': 'MOON_ME DE421', 'radius_km': payload.radius_km}


@router.post('/terrain/mesh')
async def mesh(payload: MeshRequest, request: Request):
    if request.app.state.dem is None:
        raise HTTPException(503, 'LOLA DEM is not installed')
    try:
        return await run_in_threadpool(terrain_grid, request.app.state.dem, payload)
    except TerrainError as exc:
        raise HTTPException(422, str(exc)) from exc


class SearchRequest(BaseModel):
    scenario: Scenario
    sites: list[Site] = Field(min_length=1, max_length=3)
    date_offsets_days: list[int] = Field(default=[0, 3, 7], min_length=1, max_length=4)

    @model_validator(mode='after')
    def bounded_offsets(self):
        if len(set(self.date_offsets_days)) != len(self.date_offsets_days) or any(abs(x) > 90 for x in self.date_offsets_days):
            raise ValueError('Use unique day offsets within 90 days')
        if self.scenario.horizon_profile:
            raise ValueError('Custom horizons cannot be reused across sites')
        return self


@router.post('/scenarios/search')
async def search(payload: SearchRequest, request: Request):
    from .main import evaluate
    rows = []
    for site in payload.sites:
        for offset in payload.date_offsets_days:
            scenario = payload.scenario.model_copy(update={'site': site,
                'start_utc': payload.scenario.start_utc + timedelta(days=offset),
                'end_utc': payload.scenario.end_utc + timedelta(days=offset)})
            result = await evaluate(scenario, request.app.state.horizons, request.app.state.dem)
            rows.append({'site': site, 'offset_days': offset, 'result': result,
                'explanation': f"{'Cumple' if result.metrics.constraints_met else 'No cumple'} los requisitos. Ventana continua simultánea: {result.metrics.longest_concurrent_hours:.1f} h."})
    rows.sort(key=lambda r: (r['result'].metrics.constraints_met, r['result'].metrics.longest_concurrent_hours,
                            r['result'].metrics.concurrent_fraction), reverse=True)
    return {'options': rows, 'criterion': 'Cumplimiento, duración simultánea continua y fracción simultánea',
            'any_feasible': any(r['result'].metrics.constraints_met for r in rows),
            'scope': 'Only the requested sites and dates; equal metrics are ties. Not an exhaustive landing search.'}


@router.post('/scenarios/recommend')
async def recommend(payload: CompareRequest, request: Request):
    first = payload.scenarios[0]
    if any((s.start_utc, s.end_utc, s.step_minutes, s.constraints, s.use_dem_horizon) !=
           (first.start_utc, first.end_utc, first.step_minutes, first.constraints, first.use_dem_horizon) for s in payload.scenarios):
        raise HTTPException(422, 'Use the same dates, constraints, sampling and horizon model')
    from .main import evaluate
    results = [await evaluate(s, request.app.state.horizons, request.app.state.dem) for s in payload.scenarios]
    ordered = sorted(enumerate(results), key=lambda p: (p[1].metrics.constraints_met, p[1].metrics.longest_concurrent_hours,
                                                      p[1].metrics.concurrent_fraction), reverse=True)
    return {'any_constraints_met': any(r.metrics.constraints_met for r in results),
            'ranking': [{'scenario_index': i, 'result': r} for i, r in ordered]}
