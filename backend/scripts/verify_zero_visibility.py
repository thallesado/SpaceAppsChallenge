"""Reproduce reported zeros and independently check the data and ray geometry.

Requires optional validation dependencies and downloaded kernels. No Gemini calls.
Independent rays use NumPy IMG access and Cartesian vectors, not terrain._profile.
"""
import asyncio
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import re
import sys

import httpx
import numpy as np
import spiceypy as spice

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.horizons import HorizonsClient
from app.models import Site
from validate_spice import spice_angles, FILES, KERNELS

ROOT = Path(__file__).resolve().parents[2]
R = 1737400.


class IndependentDem:
    def __init__(self, stem):
        path = ROOT / 'backend/data' / stem
        label = path.with_suffix('.lbl').read_text(encoding='ascii')
        number = lambda key: float(re.search(rf'^\s*{key}\s*=\s*([-+\d.]+)', label, re.M).group(1))
        self.scale, self.factor = number('MAP_SCALE'), number('SCALING_FACTOR')
        self.row0, self.col0 = number('LINE_PROJECTION_OFFSET'), number('SAMPLE_PROJECTION_OFFSET')
        self.data = np.memmap(path.with_suffix('.img'), dtype='<i2', mode='r', shape=(int(number('LINES')), int(number('LINE_SAMPLES'))))

    def heights(self, positions):
        lat = np.arctan2(positions[:, 2], np.hypot(positions[:, 0], positions[:, 1]))
        lon = np.arctan2(positions[:, 1], positions[:, 0])
        rho = 2 * R * np.tan((np.pi / 2 + lat) / 2)
        cols = np.rint(self.col0 + rho * np.sin(lon) / self.scale).astype(int)
        rows = np.rint(self.row0 - rho * np.cos(lon) / self.scale).astype(int)
        return self.data[rows, cols].astype(float) * self.factor


def skyline(site, azimuth, coarse, fine):
    lat, lon, az = np.radians([site.latitude_deg, site.longitude_deg, azimuth])
    up = np.array([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])
    north = np.array([-np.sin(lat)*np.cos(lon), -np.sin(lat)*np.sin(lon), np.cos(lat)])
    east = np.array([-np.sin(lon), np.cos(lon), 0.])
    fine_used = site.latitude_deg + math.degrees(5000 / R) <= -87.5
    dataset = fine if fine_used else coarse
    origin = up * (R + dataset.heights(up[None, :])[0] + 2)
    intervals = [(fine, 10, 5000, 10), (coarse, 5120, 250000, 120)] if fine_used else [(coarse, 120, 250000, 120)]
    best = -90.
    for dem, begin, end, step in intervals:
        distances = np.minimum(begin + np.arange(math.ceil((end-begin)/step)+1)*step, end)
        arc = distances / R
        direction = up[None, :]*np.cos(arc[:, None]) + (north*np.cos(az)+east*np.sin(az))[None, :]*np.sin(arc[:, None])
        delta = direction*(R+dem.heights(direction))[:, None] - origin
        angle = np.degrees(np.arctan2(delta@up, np.hypot(delta@east, delta@north)))
        best = max(best, float(angle.max()))
    return best


