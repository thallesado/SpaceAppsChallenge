"""Download the kernels required by validate_spice.py from NAIF and ESA."""

from pathlib import Path
import httpx
import hashlib
import json

TARGET = Path(__file__).resolve().parents[1] / "data" / "kernels"
FILES = {
    "naif0012.tls": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
    "de440s.bsp": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
    "moon_pa_de440_200625.bpc": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc",
    "moon_de440_250416.tf": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf",
    "inpop19a_19900101_20500101.bsp": "https://spiftp.esac.esa.int/data/SPICE/JUICE/kernels/spk/inpop19a_19900101_20500101.bsp",
}


def main() -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        target = TARGET / name
        if target.is_file() and target.stat().st_size > 1000:
            print(f"Already available: {target}")
            continue
        temporary = target.with_suffix(target.suffix + ".part")
        try:
            with httpx.stream("GET", url, timeout=120, follow_redirects=True) as response, temporary.open("wb") as output:
                response.raise_for_status()
                for block in response.iter_bytes(1024 * 1024):
                    output.write(block)
            if temporary.stat().st_size < 1000:
                raise RuntimeError(f"Empty or truncated kernel: {name}")
            manifest = Path(__file__).resolve().parents[2] / "docs" / "VALIDACION_SPICE.json"
            expected = json.loads(manifest.read_text(encoding="utf-8")).get("kernel_sha256", {}).get(name)
            if expected and hashlib.sha256(temporary.read_bytes()).hexdigest() != expected:
                raise RuntimeError(f"Kernel hash does not match validation manifest: {name}")
            temporary.replace(target)
            print(f"Downloaded: {target}")
        finally:
            temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
