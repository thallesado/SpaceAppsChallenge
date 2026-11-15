"""Small georeferenced terrain grid for visualization, sampled from LOLA."""

from pydantic import BaseModel, Field

from .models import Site
from .terrain import LolaDem, TerrainError

GRID_SIZE = 41


class MeshRequest(BaseModel):
    site: Site


class MeshResult(BaseModel):
    site: Site
    grid_size: int
    grid_spacing_m: float
    ground_spacing_m: float
    span_m: float
    center_row: int
    center_col: int
    center_x_m: float
    center_y_m: float
    heights_m: list[float]
    min_height_m: float
    max_height_m: float
    source: str
    projection: str = "IAU2000::30120"
    note: str


def terrain_mesh(dem: LolaDem, site: Site) -> MeshResult:
    row, col = dem.pixel_index(site.latitude_deg, site.longitude_deg)
    grid_size = 101 if dem.scale_m == 20 else GRID_SIZE
    half = grid_size // 2
    if row - half < 0 or row + half >= dem.size or col - half < 0 or col + half >= dem.size:
        raise TerrainError("Terrain mesh extends outside LOLA coverage")
    heights = [dem.pixel_height_m(r, c)
               for r in range(row - half, row + half + 1)
               for c in range(col - half, col + half + 1)]
    return MeshResult(
        site=site,
        grid_size=grid_size,
        grid_spacing_m=dem.scale_m,
        ground_spacing_m=round(dem.pixel_ground_spacing_m(row, col), 3),
        span_m=(grid_size - 1) * dem.scale_m,
        center_row=row,
        center_col=col,
        center_x_m=(col - (dem.size - 1) / 2) * dem.scale_m,
        center_y_m=((dem.size - 1) / 2 - row) * dem.scale_m,
        heights_m=heights,
        min_height_m=min(heights),
        max_height_m=max(heights),
        source=f"LOLA_{dem.product_id}_PDS",
        note=f"Visualization grid from a {dem.scale_m:g} m/pixel DEM; vertical exaggeration and display lighting do not change scientific visibility results.",
    )
