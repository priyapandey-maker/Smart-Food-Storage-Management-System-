import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# Anchor default local SQLite database file path to the backend directory
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = BASE_DIR / "storage.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


def normalize_database_url(raw_url: str) -> str:
    """Normalize raw database connection URL for SQLAlchemy and psycopg3 compatibility.

    - Converts 'postgres://' or 'postgresql://' to 'postgresql+psycopg://'
    - Ensures 'sslmode=require' is present for remote PostgreSQL (Neon) connections
    """
    if not raw_url:
        return raw_url
    url = raw_url.strip()

    # Render and Heroku frequently provide postgres:// or postgresql://
    # SQLAlchemy with psycopg 3 requires the postgresql+psycopg:// dialect
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)

    # Ensure sslmode=require for PostgreSQL connections (Neon requirement)
    if "postgresql" in url and "sslmode" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"

    return url


# Read DATABASE_URL from environment; default to SQLite when absent or empty
RAW_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if RAW_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = normalize_database_url(RAW_DATABASE_URL)
    IS_POSTGRES = "postgresql" in SQLALCHEMY_DATABASE_URL

    if IS_POSTGRES:
        # Optimized configuration for Neon PostgreSQL pooled connections
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,  # Actively check connection liveness before checkout
            pool_recycle=300,  # Recycle idle pooled connections every 5 minutes
            pool_size=5,  # Friendly for Neon Free tier connection limits
            max_overflow=10,
        )
    else:
        # Custom non-Postgres URL fallback
        engine = create_engine(
            SQLALCHEMY_DATABASE_URL,
            pool_pre_ping=True,
        )
else:
    # Default local development configuration: SQLite
    SQLALCHEMY_DATABASE_URL = DEFAULT_SQLITE_URL
    IS_POSTGRES = False
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )


# Enable SQLite foreign key constraint enforcement only when using SQLite dialect
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Reusable FastAPI database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all database tables defined in models."""
    from app import models  # noqa: F401 - ensure models are registered
    Base.metadata.create_all(bind=engine)


