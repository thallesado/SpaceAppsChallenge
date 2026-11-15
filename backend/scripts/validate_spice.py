"""Cross-check Horizons observer angles with an independent SPICE calculation.

SPICE and Horizons use related JPL ephemeris data, but different computation
paths. This checks frame, azimuth and altitude conventions; it is not an
independent orbital solution or landing certification.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path

import httpx
import spiceypy as spice

from app.horizons import HorizonsClient
from app.models import Site

ROOT = Path(__file__).resolve().parents[2]
KERNELS = ROOT / "backend" / "data" / "kernels"
FILES = ("naif0012.tls", "de440s.bsp", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf")
INPOP = "inpop19a_19900101_20500101.bsp"
RADIUS_KM = 1737.4


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def spice_angles(body: str, site: Site, instant: datetime) -> tuple[float, float]:
    et = spice.str2et(instant.strftime("%Y-%m-%d %H:%M:%S UTC"))
    apparent, _ = spice.spkpos(body, et, "MOON_ME", "LT+S", "MOON")
    lat, lon = math.radians(site.latitude_deg), math.radians(site.longitude_deg)
    radius = RADIUS_KM + site.height_km
    up = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    east = (-math.sin(lon), math.cos(lon), 0)
    north = (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat))
    target = [apparent[i] - radius * up[i] for i in range(3)]
    dot = lambda axis: sum(target[i] * axis[i] for i in range(3))
    azimuth = math.degrees(math.atan2(dot(east), dot(north))) % 360
    elevation = math.degrees(math.asin(dot(up) / math.sqrt(sum(v * v for v in target))))
    return azimuth, elevation


def circular_difference(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


async def main() -> None:
    for name in FILES:
        path = KERNELS / name
        if not path.exists():
            raise SystemExit(f"Missing SPICE kernel: {path}")
        spice.furnsh(str(path))
    cases = [
        (Site(latitude_deg=-88.3, longitude_deg=-59.5, label="de Gerlache sample"), datetime(2026, 11, 15, tzinfo=timezone.utc)),
        (Site(latitude_deg=-86.0, longitude_deg=3.8, label="Malapert sample"), datetime(2026, 12, 1, tzinfo=timezone.utc)),
        (Site(latitude_deg=-89.0, longitude_deg=120.0, label="polar reference"), datetime(2027, 2, 15, tzinfo=timezone.utc)),
    ]
    rows = []
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            horizons = HorizonsClient(client)
            for site, instant in cases:
                for body, number in (("SUN", 10), ("EARTH", 399)):
                    observed = await horizons.positions(number, site, instant, instant + timedelta(minutes=1), 1)
                    _, hz_az, hz_el = observed[0]
                    sp_az, sp_el = spice_angles(body, site, instant)
                    rows.append({
                        "site": site.label, "latitude_deg": site.latitude_deg,
                        "longitude_deg": site.longitude_deg, "time_utc": instant.isoformat(),
                        "body": body, "horizons_azimuth_deg": hz_az,
                        "horizons_elevation_deg": hz_el, "spice_azimuth_deg": sp_az,
                        "spice_elevation_deg": sp_el,
                        "azimuth_difference_deg": circular_difference(hz_az, sp_az),
                        "elevation_difference_deg": abs(hz_el - sp_el),
                    })
        spice.kclear()
        for name in ("naif0012.tls", INPOP, "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"):
            path = KERNELS / name
            if not path.exists():
                raise SystemExit(f"Missing independent orbit kernel: {path}")
            spice.furnsh(str(path))
        for row in rows:
            site = Site(latitude_deg=row["latitude_deg"], longitude_deg=row["longitude_deg"])
            instant = datetime.fromisoformat(row["time_utc"])
            azimuth, elevation = spice_angles(row["body"], site, instant)
            row["inpop19a_azimuth_deg"] = azimuth
            row["inpop19a_elevation_deg"] = elevation
            row["inpop19a_azimuth_difference_deg"] = circular_difference(row["horizons_azimuth_deg"], azimuth)
            row["inpop19a_elevation_difference_deg"] = abs(row["horizons_elevation_deg"] - elevation)
    finally:
        spice.kclear()
    result = {
        "method": "JPL Horizons observer azimuth/elevation versus NAIF SPICE LT+S vectors projected onto a local MOON_ME east-north-up frame",
        "kernels_jpl": list(FILES), "kernel_independent_orbit": INPOP,
        "kernel_sha256": {name: sha256(KERNELS / name) for name in (*FILES, INPOP)},
        "moon_orientation_kernel_shared": "moon_pa_de440_200625.bpc",
        "observer_height_km": 0,
        "cases": rows,
        "max_azimuth_difference_deg": max(row["azimuth_difference_deg"] for row in rows),
        "max_elevation_difference_deg": max(row["elevation_difference_deg"] for row in rows),
        "max_inpop19a_azimuth_difference_deg": max(row["inpop19a_azimuth_difference_deg"] for row in rows),
        "max_inpop19a_elevation_difference_deg": max(row["inpop19a_elevation_difference_deg"] for row in rows),
        "limit": "INPOP19a is an independent orbit solution, but the lunar orientation frame remains DE440. These cases do not validate DEM horizons, transition windows or landing safety.",
    }
    output = ROOT / "docs" / "VALIDACION_SPICE.json"
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(output)
    print("JPL max azimuth", result["max_azimuth_difference_deg"], "max elevation", result["max_elevation_difference_deg"])
    print("INPOP max azimuth", result["max_inpop19a_azimuth_difference_deg"], "max elevation", result["max_inpop19a_elevation_difference_deg"])


if __name__ == "__main__":
    asyncio.run(main())
