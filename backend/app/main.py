from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db, init_db
from app.models import FoodCatalogue
from app.routers import dashboard, inventory, temperature
from app.schemas import FoodCatalogueResponse, HealthResponse
from app.seed_data import seed_catalogue_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager that initializes tables and seeds catalogue data."""
    # Create tables automatically on startup
    init_db()
    # Seed food catalogue idempotently
    with SessionLocal() as db:
        seed_catalogue_data(db)
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
