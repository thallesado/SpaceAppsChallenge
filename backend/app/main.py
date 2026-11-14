from contextlib import asynccontextmanager
import csv
from datetime import timedelta
import io
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from starlette.concurrency import run_in_threadpool

from .analysis import analyze, apply_refined_events, build_timeline, position
from .cache import EphemerisCache
from .catalog import CatalogSite, find_site, list_sites
from .copilot import CopilotRequest, CopilotResponse, diagnose_scenario, parse_natural_constraints
from .delta import MissionDeltaRequest, MissionDeltaResult, compute_mission_delta, shift_lunar_coordinates
from .horizons import HorizonsClient, HorizonsError
from .models import (
    CompareRequest,
    Constraints,
    EphemerisPoint,
    EphemerisRequest,
    EphemerisResponse,
    LegacyAnalyzeRequest,
    LegacyAnalyzeResponse,
    LegacySample,
    Sample,
    Scenario,
    ScenarioResult,
    Site,
    TerrainRequest,
    TerrainResult,
)
from .power import PowerSimulationRequest, PowerSimulationResult, simulate_power
from .ranking import RankRequest, RankingResponse, rank_scenarios
from .terrain import LolaDem, TerrainError, horizon_profile
from .transitions import effective_step_minutes
from .sources import Sources, SourceError
from .planner import router as planner_router
from fastapi.responses import JSONResponse

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    default_dem = BACKEND_DIR / "data" / "ldem_75s_240m.img"
    configured_dem = Path(os.getenv("LUNARPATH_DEM_PATH", str(default_dem)))
    if not configured_dem.is_absolute():
        configured_dem = BACKEND_DIR / configured_dem
    app.state.dem = LolaDem(configured_dem) if configured_dem.exists() else None

    # Persistent ephemeris cache
    default_cache = BACKEND_DIR / "data" / "horizons_runtime.sqlite"
    cache_path = os.getenv("LUNARPATH_CACHE_DB", str(default_cache))
    cache_enabled = os.getenv("LUNARPATH_CACHE_ENABLED", "true").lower() in ("true", "1", "yes")
    app.state.cache = EphemerisCache(cache_path) if cache_enabled else None

    async with httpx.AsyncClient(timeout=60, follow_redirects=True, limits=httpx.Limits(max_connections=10)) as client:
        app.state.horizons = HorizonsClient(client, cache=app.state.cache)
        app.state.sources = Sources(client)
        yield
    if app.state.dem is not None:
        app.state.dem.close()


app = FastAPI(
    title="LunarPath AI API",
    description="Scientific API for lunar South Pole illumination, Earth visibility, LOLA DEM horizons, and landing site evaluation.",
    version="0.2.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("LUNARPATH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Catalog endpoints (Official Artemis candidate landing regions & polar sites)
# ---------------------------------------------------------------------------


@app.get("/api/v1/catalog/sites", response_model=list[CatalogSite], tags=["Catalog"])
@app.get("/api/v1/sites", response_model=list[CatalogSite], tags=["Catalog"])
def get_catalog_sites(
    artemis_only: bool = Query(default=False, description="Filter only official Artemis candidate regions"),
    query: str | None = Query(default=None, description="Search query by name or region"),
) -> list[CatalogSite]:
    return list_sites(artemis_only=artemis_only, query=query)


@app.get("/api/v1/catalog/sites/{site_id}", response_model=CatalogSite, tags=["Catalog"])
@app.get("/api/v1/sites/{site_id}", response_model=CatalogSite, tags=["Catalog"])
def get_catalog_site(site_id: str) -> CatalogSite:
    site = find_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found in lunar catalog")
    return site


# ---------------------------------------------------------------------------
# Terrain Horizon endpoint (LOLA DEM)
# ---------------------------------------------------------------------------


def require_dem(request: Request) -> LolaDem:
    dem = request.app.state.dem
    if dem is None:
        raise HTTPException(status_code=503, detail="LOLA DEM is not installed; run scripts/download_lola.py")
    return dem


@app.post("/api/v1/terrain/horizon", response_model=TerrainResult, tags=["Terrain"])
def terrain_horizon(payload: TerrainRequest, request: Request) -> TerrainResult:
    dem = require_dem(request)
    try:
        profile, height = horizon_profile(
            dem,
            payload.site,
            observer_height_m=payload.observer_height_m,
            max_distance_km=payload.max_distance_km,
            azimuth_step_deg=payload.azimuth_step_deg,
        )
    except TerrainError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return TerrainResult(site=payload.site, profile=profile, site_height_km_used=height)


@app.get("/api/v1/sites/{site_id}/horizon", response_model=TerrainResult, tags=["Terrain"])
def get_site_horizon(
    site_id: str,
    request: Request,
    observer_height_m: float = Query(default=2.0, ge=0.0, le=100.0),
    max_distance_km: float = Query(default=250.0, ge=1.0, le=300.0),
    azimuth_step_deg: int = Query(default=1),
) -> TerrainResult:
    site = find_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail=f"Site '{site_id}' not found in lunar catalog")
    dem = require_dem(request)
    site_model = Site(
        latitude_deg=site.latitude_deg,
        longitude_deg=site.longitude_deg,
        height_km=site.estimated_height_km,
        label=site.name,
    )
    try:
        profile, height = horizon_profile(
            dem,
            site_model,
            observer_height_m=observer_height_m,
            max_distance_km=max_distance_km,
            azimuth_step_deg=azimuth_step_deg,
        )
    except TerrainError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return TerrainResult(site=site_model, profile=profile, site_height_km_used=height)


