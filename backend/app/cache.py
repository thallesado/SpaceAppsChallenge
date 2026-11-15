from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3


class EphemerisCache:
    """Persistent SQLite cache for JPL Horizons ephemeris queries.

    Stores deterministic celestial coordinates (instant, azimuth, elevation)
    indexed by body ID, location (rounded to 4 decimal places), elevation,
    time window, and step size.
    """

    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path is not None else None
        if self.db_path is not None:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._init_db()

    def _init_db(self) -> None:
        if self.db_path is None:
            return
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ephemeris_cache (
                    cache_key TEXT PRIMARY KEY,
                    body_id INTEGER,
                    lat REAL,
                    lon REAL,
                    height_km REAL,
                    start_utc TEXT,
                    end_utc TEXT,
                    step_minutes INTEGER,
                    data_json TEXT,
                    created_at TEXT
                )
                """
            )
            conn.commit()

    @staticmethod
    def make_key(
        body_id: int,
        lat: float,
        lon: float,
        height_km: float,
        start: datetime,
        end: datetime,
        step_minutes: int,
    ) -> str:
        return f"v2:{body_id}:{lat!r}:{lon!r}:{height_km!r}:{start.isoformat()}:{end.isoformat()}:{step_minutes}"

    def get(
        self,
        body_id: int,
        lat: float,
        lon: float,
        height_km: float,
        start: datetime,
        end: datetime,
        step_minutes: int,
    ) -> list[tuple[datetime, float, float]] | None:
        if self.db_path is None or not self.db_path.exists():
            return None
        key = self.make_key(body_id, lat, lon, height_km, start, end, step_minutes)
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT data_json FROM ephemeris_cache WHERE cache_key = ?", (key,))
                row = cursor.fetchone()
                if not row:
                    return None
                data = json.loads(row[0])
                return [
                    (datetime.fromisoformat(item[0]).replace(tzinfo=timezone.utc), float(item[1]), float(item[2]))
                    for item in data
                ]
        except Exception:
            return None

    def set(
        self,
        body_id: int,
        lat: float,
        lon: float,
        height_km: float,
        start: datetime,
        end: datetime,
        step_minutes: int,
        rows: list[tuple[datetime, float, float]],
    ) -> None:
        if self.db_path is None:
            return
        key = self.make_key(body_id, lat, lon, height_km, start, end, step_minutes)
        serialized = json.dumps([
            [instant.isoformat(), az, el]
            for instant, az, el in rows
        ])
        now_str = datetime.now(timezone.utc).isoformat()
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO ephemeris_cache
                    (cache_key, body_id, lat, lon, height_km, start_utc, end_utc, step_minutes, data_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        key,
                        body_id,
                        round(lat, 4),
                        round(lon, 4),
                        round(height_km, 3),
                        start.isoformat(),
                        end.isoformat(),
                        step_minutes,
                        serialized,
                        now_str,
                    ),
                )
                conn.commit()
        except Exception:
            pass

    def count(self) -> int:
        if self.db_path is None or not self.db_path.exists():
            return 0
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM ephemeris_cache")
                return int(cursor.fetchone()[0])
        except Exception:
            return 0

    def clear(self) -> int:
        if self.db_path is None or not self.db_path.exists():
            return 0
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM ephemeris_cache")
                count = cursor.rowcount
                conn.commit()
                return count
        except Exception:
            return 0
