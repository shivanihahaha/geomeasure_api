import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.config import settings
from backend.app.core.exceptions import GeoMeasureException
from backend.app.core.logging import logger
from backend.app.repositories.database import init_db
from backend.app.api.routes.files import router as files_router
from backend.app.api.routes.measurements import router as measurements_router
from backend.app.api.routes.health import router as health_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite/PostGIS tables
    logger.info("Initializing GeoMeasure database tables...")
    init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info("Shutting down GeoMeasure API...")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production-grade Geospatial File Measurement & Analysis Platform API. "
        "Accepts .kml and .zip (Shapefiles), extracts geometries, validates CRS, "
        "projects coordinates into optimal metric coordinate systems (e.g. UTM), "
        "calculates polygon areas and linestring lengths, and provides rich map/export data."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging & timing middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration_ms = int((time.time() - start_time) * 1000)
    logger.info(f"{request.method} {request.url.path} returned {response.status_code} in {duration_ms}ms")
    response.headers["X-Process-Time-Ms"] = str(duration_ms)
    return response

# Standard structured error handling
@app.exception_handler(GeoMeasureException)
async def geomeasure_exception_handler(request: Request, exc: GeoMeasureException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )

# Generic exception handler
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred during geospatial processing.",
                "details": {"error_type": type(exc).__name__}
            }
        }
    )

# Include Routers under /api
app.include_router(files_router, prefix="/api")
app.include_router(measurements_router, prefix="/api")
app.include_router(health_router, prefix="/api")

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "GeoMeasure API is running.",
        "documentation": "/docs",
        "health": "/api/health"
    }