# ---------------------------------------------------------------------------
# Celestial Ephemeris endpoint (JPL Horizons)
# ---------------------------------------------------------------------------


@app.post("/api/v1/ephemeris", response_model=EphemerisResponse, tags=["Ephemeris"])
async def get_ephemeris(payload: EphemerisRequest, request: Request) -> EphemerisResponse:
    horizons: HorizonsClient = request.app.state.horizons
    sun_pts = None
    earth_pts = None
    try:
        if payload.body_id in (None, 10):
            sun_rows = await horizons.positions(10, payload.site, payload.start_utc, payload.end_utc, payload.step_minutes)
            sun_pts = [EphemerisPoint(time_utc=r[0], azimuth_deg=r[1], elevation_deg=r[2]) for r in sun_rows]
        if payload.body_id in (None, 399):
            earth_rows = await horizons.positions(399, payload.site, payload.start_utc, payload.end_utc, payload.step_minutes)
            earth_pts = [EphemerisPoint(time_utc=r[0], azimuth_deg=r[1], elevation_deg=r[2]) for r in earth_rows]
    except HorizonsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return EphemerisResponse(
        site=payload.site,
        start_utc=payload.start_utc,
        end_utc=payload.end_utc,
        step_minutes=payload.step_minutes,
        sun=sun_pts,
        earth=earth_pts,
    )



# ---------------------------------------------------------------------------
# Scenario evaluation core
# ---------------------------------------------------------------------------


async def evaluate(scenario: Scenario, horizons: HorizonsClient, dem: LolaDem | None = None) -> ScenarioResult:
    try:
        effective_step = effective_step_minutes(scenario)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    profile = scenario.horizon_profile
    site = scenario.site
    source = "user_supplied_profile" if profile is not None else "geometric_0_deg"
    if scenario.use_dem_horizon:
        if dem is None:
            raise HTTPException(status_code=503, detail="LOLA DEM is not installed; run scripts/download_lola.py")
        try:
            profile, height_km = await run_in_threadpool(
                horizon_profile,
                dem,
                site,
                observer_height_m=scenario.observer_height_m,
                max_distance_km=scenario.max_horizon_distance_km,
            )
        except TerrainError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        site = site.model_copy(update={"height_km": height_km})
        source = "LOLA_LDEM_75S_240M_PDS"
    try:
        sun = await horizons.positions(10, site, scenario.start_utc, scenario.end_utc, effective_step)
        earth = await horizons.positions(399, site, scenario.start_utc, scenario.end_utc, effective_step)
    except HorizonsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if not sun or not earth or [row[0] for row in sun] != [row[0] for row in earth] or sun[0][0] != scenario.start_utc:
        raise HTTPException(status_code=502, detail="Horizons returned misaligned sample times")
    expected = scenario.start_utc
    for instant, _, _ in sun:
        if instant != expected:
            raise HTTPException(status_code=502, detail="Horizons returned an incomplete sample grid")
        expected += timedelta(minutes=effective_step)
    if sun[-1][0] + timedelta(minutes=effective_step) < scenario.end_utc:
        raise HTTPException(status_code=502, detail="Horizons returned incomplete time coverage")

    samples = [
        Sample(
            time_utc=s[0],
            sun=position(s[1], s[2], profile, is_sun=True),
            earth=position(e[1], e[2], profile, clearance=scenario.constraints.min_earth_elevation_deg, is_sun=False),
        )
        for s, e in zip(sun, earth)
        if s[0] < scenario.end_utc
    ]
    if not samples:
        raise HTTPException(status_code=502, detail="Horizons returned no samples in the requested interval")
    timeline = build_timeline(scenario, samples)
    timeline.transition_resolution_minutes = effective_step
    if scenario.refine_transitions:
        timeline.refined_transition_resolution_minutes = effective_step
        for event in timeline.events:
            event.method = "horizons_refined"
    try:
        timeline = apply_refined_events(scenario, timeline)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ScenarioResult(
        scenario=scenario,
        samples=samples,
        metrics=analyze(scenario, timeline),
        timeline=timeline,
        horizon_source=source,
        site_height_km_used=site.height_km,
    )


