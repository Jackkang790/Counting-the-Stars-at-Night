"""SQLite 연결과 스팟 테이블 초기화. 앱 시작 시 init_db를 호출한다."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .seed import seed_coupon_template, seed_spots, seed_stores
from .config import stars_per_spot


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
    stars_per_spot()
    database_path().parent.mkdir(parents=True, exist_ok=True)
    with connection() as db:
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
            CREATE TABLE IF NOT EXISTS stars (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                spot_id TEXT NOT NULL REFERENCES spots(id),
                amount INTEGER NOT NULL CHECK(amount > 0),
                created_at TEXT NOT NULL,
                UNIQUE(session_id, spot_id)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS coupon_templates (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                benefit TEXT NOT NULL,
                required_stars INTEGER NOT NULL CHECK(required_stars > 0)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS coupons (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                template_id TEXT NOT NULL REFERENCES coupon_templates(id),
                title TEXT NOT NULL,
                benefit TEXT NOT NULL,
                code TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL CHECK(status IN ('issued', 'redeemed')),
                issued_at TEXT NOT NULL,
                redeemed_at TEXT,
                store_id TEXT REFERENCES stores(id),
                UNIQUE(session_id, template_id)
            )
        """)
        seed_coupon_template(db)
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
        seed_stores(db)
        # v0.1.0 DB도 기존 쿠폰·사용 기록을 보존하며 확장한다.
        columns = {row["name"] for row in db.execute("PRAGMA table_info(coupons)")}
        if "store_id" not in columns:
            db.execute("ALTER TABLE coupons ADD COLUMN store_id TEXT REFERENCES stores(id)")


def get_db():
    """요청마다 연결을 만들고 요청 종료 후 닫는다."""
    with connection() as db:
        yield db
