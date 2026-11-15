from pathlib import Path
import struct

from fastapi.testclient import TestClient

from app.main import app
from app.mesh import GRID_SIZE, terrain_mesh
from app.models import Site
from app.terrain import LolaDem


def synthetic_dem(tmp_path: Path) -> Path:
    image = tmp_path / "ldem_75s_240m.img"
    image.with_suffix(".lbl").write_bytes((Path(__file__).parents[1] / "data" / "ldem_75s_240m.lbl").read_bytes())
    with image.open("wb") as output:
        output.truncate(3812 * 3812 * 2)
    return image


def test_mesh_uses_actual_neighboring_dem_cells(tmp_path):
    image = synthetic_dem(tmp_path)
    site = Site(latitude_deg=-89, longitude_deg=0)
    with LolaDem(image) as dem:
        row, col = dem.pixel_index(site.latitude_deg, site.longitude_deg)
    with image.open("r+b") as output:
        output.seek(2 * ((row + 1) * 3812 + col + 2))
        output.write(struct.pack("<h", 800))
    with LolaDem(image) as dem:
        result = terrain_mesh(dem, site)
    assert result.grid_size == GRID_SIZE
    assert result.span_m == 9600
    assert len(result.heights_m) == GRID_SIZE ** 2
    assert result.heights_m[(GRID_SIZE // 2 + 1) * GRID_SIZE + GRID_SIZE // 2 + 2] == 400
    assert result.max_height_m == 400
    assert result.min_height_m == 0


def test_mesh_endpoint_and_edge_rejection(monkeypatch, tmp_path):
    image = synthetic_dem(tmp_path)
    monkeypatch.setenv("LUNARPATH_DEM_PATH", str(image))
    with TestClient(app) as client:
        result = client.post("/api/v1/terrain/grid", json={"site": {"latitude_deg": -89, "longitude_deg": 0}})
        assert result.status_code == 200, result.text
        assert len(result.json()["heights_m"]) == GRID_SIZE ** 2
        edge = client.post("/api/v1/terrain/grid", json={"site": {"latitude_deg": -75, "longitude_deg": 0}})
        assert edge.status_code == 422
