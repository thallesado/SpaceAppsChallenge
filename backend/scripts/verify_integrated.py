"""Integration checks against the running local API and real NASA data."""
import json
from pathlib import Path
import httpx


def main():
    checks = {'synthetic': False, 'note': 'Real running API; provider-derived ephemerides may come from cache.',
              'scenario_date_utc': '2026-11-15', 'upstream_source_revision': 'fbe2a7b'}
    with httpx.Client(base_url='http://127.0.0.1:8000', timeout=180) as client:
        def get(path, **kwargs):
            response = client.get(path, **kwargs); response.raise_for_status(); return response.json()
        def post(path, payload):
            response = client.post(path, json=payload); response.raise_for_status(); return response.json()
        checks['status'] = get('/api/v1/status')
        assert checks['status']['fine_dem_ready']
        point = {'latitude_deg': -89.5, 'longitude_deg': 0, 'label': 'Polar reference'}
        scenario = {'site': point, 'start_utc': '2026-11-15T00:00:00Z', 'end_utc': '2026-11-16T00:00:00Z',
                    'step_minutes': 60, 'use_dem_horizon': True, 'max_horizon_distance_km': 250,
                    'constraints': {'min_concurrent_hours': 6}}
        result = post('/api/v1/scenarios/evaluate', scenario)
        assert len(result['samples']) == 24
        assert result['horizon_source'] == 'LOLA_MULTIRESOLUTION_20_240M'
        assert len(result['provenance']['datasets']) == 2
        assert all(p['source'] and p['distance_km'] for p in result['horizon_profile'])
        checks['evaluation'] = {key: result[key] for key in ('metrics', 'horizon_source', 'site_height_km_used', 'provenance')}
        mesh = post('/api/v1/terrain/mesh', {'site': point, 'radius_km': 1, 'resolution': 101})
        assert mesh['pixel_size_m'] == 20
        assert len(mesh['points']) == 10201
        checks['mesh'] = {'source': mesh['source'], 'pixel_size_m': mesh['pixel_size_m'], 'points': len(mesh['points'])}
        checks['slope'] = post('/api/v1/terrain/slope', {'site': point, 'neighborhood_radius_m': 500})
        search = post('/api/v1/scenarios/search', {'scenario': scenario, 'sites': [point,
            {'latitude_deg': -89.6, 'longitude_deg': 20, 'label': 'Second polar reference'}], 'search_days': 2})
        assert len(search['options']) == 6
        assert not search['unavailable']
        checks['search'] = {'options': len(search['options']), 'unavailable': search['unavailable'],
            'windows': [{'site': o['site'], 'offset_days': o['offset_days'], 'constraints_met': o['result']['metrics']['constraints_met'],
                         'window': o['recommended_window']} for o in search['options']]}
        sensitivity = post('/api/v1/scenarios/sensitivity', {'scenario': {**scenario, 'max_horizon_distance_km': 1}, 'radius_m': 100})
        assert len(sensitivity['evaluated']) == 5
        checks['sensitivity'] = {k: sensitivity[k] for k in ('complete', 'ranges', 'method', 'note')}
        checks['sensitivity']['max_horizon_distance_km'] = 1
        checks['moon_trek_catalog_layers'] = len(get('/api/v1/maps/layers'))
    target = Path(__file__).resolve().parents[2] / 'docs/VALIDACION_INTEGRACION_REAL.json'
    target.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(checks, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
