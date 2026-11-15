"""UI-facing adapters on top of the existing scientific engine."""
from datetime import timedelta
from typing import Literal
import math
from fastapi import APIRouter, Request, HTTPException, Query, Response
from pydantic import BaseModel, Field, model_validator
from starlette.concurrency import run_in_threadpool
from .models import Scenario, Site, CompareRequest
from .terrain import _destination, TerrainError
from .terrain import fine_covers
from .slope import SlopeRequest, regional_slope
from .mesh import terrain_mesh

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
    return {'dem_ready': request.app.state.dem is not None, 'fine_dem_ready': request.app.state.fine_dem is not None, 'ephemeris': 'JPL Horizons',
            'imagery': 'NASA Moon Trek / LRO WAC', 'terrain': 'NASA PDS LOLA LDEM_75S_240M',
            'note': 'Visibility estimates, not certification of landing safety.'}


class MeshRequest(BaseModel):
    site: Site
    radius_km: float = Field(default=20, ge=1, le=50)
    resolution: int = Field(default=49, ge=9, le=101)

    @model_validator(mode='after')
    def centered_grid(self):
        if self.resolution % 2 == 0:
            raise ValueError('Resolution must be odd to include the observer at the center')
        return self


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
    return {'resolution': n, 'points': points, 'source': f"LOLA_{getattr(dem, 'product_id', 'LDEM_75S_240M')}_PDS", 'pixel_size_m': getattr(dem, 'scale_m', 240), 'grid_spacing_m': payload.radius_km * 2000 / (n - 1),
            'frame': 'MOON_ME DE421', 'radius_km': payload.radius_km}


@router.post('/terrain/mesh')
async def mesh(payload: MeshRequest, request: Request):
    if request.app.state.dem is None:
        raise HTTPException(503, 'LOLA DEM is not installed')
    try:
        fine = request.app.state.fine_dem
        dataset = fine if fine_covers(fine, payload.site, max(5, payload.radius_km * 1.415)) else request.app.state.dem
        return await run_in_threadpool(terrain_grid, dataset, payload)
    except TerrainError as exc:
        raise HTTPException(422, str(exc)) from exc


class SearchRequest(BaseModel):
    scenario: Scenario
    sites: list[Site] = Field(min_length=1, max_length=3)
    date_offsets_days: list[int] = Field(default=[0, 3, 7], min_length=1, max_length=4)
    search_days: int | None = Field(default=None, ge=0, le=7)

    @model_validator(mode='after')
    def bounded_offsets(self):
        if len(set(self.date_offsets_days)) != len(self.date_offsets_days) or any(abs(x) > 90 for x in self.date_offsets_days):
            raise ValueError('Use unique day offsets within 90 days')
        if self.scenario.horizon_profile:
            raise ValueError('Custom horizons cannot be reused across sites')
        offsets = range(self.search_days + 1) if self.search_days is not None else self.date_offsets_days
        duration = (self.scenario.end_utc - self.scenario.start_utc).total_seconds()
        if max(offsets) - min(offsets) > 90 or duration + (max(offsets) - min(offsets)) * 86400 > 14 * 86400:
            raise ValueError('Combined search period must not exceed 14 days')
        if 1440 % self.scenario.step_minutes:
            raise ValueError('Daily search requires a temporal step that divides 24 hours')
        return self


class SensitivityRequest(BaseModel):
    scenario: Scenario
    radius_m: float = Field(default=100, ge=10, le=250)


@router.post('/scenarios/sensitivity')
async def sensitivity(payload: SensitivityRequest, request: Request):
    from .main import evaluate
    if payload.scenario.horizon_profile is not None:
        raise HTTPException(422, 'Spatial sensitivity requires a DEM-based horizon')
    scenario = payload.scenario.model_copy(update={'use_dem_horizon': True})
    points = [(scenario.site.latitude_deg, scenario.site.longitude_deg),
              *[_destination(scenario.site.latitude_deg, scenario.site.longitude_deg, az, payload.radius_m) for az in (0, 90, 180, 270)]]
    evaluated, unavailable = [], []
    for lat, lon in points:
        site = Site(latitude_deg=lat, longitude_deg=((lon+180)%360)-180, label='Sensitivity sample')
        try:
            result = await evaluate(scenario.model_copy(update={'site': site}), request.app.state.horizons, request.app.state.dem, request.app.state.fine_dem)
            evaluated.append({'site': site, 'metrics': result.metrics, 'horizon_source': result.horizon_source})
        except HTTPException as exc:
            unavailable.append({'site': site, 'detail': str(exc.detail)})
    fields = ('sunlit_fraction', 'earth_visible_fraction', 'longest_concurrent_hours', 'longest_darkness_hours')
    if not evaluated:
        raise HTTPException(422, 'No spatial samples could be evaluated; check coverage and ephemerides')
    ranges = {field: {'min': min(getattr(row['metrics'], field) for row in evaluated),
                      'max': max(getattr(row['metrics'], field) for row in evaluated)} for field in fields} if evaluated else {}
    return {'radius_m': payload.radius_m, 'method': 'center_plus_four_cardinal_points',
            'evaluated': evaluated, 'unavailable': unavailable, 'complete': not unavailable,
            'ranges': ranges, 'note': 'Deterministic spatial sensitivity, not a statistical confidence interval or exhaustive neighborhood bound.'}


