"""Tests for database migration, URL normalization, and PostgreSQL/SQLite compatibility."""

import os
from datetime import datetime, timezone
from unittest.mock import patch
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.database import (
    DEFAULT_SQLITE_URL,
    normalize_database_url,
    init_db,
    SessionLocal,
    Base,
    get_db,
)
from app.models import ActivityLog, FoodCatalogue, InventoryItem, TemperatureCheck
from app.seed_data import seed_catalogue_data
from app.migrate import export_sqlite_records, migrate_records_to_db


def test_normalize_database_url_empty():
    assert normalize_database_url("") == ""
    assert normalize_database_url(None) is None


def test_normalize_database_url_postgres_scheme():
    raw = "postgres://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb"
    normalized = normalize_database_url(raw)
    assert normalized.startswith("postgresql+psycopg://")
    assert "sslmode=require" in normalized


def test_normalize_database_url_postgresql_scheme():
    raw = "postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb"
    normalized = normalize_database_url(raw)
    assert normalized.startswith("postgresql+psycopg://")
    assert "sslmode=require" in normalized


def test_normalize_database_url_preserves_existing_sslmode():
    raw = "postgresql+psycopg://user:password@host/db?sslmode=require&channel_binding=require"
    normalized = normalize_database_url(raw)
    assert normalized == raw


def test_all_four_tables_present_in_metadata():
    tables = Base.metadata.tables.keys()
    assert "food_catalogues" in tables
    assert "inventory_items" in tables
    assert "temperature_checks" in tables
    assert "activity_logs" in tables


def test_catalogue_seed_is_idempotent():
    with SessionLocal() as db:
        initial_count = db.query(FoodCatalogue).count()
        assert initial_count >= 10

        # Run seed a second time
        added = seed_catalogue_data(db)
        assert added == 0

        final_count = db.query(FoodCatalogue).count()
        assert final_count == initial_count


def test_export_and_idempotent_migration():
    # Test exporting existing records
    records = export_sqlite_records()
    assert "food_catalogues" in records
    assert "inventory_items" in records
    assert "temperature_checks" in records
    assert "activity_logs" in records

    # Run migration on current database; items already present should not duplicate
    with SessionLocal() as db:
        stats = migrate_records_to_db(records, db)
        assert stats["catalogues_added"] == 0  # No duplicate catalogue items


def test_database_url_environment_fallback():
    # Ensure default URL is SQLite when DATABASE_URL is not set
    assert "sqlite" in DEFAULT_SQLITE_URL


def test_persistence_across_restart(tmp_path):
    """Simulate service restart/redeployment by closing sessions, re-instantiating engine,
    and verifying created food items and temperature checks persist."""
    test_db_path = tmp_path / "persistence_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # 1. Session 1: Seed catalogue and create inventory item
    with TestSession() as db1:
        seed_catalogue_data(db1)
        item = InventoryItem(
            catalogue_id=1,
            custom_name="Persistent Oat Milk",
            quantity=2.0,
            unit="liters",
            storage_location="Refrigerator",
            purchase_date=datetime.now(timezone.utc).date(),
            expiry_date=datetime.now(timezone.utc).date(),
            is_active=True,
        )
        db1.add(item)
        db1.commit()
        db1.refresh(item)
        item_id = item.id

        # Add temperature check
        check = TemperatureCheck(
            inventory_id=item_id,
            recorded_temp_c=3.2,
            status="WITHIN_LIMIT",
            message="Within safe limit",
            is_simulated=False,
            checked_at=datetime.now(timezone.utc),
        )
        db1.add(check)
        db1.commit()

    # 2. Simulate complete restart / spin-down: Dispose engine and close all connections
    test_engine.dispose()

    # 3. Simulate service start up / restart: Connect again with new engine instance
    restarted_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    RestartedSession = sessionmaker(autocommit=False, autoflush=False, bind=restarted_engine)

    with RestartedSession() as db2:
        # Verify catalogue seed is idempotent on restart
        added = seed_catalogue_data(db2)
        assert added == 0

        # Verify created food item persists
        saved_item = db2.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        assert saved_item is not None
        assert saved_item.custom_name == "Persistent Oat Milk"
        assert saved_item.quantity == 2.0

        # Verify temperature history check persists
        saved_checks = db2.query(TemperatureCheck).filter(TemperatureCheck.inventory_id == item_id).all()
        assert len(saved_checks) == 1
        assert saved_checks[0].recorded_temp_c == 3.2

    restarted_engine.dispose()

