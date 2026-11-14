"""Read the public LOLA LDEM_75S_240M PDS3 product and trace a lunar skyline."""

import math
import mmap
from pathlib import Path
import re
import struct

from .models import HorizonPoint, Site

REFERENCE_RADIUS_M = 1_737_400.0
PRODUCT_ID = "LDEM_75S_240M"


class TerrainError(Exception):
    pass


def _label_number(label: str, key: str) -> float:
    match = re.search(rf"^\s*{key}\s*=\s*([-+\d.]+)", label, re.MULTILINE)
    if not match:
        raise TerrainError(f"LOLA label is missing {key}")
    return float(match.group(1))


class LolaDem:
    def __init__(self, image_path: Path):
        self.image_path = image_path
        label_path = image_path.with_suffix(".lbl")
        if not image_path.is_file() or not label_path.is_file():
            raise TerrainError("LOLA IMG and LBL files must be in the same directory")
        label = label_path.read_text(encoding="ascii")
        if f'FILE_NAME                 = "{PRODUCT_ID}.IMG"' not in label.upper():
            raise TerrainError("Unsupported LOLA product; expected LDEM_75S_240M")
        if 'COORDINATE_SYSTEM_NAME       = "MEAN EARTH/POLAR AXIS OF DE421"' not in label.upper():
            raise TerrainError("Unexpected lunar coordinate frame")
        if "SAMPLE_TYPE           = LSB_INTEGER" not in label.upper() or "SAMPLE_BITS           = 16" not in label.upper():
            raise TerrainError("Unexpected LOLA sample encoding")
        self.size = int(_label_number(label, "LINES"))
        self.scale_m = _label_number(label, "MAP_SCALE")
        self.height_scale = _label_number(label, "SCALING_FACTOR")
        self.radius_m = _label_number(label, "OFFSET")
        if self.size != 3812 or self.scale_m != 240 or self.radius_m != REFERENCE_RADIUS_M:
            raise TerrainError("Unexpected LOLA grid geometry or reference radius")
        if image_path.stat().st_size != self.size * self.size * 2:
            raise TerrainError("LOLA IMG size does not match its label")
        self._file = image_path.open("rb")
        self._data = mmap.mmap(self._file.fileno(), 0, access=mmap.ACCESS_READ)

    def close(self) -> None:
        self._data.close()
        self._file.close()

    def __enter__(self) -> "LolaDem":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def height_m(self, latitude_deg: float, longitude_deg: float) -> float:
        if latitude_deg > -75 or latitude_deg < -90:
            raise TerrainError("Site or ray is outside the LOLA south pole coverage")
        angular_radius = math.radians(90 + latitude_deg) / 2
        rho = 2 * self.radius_m * math.tan(angular_radius)
        longitude = math.radians(longitude_deg)
        # PDS DSMAP_POLAR: 0°E points to image top; 90°E to image right.
        col = round((self.size - 1) / 2 + rho * math.sin(longitude) / self.scale_m)
        row = round((self.size - 1) / 2 - rho * math.cos(longitude) / self.scale_m)
        if not 0 <= row < self.size or not 0 <= col < self.size:
            raise TerrainError("Site or ray is outside the LOLA image")
        dn = struct.unpack_from("<h", self._data, 2 * (row * self.size + col))[0]
        return dn * self.height_scale


def _destination(latitude_deg: float, longitude_deg: float, azimuth_deg: float, distance_m: float) -> tuple[float, float]:
    lat = math.radians(latitude_deg)
    lon = math.radians(longitude_deg)
    bearing = math.radians(azimuth_deg)
    arc = distance_m / REFERENCE_RADIUS_M
    end_lat = math.asin(math.sin(lat) * math.cos(arc) + math.cos(lat) * math.sin(arc) * math.cos(bearing))
    end_lon = lon + math.atan2(math.sin(bearing) * math.sin(arc) * math.cos(lat),
                               math.cos(arc) - math.sin(lat) * math.sin(end_lat))
    return math.degrees(end_lat), math.degrees(end_lon)


def horizon_profile(dem: LolaDem, site: Site, *, observer_height_m: float = 2.0,
                    max_distance_km: float = 250, azimuth_step_deg: int = 1) -> tuple[list[HorizonPoint], float]:
    if not 0 <= observer_height_m <= 100:
        raise ValueError("observer_height_m must be between 0 and 100")
    # Massifs 100-200 km away still rise above the 1-2° polar solar path.
    if not 1 <= max_distance_km <= 300 or azimuth_step_deg not in (1, 2, 5, 10):
        raise ValueError("Unsupported ray distance or azimuth step")
    site_height = dem.height_m(site.latitude_deg, site.longitude_deg)
    origin_radius = dem.radius_m + site_height + observer_height_m
    profile = []
    # Half-pixel spacing avoids skipping a narrow ridge in a 240 m grid.
    distance_step = dem.scale_m / 2
    steps = math.ceil(max_distance_km * 1000 / distance_step)
    for azimuth in range(0, 360, azimuth_step_deg):
        skyline = -90.0
        for index in range(1, steps + 1):
            distance = min(index * distance_step, max_distance_km * 1000)
            lat, lon = _destination(site.latitude_deg, site.longitude_deg, azimuth, distance)
            terrain_radius = dem.radius_m + dem.height_m(lat, lon)
            arc = distance / dem.radius_m
            angle = math.degrees(math.atan2(terrain_radius * math.cos(arc) - origin_radius,
                                            terrain_radius * math.sin(arc)))
            skyline = max(skyline, angle)
        profile.append(HorizonPoint(azimuth_deg=azimuth, elevation_deg=skyline))
    return profile, (site_height + observer_height_m) / 1000


# Shared skyline reuse across dates: same site and terrain produce the same horizon.
from functools import lru_cache
_original_horizon = horizon_profile

@lru_cache(maxsize=64)
def _cached_horizon(dem, lat, lon, height, distance, step):
    return _original_horizon(dem, Site(latitude_deg=lat, longitude_deg=lon), observer_height_m=height, max_distance_km=distance, azimuth_step_deg=step)

def horizon_profile(dem, site, *, observer_height_m=2.0, max_distance_km=250, azimuth_step_deg=1):
    profile, height = _cached_horizon(dem, site.latitude_deg, site.longitude_deg, observer_height_m, max_distance_km, azimuth_step_deg)
    return [point.model_copy() for point in profile], height
