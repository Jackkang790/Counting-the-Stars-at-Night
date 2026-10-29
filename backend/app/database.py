"""SQLite 연결과 스팟 테이블 초기화. 앱 시작 시 init_db를 호출한다."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .seed import seed_spots, seed_stores
from .config import coupon_valid_days
from .migrations import migrate_collection, migrate_current_visit


def database_path() -> Path:
    default = Path(__file__).resolve().parents[1] / "data" / "starry-night.sqlite3"
    return Path(os.environ.get("DATABASE_PATH", str(default))).expanduser().resolve()


@contextmanager
def connection():
    # FastAPI의 동기 의존성과 핸들러는 서로 다른 작업 스레드에서 실행될 수 있다.
    # 연결은 요청별로 생성하며 여러 요청 사이에 공유하지 않는다.
    db = sqlite3.connect(database_path(), timeout=10, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def init_db() -> None:
    # 잘못된 데모 설정은 첫 완료 요청이 아닌 앱 시작 시 알린다.
    valid_days = coupon_valid_days()
    database_path().parent.mkdir(parents=True, exist_ok=True)
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("""
            CREATE TABLE IF NOT EXISTS spots (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                display_order INTEGER NOT NULL UNIQUE
            )
        """)
        seed_spots(db)
        db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS visits (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                spot_id TEXT NOT NULL REFERENCES spots(id),
                created_at TEXT NOT NULL,
                UNIQUE(session_id, spot_id)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS stores (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                display_location TEXT NOT NULL,
                accepts_coupon INTEGER NOT NULL CHECK(accepts_coupon IN (0, 1)),
                is_demo INTEGER NOT NULL CHECK(is_demo IN (0, 1))
            )
        """)
        store_columns = {row["name"] for row in db.execute("PRAGMA table_info(stores)")}
        for name, sql_type in (("lat", "REAL"), ("lng", "REAL"),
                               ("opens_at", "TEXT"), ("closes_at", "TEXT")):
            if name not in store_columns:
                db.execute(f"ALTER TABLE stores ADD COLUMN {name} {sql_type}")
        seed_stores(db)
        migrate_collection(db, valid_days)
        migrate_current_visit(db)


def get_db():
    """요청마다 연결을 만들고 요청 종료 후 닫는다."""
    with connection() as db:
        yield db