async def main():
    coarse, fine = IndependentDem('ldem_75s_240m'), IndependentDem('ldem_875s_20m')
    for name in FILES:
        spice.furnsh(str(KERNELS/name))
    report = {'synthetic': False, 'scope': 'Horizons without cache, SPICE angles, independent Cartesian rays on the same NASA DEM, and duration integration. Not landing certification.', 'cases': []}
    cases = [(-89, 0, '2026-11-15'), (-88.3404, 0, '2026-11-15'), (-89.6596, 0, '2026-11-15'),
             (-89, 0, '2026-11-19'), (-85.98, -1.67, '2026-11-15')]
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            fresh = HorizonsClient(client, cache=None)
            for lat, lon, date in cases:
                start = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
                end = start + timedelta(days=1)
                payload = {'site': {'latitude_deg': lat, 'longitude_deg': lon}, 'start_utc': start.isoformat(), 'end_utc': end.isoformat(),
                           'step_minutes': 60, 'use_dem_horizon': True, 'constraints': {'min_concurrent_hours': 6, 'min_sunlit_fraction': .4, 'min_earth_visible_fraction': .4}}
                response = await client.post('http://127.0.0.1:8000/api/v1/scenarios/evaluate', json=payload)
                response.raise_for_status()
                result = response.json()
                site = Site(latitude_deg=lat, longitude_deg=lon, height_km=result['site_height_km_used'])
                row = {'site': payload['site'], 'date': date, 'source': result['horizon_source'], 'height_km': site.height_km, 'metrics': result['metrics'], 'bodies': {}}
                for body, body_id, spice_name in [('sun', 10, 'SUN'), ('earth', 399, 'EARTH')]:
                    raw = await fresh.positions(body_id, site, start, end, 60)
                    horizon_cache = {}
                    errors, spice_errors, margins, elevations, horizons, duration = [], [], [], [], [], 0.
                    for i, sample in enumerate(result['samples']):
                        instant = datetime.fromisoformat(sample['time_utc'].replace('Z', '+00:00'))
                        value = sample[body]
                        az, el = value['azimuth_deg'], value['elevation_deg']
                        assert raw[i][0] == instant
                        errors.append(max(abs((raw[i][1]-az+180)%360-180), abs(raw[i][2]-el)))
                        if i % 6 == 0:
                            independent = spice_angles(spice_name, site, instant)
                            spice_errors.append(max(abs((independent[0]-az+180)%360-180), abs(independent[1]-el)))
                        lo = math.floor(az)
                        for bearing in (lo, lo+1):
                            if bearing not in horizon_cache:
                                horizon_cache[bearing] = skyline(site, bearing % 360, coarse, fine)
                        independent_horizon = horizon_cache[lo] + (horizon_cache[lo+1]-horizon_cache[lo])*(az-lo)
                        assert abs(independent_horizon-value['horizon_deg']) < 1e-6
                        visible = el > independent_horizon
                        assert visible == value['visible']
                        stop = datetime.fromisoformat(result['samples'][i+1]['time_utc'].replace('Z', '+00:00')) if i+1 < len(result['samples']) else end
                        if visible:
                            duration += (stop-instant).total_seconds()/3600
                        margins.append(el-independent_horizon); elevations.append(el); horizons.append(independent_horizon)
                    metric = 'sunlit_fraction' if body == 'sun' else 'earth_visible_fraction'
                    assert abs(duration/24 - result['metrics'][metric]) < 1e-12
                    assert max(errors) < 1e-6 and max(spice_errors) < .001
                    row['bodies'][body] = {'fresh_horizons_max_error_deg': max(errors), 'spice_max_error_deg': max(spice_errors),
                        'elevation_range_deg': [min(elevations), max(elevations)], 'terrain_horizon_range_deg': [min(horizons), max(horizons)],
                        'best_margin_deg': max(margins), 'independent_visible_hours': duration, 'independent_horizon_match': True}
                run, longest, both_hours = 0., 0., 0.
                # Each body's mask was checked with independent Cartesian rays above.
                # Integrate intersection without calling the production timeline/analysis.
                for i, sample in enumerate(result['samples']):
                    instant = datetime.fromisoformat(sample['time_utc'].replace('Z', '+00:00'))
                    stop = datetime.fromisoformat(result['samples'][i+1]['time_utc'].replace('Z', '+00:00')) if i+1 < len(result['samples']) else end
                    if sample['sun']['visible'] and sample['earth']['visible']:
                        run += (stop-instant).total_seconds()/3600
                        both_hours += (stop-instant).total_seconds()/3600
                        longest = max(longest, run)
                    else:
                        run = 0.
                assert abs(longest-result['metrics']['longest_concurrent_hours']) < 1e-12
                assert abs(both_hours/24-result['metrics']['concurrent_fraction']) < 1e-12
                row['independent_longest_concurrent_hours'] = longest
                row['independent_concurrent_hours'] = both_hours
                report['cases'].append(row)
                print(lat, lon, date, result['metrics']['sunlit_fraction'], result['metrics']['earth_visible_fraction'], 'verified', flush=True)
    finally:
        spice.kclear()
    assert report['cases'][0]['metrics']['sunlit_fraction'] == report['cases'][0]['metrics']['earth_visible_fraction'] == 0
    assert report['cases'][3]['metrics']['longest_concurrent_hours'] == 24
    assert report['cases'][4]['metrics']['sunlit_fraction'] > 0
    (ROOT/'docs/VALIDACION_VISIBILIDAD_CEROS.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    asyncio.run(main())
