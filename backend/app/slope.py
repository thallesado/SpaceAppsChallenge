"""Regional slope from the LOLA LDEM_75S_240M grid.

Slope is computed with Horn's 3x3 finite-difference operator on the polar
stereographic grid, correcting each grid step to ground distance with the
projection scale factor. Heights are radial above the 1 737.4 km reference
sphere, so the gradient is measured against the local horizontal.

This is a *regional* metric. A 240 m grid smooths craters, boulders and
slopes at the scale of a lander footprint, and the result depends on the
baseline used. It is never a landing-safety determination.
"""

import math

from pydantic import BaseModel, Field

from .models import Site
from .terrain import LolaDem, TerrainError

ALLOWED_BASELINE_PIXELS = (1, 2, 4)


class SlopeRequest(BaseModel):
    site: Site
    baseline_pixels: int = Field(default=1, description="Horn kernel half-width in grid cells: 1, 2 or 4 (240, 480 or 960 m at the pole)")
    neighborhood_radius_m: float = Field(default=1000, ge=0, le=5000, description="Radius of the area statistics around the site")
    threshold_deg: float | None = Field(default=None, gt=0, lt=90, description="User-defined comparison threshold. It is not a landing criterion.")


class SlopeAtScale(BaseModel):
    baseline_pixels: int
    baseline_m: float
    slope_deg: float
    aspect_deg: float | None


class NeighborhoodSlope(BaseModel):
    radius_m: float
    cells: int
    mean_deg: float
    p90_deg: float
    max_deg: float
    fraction_above_threshold: float | None


class SlopeResult(BaseModel):
    site: Site
    site_height_m: float
    cell_row: int
    cell_col: int
    pixel_scale_m: float
    ground_spacing_m: float
    baseline_pixels: int
    baseline_m: float
    slope_deg: float
    aspect_deg: float | None = Field(description="Downslope azimuth, degrees clockwise from local north; null on flat cells")
    multiscale: list[SlopeAtScale]
    neighborhood: NeighborhoodSlope
    threshold_deg: float | None
    threshold_status: str = Field(description="'not_evaluated', 'at_or_below_user_threshold' or 'above_user_threshold'")
    source: str = "LOLA_LDEM_75S_240M_PDS"
    method: str = "Horn 3x3 finite differences on the polar stereographic grid, scale-factor corrected"
    note: str = (
        "Regional preliminary slope from a 240 m/pixel DEM. It does not resolve craters, boulders or slopes at "
        "lander-footprint scale, and the value depends on the baseline. The threshold is user-defined; vehicle "
        "limits depend on the lander and on how slope is measured. This is not a landing-safety assessment."
    )


def _horn(dem: LolaDem, row: int, col: int, b: int) -> tuple[float, float | None]:
    """Slope and downslope aspect (degrees) at a cell with kernel half-width b."""
    if not (b <= row < dem.size - b and b <= col < dem.size - b):
        raise TerrainError("Slope kernel extends outside the LOLA image")
    z = lambda dr, dc: dem.pixel_height_m(row + dr * b, col + dc * b)  # noqa: E731
    step = b * dem.pixel_ground_spacing_m(row, col)
    # x grows to image right, y grows to image top (row decreasing).
    gx = ((z(-1, 1) + 2 * z(0, 1) + z(1, 1)) - (z(-1, -1) + 2 * z(0, -1) + z(1, -1))) / (8 * step)
    gy = ((z(-1, -1) + 2 * z(-1, 0) + z(-1, 1)) - (z(1, -1) + 2 * z(1, 0) + z(1, 1))) / (8 * step)
    slope = math.degrees(math.atan(math.hypot(gx, gy)))
    if gx == 0 and gy == 0:
        return slope, None
    # At a south polar cell with longitude λ, local north (away from the pole)
    # is (sin λ, cos λ) in grid x/y and local east is (cos λ, -sin λ).
    lon = math.radians(dem.pixel_longitude_deg(row, col))
    d_east = gx * math.cos(lon) - gy * math.sin(lon)
    d_north = gx * math.sin(lon) + gy * math.cos(lon)
    uphill = math.degrees(math.atan2(d_east, d_north))
    return slope, (uphill + 180) % 360


def _percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = fraction * (len(ordered) - 1)
    low = math.floor(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def regional_slope(dem: LolaDem, site: Site, *, baseline_pixels: int = 1, neighborhood_radius_m: float = 1000,
                   threshold_deg: float | None = None) -> SlopeResult:
    if baseline_pixels not in ALLOWED_BASELINE_PIXELS:
        raise ValueError("baseline_pixels must be 1, 2 or 4")
    if not 0 <= neighborhood_radius_m <= 5000:
        raise ValueError("neighborhood_radius_m must be between 0 and 5000")
    row, col = dem.pixel_index(site.latitude_deg, site.longitude_deg)
    spacing = dem.pixel_ground_spacing_m(row, col)
    slope, aspect = _horn(dem, row, col, baseline_pixels)

    multiscale = []
    for b in ALLOWED_BASELINE_PIXELS:
        value, direction = _horn(dem, row, col, b)
        multiscale.append(SlopeAtScale(baseline_pixels=b, baseline_m=round(b * spacing, 1),
                                       slope_deg=round(value, 2),
                                       aspect_deg=None if direction is None else round(direction, 1)))

    reach = int(neighborhood_radius_m // spacing)
    values = []
    for dr in range(-reach, reach + 1):
        for dc in range(-reach, reach + 1):
            if math.hypot(dr, dc) * spacing <= neighborhood_radius_m:
                values.append(_horn(dem, row + dr, col + dc, baseline_pixels)[0])
    fraction = None
    if threshold_deg is not None:
        fraction = round(sum(v > threshold_deg for v in values) / len(values), 4)
    neighborhood = NeighborhoodSlope(radius_m=neighborhood_radius_m, cells=len(values),
                                     mean_deg=round(sum(values) / len(values), 2),
                                     p90_deg=round(_percentile(values, 0.9), 2),
                                     max_deg=round(max(values), 2), fraction_above_threshold=fraction)

    if threshold_deg is None:
        status = "not_evaluated"
    else:
        status = "above_user_threshold" if slope > threshold_deg else "at_or_below_user_threshold"
    return SlopeResult(site=site, site_height_m=dem.pixel_height_m(row, col), cell_row=row, cell_col=col,
                       pixel_scale_m=dem.scale_m, ground_spacing_m=round(spacing, 2),
                       baseline_pixels=baseline_pixels, baseline_m=round(baseline_pixels * spacing, 1),
                       slope_deg=round(slope, 2), aspect_deg=None if aspect is None else round(aspect, 1),
                       multiscale=multiscale, neighborhood=neighborhood,
                       threshold_deg=threshold_deg, threshold_status=status)
