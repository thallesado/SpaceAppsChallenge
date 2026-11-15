from pydantic import BaseModel, Field


class CatalogSite(BaseModel):
    id: str
    name: str
    region: str
    latitude_deg: float
    longitude_deg: float
    estimated_height_km: float = 0.0
    coordinate_source: str = Field(description="Origin of the coordinates; 'IAU…' for official feature centers, 'Aproximada…' otherwise")
    description: str
    scientific_interest: str
    artemis_candidate: bool = True
    x_map_hint: float | None = None
    y_map_hint: float | None = None


# Feature centers come from the IAU Gazetteer (https://planetarynames.wr.usgs.gov, planetographic, +East).
# Heights are read from LOLA LDEM_75S_240M at each coordinate, relative to the 1737.4 km sphere.
# Crater centers sit on the crater floor, not on the rim.
LUNAR_SOUTH_POLE_SITES: list[CatalogSite] = [
    CatalogSite(
        id="mouton",
        name="Mons Mouton",
        region="Región Artemis III",
        latitude_deg=-84.60,
        longitude_deg=31.00,
        estimated_height_km=5.0,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de Mons Mouton (antes Leibnitz Beta)",
        description="Macizo de unos 130 km, una de las estructuras más altas próximas al polo sur lunar.",
        scientific_interest="Cima elevada: horizonte despejado que favorece la iluminación solar y la visibilidad de la Tierra.",
        artemis_candidate=True,
        x_map_hint=40,
        y_map_hint=29,
    ),
    CatalogSite(
        id="malapert",
        name="Mons Malapert",
        region="Región Artemis III",
        latitude_deg=-85.98,
        longitude_deg=-1.67,
        estimated_height_km=4.9,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de Mons Malapert",
        description="Macizo prominente con línea de visión hacia la Tierra y relieve circundante complejo.",
        scientific_interest="Cima elevada orientada hacia la Tierra; candidata habitual para comunicación directa.",
        artemis_candidate=True,
        x_map_hint=66,
        y_map_hint=42,
    ),
    CatalogSite(
        id="haworth",
        name="Haworth (fondo del cráter)",
        region="Región Polar Sur",
        latitude_deg=-87.45,
        longitude_deg=-5.17,
        estimated_height_km=-3.3,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de cráter Haworth",
        description="Centro del cráter Haworth, una región de sombra permanente (PSR).",
        scientific_interest="Trampa fría de volátiles; sirve de contraste: el relieve bloquea el Sol y la Tierra.",
        artemis_candidate=False,
        x_map_hint=50,
        y_map_hint=64,
    ),
    CatalogSite(
        id="gerlache",
        name="de Gerlache Rim 2",
        region="Región Artemis III",
        latitude_deg=-88.3,
        longitude_deg=-59.5,
        estimated_height_km=-0.1,
        coordinate_source="Aproximada: región candidata Artemis III sin coordenada oficial verificada",
        description="Zona próxima al cráter de Gerlache, cerca del polo sur geográfico.",
        scientific_interest="Iluminación solar prolongada en verano lunar del sur y cercanía a depósitos volátiles en cráteres adyacentes.",
        artemis_candidate=True,
        x_map_hint=28,
        y_map_hint=66,
    ),
    CatalogSite(
        id="shackleton",
        name="Shackleton Crater Rim",
        region="Región Polar Sur",
        latitude_deg=-89.9,
        longitude_deg=0.0,
        estimated_height_km=0.7,
        coordinate_source="Aproximada: punto del borde a 12 km del centro IAU del cráter Shackleton (radio 10,5 km)",
        description="Borde del cráter Shackleton, que coincide prácticamente con el polo sur lunar.",
        scientific_interest="Bordes con iluminación casi permanente frente a un interior en oscuridad perpetua.",
        artemis_candidate=True,
        x_map_hint=50,
        y_map_hint=50,
    ),
    CatalogSite(
        id="shackleton-floor",
        name="Shackleton (fondo del cráter)",
        region="Región Polar Sur",
        latitude_deg=-89.67,
        longitude_deg=129.78,
        estimated_height_km=-2.8,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de cráter Shackleton",
        description="Centro del cráter Shackleton, en sombra permanente.",
        scientific_interest="Contraste con su borde: a pocos kilómetros, el relieve cambia por completo la iluminación.",
        artemis_candidate=False,
        x_map_hint=53,
        y_map_hint=47,
    ),
    CatalogSite(
        id="nobile",
        name="Nobile (centro del cráter)",
        region="Región Polar Sur",
        latitude_deg=-85.28,
        longitude_deg=53.27,
        estimated_height_km=0.9,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de cráter Nobile",
        description="Centro del cráter Nobile, área de prospección de volátiles de la misión VIPER.",
        scientific_interest="Mosaico de microclimas térmicos e interfaz luz/sombra permanente.",
        artemis_candidate=False,
        x_map_hint=72,
        y_map_hint=35,
    ),
    CatalogSite(
        id="faustini",
        name="Faustini (fondo del cráter)",
        region="Región Polar Sur",
        latitude_deg=-87.18,
        longitude_deg=84.31,
        estimated_height_km=-2.8,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de cráter Faustini",
        description="Centro del cráter Faustini, región de sombra permanente.",
        scientific_interest="Trampa fría profunda; contraste con los bordes iluminados.",
        artemis_candidate=False,
        x_map_hint=85,
        y_map_hint=55,
    ),
    CatalogSite(
        id="amundsen",
        name="Amundsen (centro del cráter)",
        region="Región Polar Sur",
        latitude_deg=-84.44,
        longitude_deg=83.07,
        estimated_height_km=-3.6,
        coordinate_source="IAU Gazetteer of Planetary Nomenclature: centro de cráter Amundsen",
        description="Centro del gran cráter de impacto Amundsen.",
        scientific_interest="Estratigrafía lunar expuesta; el fondo queda por debajo del relieve circundante.",
        artemis_candidate=False,
        x_map_hint=88,
        y_map_hint=25,
    ),
    CatalogSite(
        id="connecting-ridge",
        name="Connecting Ridge",
        region="Región Artemis III",
        latitude_deg=-89.4,
        longitude_deg=-137.5,
        estimated_height_km=1.8,
        coordinate_source="Aproximada: región candidata Artemis III sin coordenada oficial verificada",
        description="Cresta que conecta el cráter Shackleton con de Gerlache; este punto cae en su ladera.",
        scientific_interest="Corredor natural de movilidad para rovers y alta exposición solar en la cresta.",
        artemis_candidate=True,
        x_map_hint=35,
        y_map_hint=75,
    ),
]


def list_sites(artemis_only: bool = False, query: str | None = None) -> list[CatalogSite]:
    sites = LUNAR_SOUTH_POLE_SITES
    if artemis_only:
        sites = [s for s in sites if s.artemis_candidate]
    if query:
        q = query.strip().lower()
        sites = [s for s in sites if q in s.name.lower() or q in s.id.lower() or q in s.region.lower()]
    return sites


def find_site(site_id: str) -> CatalogSite | None:
    target = site_id.strip().lower()
    for s in LUNAR_SOUTH_POLE_SITES:
        if s.id.lower() == target:
            return s
    return None
