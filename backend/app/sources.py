"""NASA source adapters. No caller-controlled upstream URLs."""
import asyncio
import math
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET

import httpx
import rasterio
from rasterio.warp import transform


class SourceError(Exception):
    pass


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href", "")
            if href.lower().endswith((".tif", ".tiff")):
                self.links.append(href)


class Sources:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.cache = {}

    async def get(self, url, params=None, json=True):
        key = (url, str(params), json)
        cached = self.cache.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            value = response.json() if json else response.text
        except (httpx.HTTPError, ValueError) as exc:
            raise SourceError("NASA source unavailable or returned invalid data") from exc
        if len(self.cache) >= 128:
            self.cache.clear()
        self.cache[key] = (time.monotonic() + 900, value)
        return value

    async def layers(self, projection="southpole"):
        config = (await self.get("https://trek.nasa.gov/tiles/apidoc/config/config.json"))["moon"]
        url = config["service_endpoints"]["listVisibleLayersUrl"].replace("PROJECTIONTYPE", "eq" if projection == "equirectangular" else "polar").replace("PROJECTION", config["projections"][projection])
        # The official polar index can contain both poles: filter by projection.
        url = url.replace("2147483647", "1000")
        docs = (await self.get(url))["response"]["docs"]
        return [{"id": d["item_UUID"], "title": d.get("title"), "label": d.get("productLabel"),
                 "projection": d.get("dataProjection", d.get("projection")), "bounding": d.get("bounding"),
                 "source": "NASA Moon Trek"} for d in docs
                if projection == "equirectangular" or ("south" if projection == "southpole" else "north") in str(d).lower() or ("spole" if projection == "southpole" else "npole") in str(d).lower() or config["projections"][projection] in str(d)]

    async def capabilities(self, layer_id):
        payload = await self.get("https://trek.nasa.gov/moon/TrekServices/ws/index/getLayerServices", {"uuid": layer_id})
        docs = payload.get("response", {}).get("docs", [])
        if not docs:
            raise SourceError("Layer service not found")
        endpoint = docs[0].get("endPoint", "")
        if not endpoint.startswith("https://trek.nasa.gov/tiles/"):
            raise SourceError("Unsupported layer endpoint")
        url = endpoint.rstrip("/") + "/1.0.0/WMTSCapabilities.xml"
        try:
            root = ET.fromstring(await self.get(url, json=False))
        except ET.ParseError as exc:
            raise SourceError("Invalid WMTS capabilities") from exc
        ns = {"w": "http://www.opengis.net/wmts/1.0", "o": "http://www.opengis.net/ows/1.1"}
        return {"source": "NASA Moon Trek", "capabilities_url": url,
                "tile_resources": [e.attrib for e in root.findall(".//w:ResourceURL", ns)],
                "matrix_sets": [{"id": e.findtext("o:Identifier", namespaces=ns),
                    "crs": e.findtext("o:SupportedCRS", namespaces=ns)} for e in root.findall(".//w:Contents/w:TileMatrixSet", ns)]}

    async def products(self, product):
        page = f"https://pgda.gsfc.nasa.gov/products/{product}"
        parser = Links()
        parser.feed(await self.get(page, json=False))
        urls = sorted({urljoin(page, link) for link in parser.links})
        return [{"id": urlparse(u).path.rsplit("/", 1)[-1], "url": u,
                 "product": product, "source_page": page, "source": "NASA GSFC PGDA / LRO LOLA"}
                for u in urls if urlparse(u).hostname == "pgda.gsfc.nasa.gov"]

    async def elevation(self, product, dataset_id, latitude, longitude):
        datasets = await self.products(product)
        dataset = next((d for d in datasets if d["id"] == dataset_id and d["id"].startswith("LDEM_")), None)
        if dataset is None:
            raise SourceError("Elevation dataset not found in official catalog")
        return await asyncio.to_thread(sample_dem, dataset, latitude, longitude)


def sample_dem(dataset, latitude, longitude):
    try:
        with rasterio.Env(GDAL_HTTP_TIMEOUT="20", GDAL_HTTP_MAX_RETRY="1", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF,.tif"):
            with rasterio.open(dataset["url"]) as dem:
                if dem.crs is None:
                    raise SourceError("DEM has no coordinate reference system")
                geographic = rasterio.crs.CRS.from_string("+proj=longlat +a=1737400 +b=1737400 +no_defs")
                x, y = transform(geographic, dem.crs, [longitude], [latitude])
                if not (dem.bounds.left <= x[0] < dem.bounds.right and dem.bounds.bottom < y[0] <= dem.bounds.top):
                    raise SourceError("Site outside dataset coverage")
                sample = next(dem.sample([(x[0], y[0])], masked=True))[0]
                if getattr(sample, "mask", False) or not math.isfinite(float(sample)):
                    raise SourceError("No elevation data at site")
                return {"dataset": dataset, "latitude_deg": latitude, "longitude_deg": longitude,
                        "elevation_m": float(sample), "pixel_size_m": list(dem.res), "crs_wkt": dem.crs.to_wkt(),
                        "method": "nearest_pixel", "reference_frame": "MOON_ME / DE421 (see product documentation)",
                        "note": "Terrain elevation only; not a computed horizon. Do not use as Horizons height without datum reconciliation."}
    except SourceError:
        raise
    except Exception as exc:
        raise SourceError("Could not read official DEM region") from exc
