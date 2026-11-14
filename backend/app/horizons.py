import csv
import io
import re
import math
from datetime import datetime, timezone

import httpx

from .cache import EphemerisCache
from .models import Site

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
_DATA = re.compile(r"\$\$SOE\s*\n(.*?)\n\$\$EOE", re.DOTALL)


class HorizonsError(Exception):
    pass


def parse_ephemeris(result: str) -> list[tuple[datetime, float, float]]:
    match = _DATA.search(result)
    if not match:
        raise HorizonsError("Horizons response contains no ephemeris table")
    rows = []
    for row in csv.reader(io.StringIO(match.group(1))):
        try:
            instant = datetime.strptime(row[0].strip(), "%Y-%b-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            azimuth, elevation = float(row[3]), float(row[4])
        except (IndexError, ValueError) as exc:
            raise HorizonsError("Horizons returned an unexpected table format") from exc
        if not math.isfinite(azimuth) or not math.isfinite(elevation):
            raise HorizonsError("Invalid angular values")
        rows.append((instant, azimuth, elevation))
    if not rows:
        raise HorizonsError("Horizons returned an empty ephemeris table")
    return rows


class HorizonsClient:
    def __init__(self, client: httpx.AsyncClient, cache: EphemerisCache | None = None):
        self.client = client
        self.cache = cache

    async def positions(self, body_id: int, site: Site, start: datetime, end: datetime, step_minutes: int) -> list[tuple[datetime, float, float]]:
        if self.cache is not None:
            cached = self.cache.get(
                body_id=body_id,
                lat=site.latitude_deg,
                lon=site.longitude_deg,
                height_km=site.height_km,
                start=start,
                end=end,
                step_minutes=step_minutes,
            )
            if cached is not None:
                return cached

        params = {
            "format": "json",
            "COMMAND": f"'{body_id}'",
            "CENTER": "'coord@301'",
            "COORD_TYPE": "'GEODETIC'",
            "SITE_COORD": f"'{site.longitude_deg},{site.latitude_deg},{site.height_km}'",
            "EPHEM_TYPE": "'OBSERVER'",
            "MAKE_EPHEM": "'YES'",
            "OBJ_DATA": "'NO'",
            "START_TIME": f"'{start:%Y-%m-%d %H:%M:%S}'",
            "STOP_TIME": f"'{end:%Y-%m-%d %H:%M:%S}'",
            "STEP_SIZE": f"'{step_minutes}m'",
            "QUANTITIES": "'4'",
            "CSV_FORMAT": "'YES'",
            "TIME_TYPE": "'UT'",
            "TIME_DIGITS": "'SECONDS'",
            "APPARENT": "'AIRLESS'",
        }
        try:
            response = await self.client.get(HORIZONS_URL, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HorizonsError("Could not retrieve JPL Horizons ephemeris") from exc
        if "error" in payload:
            raise HorizonsError(str(payload["error"])[:500])

        rows = parse_ephemeris(payload.get("result", ""))
        if self.cache is not None:
            self.cache.set(
                body_id=body_id,
                lat=site.latitude_deg,
                lon=site.longitude_deg,
                height_km=site.height_km,
                start=start,
                end=end,
                step_minutes=step_minutes,
                rows=rows,
            )
        return rows
