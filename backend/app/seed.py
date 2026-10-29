"""초기 스팟과 가상 매장, 데모 쿠폰 설정."""

import sqlite3
import os

from .config import coupon_required_stars


# 기존 프론트 API.md의 스팟 ID를 유지한다.
SPOTS = (
    ("a", "관사 16호", "소제동 철도관사촌 투어 스팟", 1),
    ("b", "관사 42호", "소제동 철도관사촌 투어 스팟. 실제 사용 가능 여부 확인 필요", 2),
    ("c", "헤레디움", "인동 투어 스팟", 3),
)


def seed_spots(db: sqlite3.Connection) -> None:
    # 재시작 시 중복 생성하거나 기존 내용을 덮어쓰지 않는다.
    db.executemany(
        "INSERT INTO spots (id, name, description, display_order) "
        "VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        SPOTS,
    )


DEMO_TEMPLATE_ID = "demo-cafe"


def seed_coupon_template(db: sqlite3.Connection) -> None:
    # 설정은 시작 시 읽는다. 재시작 시 기준은 갱신하되 기존 발급 쿠폰은 보존한다.
    db.execute(
        "INSERT INTO coupon_templates (id, title, benefit, required_stars) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET title=excluded.title, benefit=excluded.benefit, "
        "required_stars=excluded.required_stars",
        (DEMO_TEMPLATE_ID, os.environ.get("DEMO_COUPON_TITLE", "[데모] 카페 체험 쿠폰"),
         os.environ.get("DEMO_COUPON_BENEFIT", "[가상 혜택] 음료 1,000원 할인"),
         coupon_required_stars()),
    )


DEMO_STORES = (
    ("demo-store-1", "[가상] 별빛 카페", "시연용 가상 매장. 실제 제휴 매장이 아닙니다.",
     "[데모] 소제동 구역 A", 1, 1),
    ("demo-store-2", "[가상] 골목 카페", "시연용 가상 매장. 실제 제휴 매장이 아닙니다.",
     "[데모] 소제동 구역 B", 1, 1),
    ("demo-store-3", "[가상] 밤하늘 카페", "쿠폰 사용 불가 상태를 보여주는 시연용 가상 매장입니다.",
     "[데모] 인동 구역 A", 0, 1),
)


def seed_stores(db: sqlite3.Connection) -> None:
    db.executemany(
        "INSERT INTO stores (id, name, description, display_location, accepts_coupon, is_demo) "
        "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
        DEMO_STORES,
    )
