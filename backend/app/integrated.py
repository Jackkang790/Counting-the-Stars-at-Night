"""프론트·AR·REST를 같은 origin에서 제공하는 통합 실행 앱."""

from contextlib import asynccontextmanager
import json
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .database import connection, init_db
from .demo import create_app as create_api_app
from .demo_scenarios import seed_demo_scenarios

ROOT = Path(__file__).resolve().parents[2]


def seed_frontend_tour() -> None:
    tour = json.loads((ROOT / "shared" / "tour.json").read_text(encoding="utf-8"))
    with connection() as db:
        for spot in tour["spots"]:
            # 명칭만 맞추며 방문·별·쿠폰 기록은 보존한다.
            db.execute("UPDATE spots SET name = ? WHERE id = ?", (spot["name"], spot["server"]))
        for cafe in tour["cafes"]:
            db.execute(
                "INSERT INTO stores (id, name, description, display_location, accepts_coupon, is_demo, lat, lng) "
                "VALUES (?, ?, ?, ?, 1, 1, ?, ?) ON CONFLICT(id) DO NOTHING",
                (cafe["id"], cafe["name"], "통합 시연용 매장. 실제 제휴·혜택·영업시간은 확정 전입니다.",
                 cafe["area"], cafe["lat"], cafe["lng"]),
            )


@asynccontextmanager
async def lifespan(app):
    init_db()
    seed_frontend_tour()
    seed_demo_scenarios()
    yield


def create_app():
    app = create_api_app()
    app.router.lifespan_context = lifespan
    ar_dist = ROOT / "ar-engine" / "dist"
    front_dist = ROOT / "dist"
    # API 라우터보다 뒤에 등록한다. API의 404를 SPA HTML로 바꾸지 않는다.
    if ar_dist.is_dir():
        app.mount("/ar", StaticFiles(directory=ar_dist, html=True), name="ar")
    if front_dist.is_dir():
        app.mount("/", StaticFiles(directory=front_dist, html=True), name="frontend")
    return app


app = create_app()