@app.post("/api/v1/scenarios/evaluate", response_model=ScenarioResult, tags=["Scenarios"])
async def evaluate_scenario(scenario: Scenario, request: Request) -> ScenarioResult:
    return await evaluate(scenario, request.app.state.horizons, request.app.state.dem)


@app.post("/api/v1/scenarios/compare", response_model=list[ScenarioResult], tags=["Scenarios"])
async def compare_scenarios(payload: CompareRequest, request: Request) -> list[ScenarioResult]:
    return [await evaluate(scenario, request.app.state.horizons, request.app.state.dem) for scenario in payload.scenarios]


# ---------------------------------------------------------------------------
# Multi-Scenario Ranking & Trade-off Assessment
# ---------------------------------------------------------------------------


@app.post("/api/v1/scenarios/rank", response_model=RankingResponse, tags=["Scenarios"])
async def rank_evaluated_scenarios(payload: RankRequest, request: Request) -> RankingResponse:
    results = [await evaluate(scenario, request.app.state.horizons, request.app.state.dem) for scenario in payload.scenarios]
    return rank_scenarios(results, payload.weights)


# ---------------------------------------------------------------------------
# Mission Delta — Operational & Temporal Sensitivity Assessment
# ---------------------------------------------------------------------------


@app.post("/api/v1/scenarios/delta", response_model=MissionDeltaResult, tags=["Mission Delta"])
async def evaluate_mission_delta(payload: MissionDeltaRequest, request: Request) -> MissionDeltaResult:
    base_sc = payload.baseline_scenario

    # Calculate shifted lunar location if displacement is requested
    dest_lat, dest_lon = shift_lunar_coordinates(
        lat_deg=base_sc.site.latitude_deg,
        lon_deg=base_sc.site.longitude_deg,
        azimuth_deg=payload.displacement_azimuth_deg,
        distance_m=payload.displacement_meters,
    )
    shifted_label = base_sc.site.label or "Sitio"
    if payload.displacement_meters > 0:
        shifted_label = f"{shifted_label} (+{int(payload.displacement_meters)}m {int(payload.displacement_azimuth_deg)}°)"

    rescheduled_site = base_sc.site.model_copy(
        update={
            "latitude_deg": dest_lat,
            "longitude_deg": dest_lon,
            "label": shifted_label,
        }
    )

    # Calculate shifted mission time window
    delay = timedelta(days=payload.delay_days, hours=payload.delay_hours)
    rescheduled_start = base_sc.start_utc + delay
    rescheduled_end = base_sc.end_utc + delay
    total_delay_hours = delay.total_seconds() / 3600.0

    rescheduled_sc = base_sc.model_copy(
        update={
            "site": rescheduled_site,
            "start_utc": rescheduled_start,
            "end_utc": rescheduled_end,
        }
    )

    baseline_result = await evaluate(base_sc, request.app.state.horizons, request.app.state.dem)
    rescheduled_result = await evaluate(rescheduled_sc, request.app.state.horizons, request.app.state.dem)

    return compute_mission_delta(
        baseline_result=baseline_result,
        rescheduled_result=rescheduled_result,
        delay_total_hours=total_delay_hours,
        displacement_meters=payload.displacement_meters,
        displacement_azimuth_deg=payload.displacement_azimuth_deg,
    )


# ---------------------------------------------------------------------------
# AI Mission Copilot — Scientific Explanation & Natural Language Guidance
# ---------------------------------------------------------------------------


@app.post("/api/v1/copilot/explain", response_model=CopilotResponse, tags=["AI Copilot"])
def copilot_explain(payload: CopilotRequest) -> CopilotResponse:
    return diagnose_scenario(payload.scenario_result, payload.user_query)


@app.post("/api/v1/copilot/parse-constraints", response_model=Constraints, tags=["AI Copilot"])
def copilot_parse_constraints(payload: dict[str, str]) -> Constraints:
    prompt = payload.get("prompt", "")
    return parse_natural_constraints(prompt)



# ---------------------------------------------------------------------------
# Mission Power & Battery Simulation
# ---------------------------------------------------------------------------


@app.post("/api/v1/simulation/power", response_model=PowerSimulationResult, tags=["Simulation"])
async def simulate_mission_power(payload: PowerSimulationRequest, request: Request) -> PowerSimulationResult:
    result = await evaluate(payload.scenario, request.app.state.horizons, request.app.state.dem)
    return simulate_power(result, payload.config)


# ---------------------------------------------------------------------------
# CSV Data Export
# ---------------------------------------------------------------------------


