"""Read the public LOLA LDEM_75S_240M PDS3 product and trace a lunar skyline."""

import math
import mmap
from pathlib import Path
import re
import struct

from .models import HorizonPoint, Site

REFERENCE_RADIUS_M = 1_737_400.0
PRODUCT_ID = "LDEM_75S_240M"
FINE_PRODUCT_ID = "LDEM_875S_20M"


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
        self.product_id = image_path.stem.upper()
        if self.product_id not in (PRODUCT_ID, FINE_PRODUCT_ID) or f'FILE_NAME                 = "{self.product_id}.IMG"' not in label.upper():
            raise TerrainError("Unsupported LOLA product")
        if 'COORDINATE_SYSTEM_NAME       = "MEAN EARTH/POLAR AXIS OF DE421"' not in label.upper():
            raise TerrainError("Unexpected lunar coordinate frame")
        if "SAMPLE_TYPE           = LSB_INTEGER" not in label.upper() or "SAMPLE_BITS           = 16" not in label.upper():
            raise TerrainError("Unexpected LOLA sample encoding")
        self.size = int(_label_number(label, "LINES"))
        self.scale_m = _label_number(label, "MAP_SCALE")
        self.height_scale = _label_number(label, "SCALING_FACTOR")
        self.radius_m = _label_number(label, "OFFSET")
        expected_size, expected_scale = (3812, 240) if self.product_id == PRODUCT_ID else (7584, 20)
        if self.size != expected_size or self.scale_m != expected_scale or self.radius_m != REFERENCE_RADIUS_M:
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

    def pixel_index(self, latitude_deg: float, longitude_deg: float) -> tuple[int, int]:
        """Nearest grid cell (row, col) for a geographic coordinate."""
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
        return row, col

    def pixel_height_m(self, row: int, col: int) -> float:
        if not 0 <= row < self.size or not 0 <= col < self.size:
            raise TerrainError("Requested cell is outside the LOLA image")
        dn = struct.unpack_from("<h", self._data, 2 * (row * self.size + col))[0]
        return dn * self.height_scale

    def pixel_ground_spacing_m(self, row: int, col: int) -> float:
        """Ground distance of one grid step at a cell.

        Polar stereographic scale factor k = sec²(c/2), with c the angular
        distance from the pole; one grid step spans MAP_SCALE / k on the sphere.
        """
        dx = (col - (self.size - 1) / 2) * self.scale_m
        dy = (row - (self.size - 1) / 2) * self.scale_m
        half_colatitude = math.atan(math.hypot(dx, dy) / (2 * self.radius_m))
        return self.scale_m * math.cos(half_colatitude) ** 2

    def pixel_longitude_deg(self, row: int, col: int) -> float:
        dx = col - (self.size - 1) / 2
        dy = (self.size - 1) / 2 - row
        return 0.0 if dx == 0 and dy == 0 else math.degrees(math.atan2(dx, dy))

    def height_m(self, latitude_deg: float, longitude_deg: float) -> float:
        return self.pixel_height_m(*self.pixel_index(latitude_deg, longitude_deg))


def _destination(latitude_deg: float, longitude_deg: float, azimuth_deg: float, distance_m: float) -> tuple[float, float]:
    lat = math.radians(latitude_deg)
    lon = math.radians(longitude_deg)
    bearing = math.radians(azimuth_deg)
    arc = distance_m / REFERENCE_RADIUS_M
    end_lat = math.asin(math.sin(lat) * math.cos(arc) + math.cos(lat) * math.sin(arc) * math.cos(bearing))
    end_lon = lon + math.atan2(math.sin(bearing) * math.sin(arc) * math.cos(lat),
                               math.cos(arc) - math.sin(lat) * math.sin(end_lat))
    return math.degrees(end_lat), math.degrees(end_lon)


from functools import lru_cache
import hashlib


@lru_cache(maxsize=8)
def product_manifest(dem):
    digest = hashlib.sha256()
    with dem.image_path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    label = dem.image_path.with_suffix('.lbl').read_text(encoding='ascii')
    date = re.search(r'PRODUCT_CREATION_TIME\s*=\s*([^\r\n]+)', label)
    return {'id': dem.product_id, 'sha256': digest.hexdigest(), 'pixel_size_m': dem.scale_m,
            'product_creation_time': date.group(1).strip() if date else None,
            'frame': 'MOON_ME_DE421', 'radius_m': dem.radius_m, 'sampling': 'nearest_pixel'}


def fine_covers(dem, site, radius_km=0):
    if dem is None or site.latitude_deg + math.degrees(radius_km * 1000 / REFERENCE_RADIUS_M) > -87.5:
        return False
    try:
        for az in range(0, 360, 30):
            dem.height_m(*_destination(site.latitude_deg, site.longitude_deg, az, radius_km * 1000))
        return True
    except TerrainError:
        return False


@lru_cache(maxsize=96)
def _profile(dem, fine, lat, lon, height, distance_km, azimuth_step):
    site = Site(latitude_deg=lat, longitude_deg=lon)
    near_km = min(5.0, distance_km)
    fine = fine if fine_covers(fine, site, near_km) else None
    origin_dem = fine or dem
    site_height = origin_dem.height_m(lat, lon)
    origin_radius = dem.radius_m + site_height + height
    ranges = []
    if fine:
        ranges.append((fine, fine.scale_m / 2, near_km * 1000, fine.scale_m / 2))
        if distance_km > near_km:
            ranges.append((dem, near_km * 1000 + dem.scale_m / 2, distance_km * 1000, dem.scale_m / 2))
    else:
        ranges.append((dem, dem.scale_m / 2, distance_km * 1000, dem.scale_m / 2))
    profile = []
    for azimuth in range(0, 360, azimuth_step):
        skyline, dominant = -90.0, None
        for dataset, begin, end, step in ranges:
            for i in range(math.ceil((end - begin) / step) + 1):
                distance = min(begin + i * step, end)
                target_lat, target_lon = _destination(lat, lon, azimuth, distance)
                terrain_radius = dataset.radius_m + dataset.height_m(target_lat, target_lon)
                arc = distance / dem.radius_m
                angle = math.degrees(math.atan2(terrain_radius * math.cos(arc) - origin_radius, terrain_radius * math.sin(arc)))
                if angle > skyline:
                    skyline = angle
                    dominant = (f"LOLA_{getattr(dataset, 'product_id', PRODUCT_ID)}_PDS", distance / 1000)
        profile.append(HorizonPoint(azimuth_deg=azimuth, elevation_deg=skyline, source=dominant[0], distance_km=dominant[1]))
    return profile, (site_height + height) / 1000


def horizon_profile(dem, site, *, observer_height_m=2.0, max_distance_km=250, azimuth_step_deg=1, fine_dem=None):
    if not 0 <= observer_height_m <= 100 or not 1 <= max_distance_km <= 300 or azimuth_step_deg not in (1, 2, 5, 10):
        raise ValueError("Invalid horizon sampling parameters")
    points, height = _profile(dem, fine_dem, site.latitude_deg, site.longitude_deg, observer_height_m, max_distance_km, azimuth_step_deg)
    return [point.model_copy() for point in points], height
