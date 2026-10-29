"""독립 로컬 실행용 앱. 기존 FastAPI 앱으로 통합할 때는 사용하지 않는다."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

from . import __version__
from .config import cors_origins
from .database import init_db
from .demo_scenarios import GUIDE, TAGS, seed_demo_scenarios, walkthrough_schema
from .routers.coupons import router as coupons_router
from .routers.sessions import router as sessions_router
from .routers.spots import router as spots_router
from .routers.stars import router as stars_router
from .routers.stores import router as stores_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_demo_scenarios()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="별 헤는 밤 — 로컬 데모 API", version=__version__, lifespan=lifespan,
        docs_url=None, redoc_url=None,
        # 명세 파일 위치 기준으로 API를 호출해 프록시의 경로 접두사도 유지한다.
        servers=[{"url": "."}], root_path_in_servers=False,
        description=GUIDE, openapi_tags=TAGS,
        swagger_ui_parameters={"docExpansion": "list", "defaultModelsExpandDepth": -1},
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Session-ID"],
    )

    for router in (spots_router, sessions_router, stars_router, coupons_router, stores_router):
        app.include_router(router)

    @app.get("/docs", include_in_schema=False)
    def docs():
        # /proxy/8000/docs로 접속해도 /proxy/8000/openapi.json을 요청한다.
        return get_swagger_ui_html(
            openapi_url="./openapi.json", title=f"{app.title} - Swagger UI",
            swagger_ui_parameters=app.swagger_ui_parameters,
        )

    @app.get("/api/v1/health", tags=["health"])
    def health():
        return {"status": "ok", "service": "starry-night-api"}

    def openapi():
        if app.openapi_schema is None:
            app.openapi_schema = walkthrough_schema(get_openapi(
                title=app.title, version=app.version, description=app.description,
                routes=app.routes, tags=TAGS, servers=app.servers,
            ))
        return app.openapi_schema

    app.openapi = openapi

    return app


app = create_app()
