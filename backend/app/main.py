from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db, init_db
from app.migrate import auto_preserve_and_migrate
from app.models import FoodCatalogue
from app.routers import dashboard, inventory, temperature
from app.schemas import FoodCatalogueResponse, HealthResponse
from app.seed_data import seed_catalogue_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager that initializes tables, seeds catalogue, and preserves records."""
    # Create all four database tables automatically on startup
    init_db()
    # Seed food catalogue idempotently and preserve records
    with SessionLocal() as db:
        seed_catalogue_data(db)
        auto_preserve_and_migrate(db)
    yield


app = FastAPI(
    title="Smart Food Storage API",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for local development (React Vite frontend)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount domain routers
app.include_router(inventory.router)
app.include_router(temperature.router)
app.include_router(dashboard.router)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint to verify system and database connectivity."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "version": "1.0.0",
                "error": str(exc),
            },
        )

    return {
        "status": "healthy",
        "database": db_status,
        "version": "1.0.0",
    }


@app.get("/api/catalogue", response_model=List[FoodCatalogueResponse], tags=["Catalogue"])
def get_all_catalogue_items(db: Session = Depends(get_db)):
    """Return all predefined food catalogue items."""
    return db.query(FoodCatalogue).order_by(FoodCatalogue.id).all()


@app.get("/api/catalogue/{item_id}", response_model=FoodCatalogueResponse, tags=["Catalogue"])
def get_catalogue_item(item_id: int, db: Session = Depends(get_db)):
    """Return a single food catalogue item by its primary key ID, or 404 if not found."""
    item = db.query(FoodCatalogue).filter(FoodCatalogue.id == item_id).first()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food catalogue item with ID {item_id} not found",
        )
    return item


# ==============================================================================
# Unified Single-Service SPA Serving (Frontend React dist)
# Only mounted when frontend/dist exists (production build or built locally)
# ==============================================================================
frontend_dist_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if frontend_dist_dir.is_dir():
    # 1. Mount static assets folder (Vite outputs js, css into dist/assets)
    assets_dir = frontend_dist_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")

    # 2. Root route: serve frontend SPA index.html
    @app.get("/", include_in_schema=False)
    def serve_frontend_root():
        index_file = frontend_dist_dir / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend index.html not found")

    # 3. Catch-all client-side route fallback for React Router SPA (e.g. /inventory, /checker, /alerts)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend_spa(full_path: str):
        # Exclude backend API, documentation and health routes so they never get captured by the SPA fallback
        normalized = full_path.strip("/")
        if (
            normalized.startswith("api")
            or normalized.startswith("docs")
            or normalized.startswith("redoc")
            or normalized == "openapi.json"
            or normalized == "health"
        ):
            raise HTTPException(status_code=404, detail="Not Found")

        # If a requested static file exists directly in dist/ (e.g. favicon.svg, robots.txt, etc.)
        requested_file = frontend_dist_dir / full_path
        if requested_file.is_file():
            return FileResponse(requested_file)

        # Fallback to index.html for React Router client routes
        index_file = frontend_dist_dir / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)

        raise HTTPException(status_code=404, detail="Not Found")