@app.post("/api/v1/scenarios/export/csv", tags=["Export"])
async def export_scenario_csv(scenario: Scenario, request: Request) -> Response:
    result = await evaluate(scenario, request.app.state.horizons, request.app.state.dem)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "time_utc",
        "hour_offset",
        "sun_azimuth_deg",
        "sun_elevation_deg",
        "sun_horizon_deg",
        "sun_visible",
        "sun_disk_fraction",
        "sun_disk_state",
        "earth_azimuth_deg",
        "earth_elevation_deg",
        "earth_horizon_deg",
        "earth_visible",
        "earth_disk_fraction",
        "earth_disk_state",
    ])
    for s in result.samples:
        hour_offset = round((s.time_utc - scenario.start_utc).total_seconds() / 3600.0, 2)
        writer.writerow([
            s.time_utc.isoformat(),
            hour_offset,
            s.sun.azimuth_deg,
            s.sun.elevation_deg,
            s.sun.horizon_deg,
            s.sun.visible,
            s.sun.disk_fraction,
            s.sun.disk_state,
            s.earth.azimuth_deg,
            s.earth.elevation_deg,
            s.earth.horizon_deg,
            s.earth.visible,
            s.earth.disk_fraction,
            s.earth.disk_state,
        ])
    filename = f"lunar_scenario_{(scenario.site.label or 'site').replace(' ', '_')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Frontend Compatibility Adapter (supports frontend/src/api.ts)
# ---------------------------------------------------------------------------


@app.post("/api/scenarios/analyze", response_model=LegacyAnalyzeResponse, tags=["Frontend Adapter"])
@app.post("/api/v1/scenarios/analyze", response_model=LegacyAnalyzeResponse, tags=["Frontend Adapter"])
async def analyze_legacy(payload: LegacyAnalyzeRequest, request: Request) -> LegacyAnalyzeResponse:
    end_time = payload.start_time + timedelta(hours=payload.hours)
    scenario = Scenario(
        site=Site(latitude_deg=payload.latitude, longitude_deg=payload.longitude, height_km=payload.height_km),
        start_utc=payload.start_time,
        end_utc=end_time,
        step_minutes=payload.step_minutes,
        use_dem_horizon=payload.use_dem_horizon,
        observer_height_m=payload.observer_height_m,
        max_horizon_distance_km=payload.max_horizon_distance_km,
        constraints=Constraints(min_earth_elevation_deg=payload.min_earth_elevation_deg),
    )
    result = await evaluate(scenario, request.app.state.horizons, request.app.state.dem)
    legacy_samples = [
        LegacySample(
            hour=int(round((s.time_utc - payload.start_time).total_seconds() / 3600.0)),
            sun_elevation=s.sun.elevation_deg,
            earth_elevation=s.earth.elevation_deg,
            horizon_sun=s.sun.horizon_deg,
            horizon_earth=s.earth.horizon_deg,
            sun_visible=s.sun.visible,
            earth_visible=s.earth.visible,
            sun_disk_fraction=s.sun.disk_fraction,
            earth_disk_fraction=s.earth.disk_fraction,
        )
        for s in result.samples
    ]
    return LegacyAnalyzeResponse(
        site={
            "lat": payload.latitude,
            "lon": payload.longitude,
            "height_km": result.site_height_km_used,
        },
        start=payload.start_time.strftime("%Y-%m-%d"),
        hours=payload.hours,
        samples=legacy_samples,
        source=result.horizon_source,
        metrics={
            "sunPercent": round(result.metrics.sunlit_fraction * 100),
            "earthPercent": round(result.metrics.earth_visible_fraction * 100),
            "concurrentPercent": round(result.metrics.concurrent_fraction * 100),
            "longestDark": result.metrics.longest_darkness_hours,
            "longestBlackout": result.metrics.longest_earth_blackout_hours,
        },
    )


# ---------------------------------------------------------------------------
# Ephemeris Cache Management
# ---------------------------------------------------------------------------


@app.get("/api/v1/cache/stats", tags=["Cache"])
def cache_stats(request: Request) -> dict[str, int | bool]:
    cache: EphemerisCache | None = request.app.state.cache
    if cache is None:
        return {"enabled": False, "cached_entries": 0}
    return {"enabled": True, "cached_entries": cache.count()}


@app.post("/api/v1/cache/clear", tags=["Cache"])
def clear_cache(request: Request) -> dict[str, int]:
    cache: EphemerisCache | None = request.app.state.cache
    if cache is None:
        return {"cleared_entries": 0}
    return {"cleared_entries": cache.clear()}


app.include_router(planner_router)

@app.exception_handler(SourceError)
async def nasa_error(request: Request, exc: SourceError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})
