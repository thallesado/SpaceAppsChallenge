"""Bounded audit reproductions. Does not contact NASA or change application data."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'backend'))
from fastapi.testclient import TestClient
from app.analysis import analyze, build_timeline
from app.cache import EphemerisCache
from app.main import app
from app.models import BodyPosition, Sample, Scenario, ScenarioResult
from app.power import PowerConfig, simulate_power
from app.ranking import RankingWeights, rank_scenarios


def result_for(states, minutes=60, refined=False, label='Synthetic'):
    start = datetime(2026, 11, 14, tzinfo=timezone.utc)
    scenario = Scenario(site={'latitude_deg': -89, 'longitude_deg': 0, 'label': label},
                        start_utc=start, end_utc=start + timedelta(minutes=minutes * len(states)),
                        step_minutes=60 if refined else minutes, refine_transitions=refined,
                        constraints={'max_darkness_hours': 0.5})
    def body(visible):
        return BodyPosition(azimuth_deg=90, elevation_deg=5 if visible else -5,
                            horizon_deg=0, visible=visible, disk_fraction=1 if visible else 0)
    samples = [Sample(time_utc=start + timedelta(minutes=i * minutes), sun=body(value), earth=body(value))
               for i, value in enumerate(states)]
    timeline = build_timeline(scenario, samples)
    return ScenarioResult(scenario=scenario, samples=samples, timeline=timeline,
                          metrics=analyze(scenario, timeline), horizon_source='synthetic', site_height_km_used=0)


def main():
    report = {'revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'method': 'Synthetic bounded cases and repository inspection; no independent scientific validation.'}
    refined = result_for([False] * 24, minutes=5, refined=True)
    power = simulate_power(refined, PowerConfig(base_load_watts=100, battery_capacity_wh=100000))
    report['power_refinement'] = {'actual_period_hours': 2, 'samples': 24,
        'expected_consumed_kwh': 0.2, 'observed_consumed_kwh': power.total_energy_consumed_kwh,
        'factor': power.total_energy_consumed_kwh / 0.2}
    start = refined.scenario.start_utc
    key_args = dict(body_id=10, lon=0, height_km=0, start=start,
                    end=start + timedelta(hours=1), step_minutes=60)
    report['cache_spatial_collision'] = {'latitudes': [-89.50001, -89.50002],
        'same_key': EphemerisCache.make_key(lat=-89.50001, **key_args) == EphemerisCache.make_key(lat=-89.50002, **key_args)}
    with tempfile.TemporaryDirectory() as folder:
        keys = ['LUNARPATH_CACHE_ENABLED', 'LUNARPATH_DEM_PATH']
        previous = {key: os.environ.get(key) for key in keys}
        os.environ['LUNARPATH_CACHE_ENABLED'] = 'false'
        os.environ['LUNARPATH_DEM_PATH'] = str(Path(folder) / 'not-installed.img')
        try:
            with TestClient(app) as client:
                response = client.post('/api/v1/ephemeris', json={
                    'site': {'latitude_deg': -89, 'longitude_deg': 0},
                    'start_utc': '2026-11-15T00:00:00Z', 'end_utc': '2026-11-14T00:00:00Z', 'body_id': 777})
                report['ephemeris_invalid_request'] = {'status': response.status_code, 'body': response.json()}
        finally:
            for key, value in previous.items():
                if value is None: os.environ.pop(key, None)
                else: os.environ[key] = value
    ranked = rank_scenarios([result_for([False, False, True, True, True, True, True, True], 30, label='Violates darkness'),
                            result_for([True, False] * 4, 30, label='Meets constraints')], RankingWeights())
    report['ranking_feasibility'] = [{'label': row.label, 'score': row.score, 'constraints_met': row.constraints_met}
                                     for row in ranked.ranked_sites]
    model = ROOT / 'frontend/public/luna/luna_cientifica.glb'
    raw = model.read_bytes()
    length, _ = struct.unpack_from('<II', raw, 12)
    asset = json.loads(raw[20:20 + length])
    report['model'] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                       'asset': asset.get('asset'), 'extras': asset.get('extras'),
                       'selected_marker_offset_km': (0.0015 + 0.0005) * 1737.4,
                       'physics_observer_height_m': 2}
    report['handoff_files'] = {'dem20_files': [str(p.relative_to(ROOT)) for p in (ROOT / 'backend/data').glob('*20m*')],
        'json_in_docs': [str(p.relative_to(ROOT)) for p in (ROOT / 'docs').rglob('*.json')]}
    target = ROOT / 'wiki/evidencias/auditoria-257c287.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
