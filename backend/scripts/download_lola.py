"""Download public LOLA south-polar DEM products from NASA PDS."""

import argparse
from pathlib import Path
from urllib.request import urlopen

BASE_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
FILES = {"ldem_75s_240m.lbl": 4_990, "ldem_75s_240m.img": 29_062_688}
FINE_FILES = {"ldem_875s_20m.lbl": 4_988, "ldem_875s_20m.img": 115_034_112}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--highres", action="store_true", help="also download the 20 m/pixel DEM south of 87.5°S (115 MB)")
    args = parser.parse_args()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for name, expected_size in (FILES | (FINE_FILES if args.highres else {})).items():
        target = DATA_DIR / name
        if target.is_file() and target.stat().st_size == expected_size:
            print(f"Already available: {target}")
            continue
        temporary = target.with_suffix(target.suffix + ".part")
        try:
            with urlopen(BASE_URL + name, timeout=120) as response, temporary.open("wb") as output:
                while block := response.read(1024 * 1024):
                    output.write(block)
            if temporary.stat().st_size != expected_size:
                raise RuntimeError(f"Unexpected {name} size; expected {expected_size} bytes")
            temporary.replace(target)
            print(f"Downloaded: {target}")
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