@router.post('/scenarios/search')
async def search(payload: SearchRequest, request: Request):
    from .main import evaluate
    from .analysis import build_timeline, apply_refined_events, analyze
    rows = []
    unavailable = []
    offsets = list(range(payload.search_days + 1)) if payload.search_days is not None else payload.date_offsets_days
    for site in payload.sites:
        span = payload.scenario.model_copy(update={'site': site,
            'start_utc': payload.scenario.start_utc + timedelta(days=min(offsets)),
            'end_utc': payload.scenario.end_utc + timedelta(days=max(offsets))})
        # Validate the full span; reuse real ephemerides for all candidate dates.
        full = None
        if (span.end_utc - span.start_utc).total_seconds() / (span.step_minutes * 60) <= 500:
            span = Scenario.model_validate(span.model_dump())
            try:
                full = await evaluate(span, request.app.state.horizons, request.app.state.dem, request.app.state.fine_dem)
            except HTTPException as exc:
                unavailable.append({'site': site, 'detail': str(exc.detail), 'status': exc.status_code})
                continue
        for offset in offsets:
            scenario = payload.scenario.model_copy(update={'site': site,
                'start_utc': payload.scenario.start_utc + timedelta(days=offset),
                'end_utc': payload.scenario.end_utc + timedelta(days=offset)})
            if full is None:
                try:
                    result = await evaluate(scenario, request.app.state.horizons, request.app.state.dem, request.app.state.fine_dem)
                except HTTPException as exc:
                    unavailable.append({'site': site, 'detail': f'{scenario.start_utc.isoformat()}: {exc.detail}', 'status': exc.status_code})
                    continue
            else:
                result = full
            samples = [s for s in result.samples if scenario.start_utc <= s.time_utc < scenario.end_utc]
            timeline = build_timeline(scenario, samples)
            timeline.transition_resolution_minutes = result.timeline.transition_resolution_minutes
            if scenario.refine_transitions:
                timeline.refined_transition_resolution_minutes = result.timeline.refined_transition_resolution_minutes
                for event in timeline.events:
                    event.method = 'horizons_refined'
                timeline = apply_refined_events(scenario, timeline)
            result = result.model_copy(update={'scenario': scenario, 'samples': samples, 'timeline': timeline, 'metrics': analyze(scenario, timeline)})
            windows = [w for w in result.metrics.concurrent_windows if w.duration_hours >= scenario.constraints.min_concurrent_hours]
            rows.append({'site': site, 'offset_days': offset, 'result': result,
                'recommended_window': windows[0] if windows and result.metrics.constraints_met else None,
                'explanation': f"{'Cumple' if result.metrics.constraints_met else 'No cumple'} los requisitos. Ventana continua simultánea: {result.metrics.longest_concurrent_hours:.1f} h."})
    rows.sort(key=lambda r: (r['result'].metrics.constraints_met, r['result'].metrics.longest_concurrent_hours,
                            r['result'].metrics.concurrent_fraction), reverse=True)
    return {'options': rows, 'criterion': 'Cumplimiento, duración simultánea continua y fracción simultánea',
            'unavailable': unavailable,
            'any_feasible': any(r['result'].metrics.constraints_met for r in rows),
            'scope': 'Only the requested sites and dates; equal metrics are ties. Not an exhaustive landing search.'}


@router.post('/scenarios/recommend')
async def recommend(payload: CompareRequest, request: Request):
    first = payload.scenarios[0]
    if any((s.start_utc, s.end_utc, s.step_minutes, s.constraints, s.use_dem_horizon) !=
           (first.start_utc, first.end_utc, first.step_minutes, first.constraints, first.use_dem_horizon) for s in payload.scenarios):
        raise HTTPException(422, 'Use the same dates, constraints, sampling and horizon model')
    from .main import evaluate
    results = [await evaluate(s, request.app.state.horizons, request.app.state.dem, request.app.state.fine_dem) for s in payload.scenarios]
    ordered = sorted(enumerate(results), key=lambda p: (p[1].metrics.constraints_met, p[1].metrics.longest_concurrent_hours,
                                                      p[1].metrics.concurrent_fraction), reverse=True)
    return {'any_constraints_met': any(r.metrics.constraints_met for r in results),
            'ranking': [{'scenario_index': i, 'result': r} for i, r in ordered]}


@router.post('/terrain/slope')
async def slope(payload: SlopeRequest, request: Request):
    if request.app.state.dem is None:
        raise HTTPException(503, 'LOLA DEM is not installed')
    try:
        return await run_in_threadpool(regional_slope, request.app.state.dem, payload.site,
            baseline_pixels=payload.baseline_pixels, neighborhood_radius_m=payload.neighborhood_radius_m,
            threshold_deg=payload.threshold_deg)
    except (TerrainError, ValueError) as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post('/terrain/grid')
async def grid(payload: MeshRequest, request: Request):
    dataset = request.app.state.fine_dem if fine_covers(request.app.state.fine_dem, payload.site, 5) else request.app.state.dem
    if dataset is None:
        raise HTTPException(503, 'LOLA DEM is not installed')
    try:
        return await run_in_threadpool(terrain_mesh, dataset, payload.site)
    except TerrainError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.get('/sites/{site_id}/slope')
async def site_slope(site_id: str, request: Request, baseline_pixels: int = 1, threshold_deg: float | None = Query(default=None, gt=0, lt=90)):
    from .catalog import find_site
    site = find_site(site_id)
    if site is None:
        raise HTTPException(404, 'Site not found')
    return await slope(SlopeRequest(site=Site(latitude_deg=site.latitude_deg, longitude_deg=site.longitude_deg), baseline_pixels=baseline_pixels, threshold_deg=threshold_deg), request)
