from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.models import Scenario, ScenarioResult, Sample
from app.analysis import position, build_timeline, analyze
from app.power import PowerConfig, simulate_power
from app.ranking import rank_scenarios, RankingWeights
from app.cache import EphemerisCache


def case(states, step=30, refined=False):
    start = datetime(2026, 11, 15, tzinfo=timezone.utc)
    scenario = Scenario(site={'latitude_deg':-89, 'longitude_deg':0}, start_utc=start,
        end_utc=start+timedelta(minutes=step*len(states)), step_minutes=60 if refined else step,
        refine_transitions=refined, constraints={'max_darkness_hours':.5})
    samples = [Sample(time_utc=start+timedelta(minutes=step*i), sun=position(90, 5 if v else -5, None),
                      earth=position(90, 5 if v else -5, None)) for i,v in enumerate(states)]
    timeline=build_timeline(scenario,samples)
    return ScenarioResult(scenario=scenario,samples=samples,timeline=timeline,metrics=analyze(scenario,timeline),
                          site_height_km_used=0,horizon_source='synthetic')


def test_refined_energy_integrates_real_timestamps():
    data=case([False]*24,5,True)
    result=simulate_power(data,PowerConfig(base_load_watts=100,battery_capacity_wh=100000))
    assert result.total_energy_consumed_kwh == pytest.approx(.2)
    # Last partial interval must be integrated only until the requested end.
    data.scenario.end_utc += timedelta(minutes=2)
    result=simulate_power(data,PowerConfig(base_load_watts=100,battery_capacity_wh=100000))
    assert result.total_energy_consumed_kwh == pytest.approx(.203,abs=.001)


def test_ranking_prioritizes_eligibility_and_no_false_winner():
    invalid=case([False,False,True,True,True,True,True,True])
    valid=case([True,False]*4)
    ranking=rank_scenarios([invalid,valid],RankingWeights())
    assert ranking.ranked_sites[0].constraints_met
    assert rank_scenarios([invalid],RankingWeights()).best_site is None


def test_spatial_cache_does_not_collapse_close_points():
    start=datetime(2026,11,15,tzinfo=timezone.utc)
    args=dict(body_id=10,lon=0,height_km=0,start=start,end=start+timedelta(hours=1),step_minutes=60)
    assert EphemerisCache.make_key(lat=-89.50001,**args) != EphemerisCache.make_key(lat=-89.50002,**args)


def test_direct_ephemeris_rejects_invalid_body_and_interval():
    with TestClient(app) as client:
        payload={'site':{'latitude_deg':-89,'longitude_deg':0},'start_utc':'2026-11-15T00:00:00Z','end_utc':'2026-11-14T00:00:00Z','body_id':777}
        assert client.post('/api/v1/ephemeris',json=payload).status_code == 422
        payload['body_id']=10
        assert client.post('/api/v1/ephemeris',json=payload).status_code == 422


def test_multiresolution_keeps_common_origin_and_dominant_source():
    from app.terrain import horizon_profile
    from app.models import Site
    class Dem:
        radius_m=1737400
        scale_m=240
        product_id='LDEM_75S_240M'
        def height_m(self,lat,lon): return 0
    class Fine(Dem):
        scale_m=20
        product_id='LDEM_875S_20M'
        def height_m(self,lat,lon): return 10
    profile,height=horizon_profile(Dem(),Site(latitude_deg=-89,longitude_deg=0),fine_dem=Fine(),max_distance_km=1,azimuth_step_deg=10)
    assert height == pytest.approx(.012)
    assert all(p.source == 'LOLA_LDEM_875S_20M_PDS' for p in profile)
    assert all(p.distance_km and p.distance_km <= 1 for p in profile)
