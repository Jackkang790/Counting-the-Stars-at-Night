"""별 6개 규칙으로 이전. 과거 집계 기록에서 체험 종류를 추측하지 않는다."""

from datetime import datetime, timedelta
import sqlite3

STARS_SQL = """
    CREATE TABLE stars (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        spot_id TEXT NOT NULL REFERENCES spots(id) CHECK(spot_id IN ('a', 'b', 'c')),
        kind TEXT NOT NULL CHECK(kind IN ('role', 'escape')),
        created_at TEXT NOT NULL,
        UNIQUE(session_id, spot_id, kind)
    )
"""

COUPONS_SQL = """
    CREATE TABLE {table} (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),
        title TEXT NOT NULL,
        benefit TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('issued', 'redeemed')),
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        redeemed_at TEXT,
        store_id TEXT REFERENCES stores(id)
    )
"""


def columns(db: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}


def migrate_current_visit(db: sqlite3.Connection) -> None:
    """세션마다 최근 도착 기록 하나만 남긴다. 같은 시각은 나중 삽입한 행을 택한다."""
    db.execute("""
        DELETE FROM visits
        WHERE rowid != (
            SELECT current_visit.rowid FROM visits AS current_visit
            WHERE current_visit.session_id = visits.session_id
            ORDER BY current_visit.created_at DESC, current_visit.rowid DESC LIMIT 1
        )
    """)
    db.execute("CREATE UNIQUE INDEX IF NOT EXISTS visits_one_per_session ON visits(session_id)")


def migrate_collection(db: sqlite3.Connection, valid_days: int) -> None:
    star_columns = columns(db, "stars")
    if star_columns and "kind" not in star_columns:
        # 원래 기록은 남기지만, 역할극·방탈출을 임의로 완료 처리하지 않는다.
        db.execute("ALTER TABLE stars RENAME TO legacy_stars_v020")
        star_columns = set()
    if not star_columns:
        db.execute(STARS_SQL)

    coupon_columns = columns(db, "coupons")
    if not coupon_columns:
        db.execute(COUPONS_SQL.format(table="coupons"))
    elif "template_id" in coupon_columns or not {"expires_at", "store_id"}.issubset(coupon_columns):
        duplicate = db.execute(
            "SELECT session_id FROM coupons GROUP BY session_id HAVING COUNT(*) > 1 LIMIT 1"
        ).fetchone()
        if duplicate:
            raise RuntimeError("쿠폰 이전 중단: 한 세션에 여러 쿠폰이 있습니다. 기존 기록을 먼저 검토하세요.")
        db.execute(COUPONS_SQL.format(table="coupons_next"))
        for row in db.execute("SELECT * FROM coupons").fetchall():
            old = dict(row)
            expiry = old.get("expires_at") or (
                datetime.fromisoformat(old["issued_at"]) + timedelta(days=valid_days)
            ).isoformat()
            db.execute(
                "INSERT INTO coupons_next (id, session_id, title, benefit, code, status, "
                "issued_at, expires_at, redeemed_at, store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (old["id"], old["session_id"], old["title"], old["benefit"], old["code"], old["status"],
                 old["issued_at"], expiry, old.get("redeemed_at"), old.get("store_id")),
            )
        db.execute("DROP TABLE coupons")
        db.execute("ALTER TABLE coupons_next RENAME TO coupons")
    db.execute("DROP TABLE IF EXISTS coupon_templates")
