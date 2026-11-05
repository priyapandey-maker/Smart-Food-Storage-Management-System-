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
from app.migrate import (
    auto_preserve_and_migrate,
    export_sqlite_records,
    migrate_records_to_db,
    parse_date,
    parse_datetime,
)


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


def test_normalize_database_url_psycopg2_scheme():
    raw = "postgresql+psycopg2://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb"
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


def test_models_use_timezone_aware_datetime():
    """Verify models define DateTime(timezone=True) for PostgreSQL compatibility."""
    assert InventoryItem.created_at.type.timezone is True
    assert TemperatureCheck.checked_at.type.timezone is True
    assert ActivityLog.created_at.type.timezone is True


def test_timestamp_storage_and_retrieval_timezone():
    """Verify timezone-aware datetimes store and retrieve properly."""
    with SessionLocal() as db:
        utc_now = datetime.now(timezone.utc)
        item = InventoryItem(
            catalogue_id=1,
            custom_name="Timezone Test Item",
            quantity=1.0,
            unit="pieces",
            storage_location="Refrigerator",
            purchase_date=utc_now.date(),
            expiry_date=utc_now.date(),
            created_at=utc_now,
            is_active=False,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        saved_id = item.id

        try:
            fetched = db.query(InventoryItem).filter(InventoryItem.id == saved_id).first()
            assert fetched is not None
            assert fetched.created_at is not None
        finally:
            db.query(InventoryItem).filter(InventoryItem.id == saved_id).delete()
            db.commit()


def test_resumable_partial_migration_simulated_crash(tmp_path):
    """Simulate a crash during migration after inventory records are committed
    but before temperature checks and activity logs are imported.
    Verify subsequent startup resumes migration without duplicating items or
    overwriting existing user data / soft-deleted records."""
    test_db_path = tmp_path / "partial_migration_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    records = export_sqlite_records()
    backup_inventory = records.get("inventory_items", [])
    backup_checks = records.get("temperature_checks", [])
    backup_logs = records.get("activity_logs", [])

    assert len(backup_inventory) > 0, "Expected backup inventory items"
    assert len(backup_checks) > 0, "Expected backup temperature checks"
    assert len(backup_logs) > 0, "Expected backup activity logs"

    # 1. Simulate the partial state: Seed catalogues + insert ONLY inventory items
    with TestSession() as db:
        seed_catalogue_data(db)

        # Insert backup inventory items
        for inv in backup_inventory:
            item = InventoryItem(
                id=inv["id"],
                catalogue_id=inv["catalogue_id"],
                custom_name=inv.get("custom_name"),
                quantity=float(inv["quantity"]),
                unit=inv["unit"],
                storage_location=inv["storage_location"],
                purchase_date=parse_date(inv["purchase_date"]),
                expiry_date=parse_date(inv.get("expiry_date")),
                created_at=parse_datetime(inv.get("created_at")),
                is_active=bool(inv.get("is_active", 1)),
            )
            db.add(item)
        db.commit()

        # Simulate user soft-deleting item 2 (if present)
        item_2 = db.query(InventoryItem).filter(InventoryItem.id == 2).first()
        if item_2:
            item_2.is_active = False
            db.commit()

        # Simulate user adding their own new inventory item (ID 999)
        user_item = InventoryItem(
            id=999,
            catalogue_id=1,
            custom_name="User Organic Kombucha",
            quantity=2.0,
            unit="bottles",
            storage_location="Refrigerator",
            purchase_date=datetime.now(timezone.utc).date(),
            expiry_date=datetime.now(timezone.utc).date(),
            is_active=True,
        )
        db.add(user_item)
        db.commit()

        # Verify state BEFORE resuming: inventory exists, but 0 checks and 0 logs!
        assert db.query(InventoryItem).count() >= 2
        assert db.query(TemperatureCheck).count() == 0
        assert db.query(ActivityLog).count() == 0

    # 2. Simulate application startup after crash: run auto_preserve_and_migrate
    with TestSession() as db:
        res = auto_preserve_and_migrate(db)
        assert res is not None

        # Inventory was already imported: 0 added, no duplicates!
        assert res["inventory_added"] == 0
        # Missing temperature checks and activity logs were completed!
        assert res["checks_added"] == len(backup_checks)
        assert res["logs_added"] == len(backup_logs)

        # Verify user data is preserved
        user_saved = db.query(InventoryItem).filter(InventoryItem.id == 999).first()
        assert user_saved is not None
        assert user_saved.custom_name == "User Organic Kombucha"

        # Verify soft-deleted item remains soft-deleted (not overwritten)
        if item_2:
            refreshed_2 = db.query(InventoryItem).filter(InventoryItem.id == 2).first()
            assert refreshed_2 is not None
            assert refreshed_2.is_active is False

        # Verify total counts
        assert db.query(InventoryItem).count() == len(backup_inventory) + 1  # backup items + user item
        assert db.query(TemperatureCheck).count() == len(backup_checks)
        assert db.query(ActivityLog).count() == len(backup_logs)

    # 3. Simulate another restart: auto_preserve_and_migrate must be completely idempotent
    with TestSession() as db:
        res2 = auto_preserve_and_migrate(db)
        assert res2["catalogues_added"] == 0
        assert res2["inventory_added"] == 0
        assert res2["checks_added"] == 0
        assert res2["logs_added"] == 0

        # Counts remain unchanged
        assert db.query(InventoryItem).count() == len(backup_inventory) + 1
        assert db.query(TemperatureCheck).count() == len(backup_checks)
        assert db.query(ActivityLog).count() == len(backup_logs)

    test_engine.dispose()


def test_resumable_partial_inventory_and_history(tmp_path):
    """Simulate a crash when only SOME inventory items were inserted, leaving remaining
    inventory items, temperature checks, and activity logs pending."""
    test_db_path = tmp_path / "partial_inv_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    records = export_sqlite_records()
    backup_inventory = records.get("inventory_items", [])
    backup_checks = records.get("temperature_checks", [])
    backup_logs = records.get("activity_logs", [])

    if len(backup_inventory) < 2:
        pytest.skip("Test requires at least 2 backup inventory items to simulate partial inventory")

    # 1. Insert ONLY the first inventory item (ID 1)
    first_item_data = backup_inventory[0]
    with TestSession() as db:
        seed_catalogue_data(db)
        first_item = InventoryItem(
            id=first_item_data["id"],
            catalogue_id=first_item_data["catalogue_id"],
            custom_name=first_item_data.get("custom_name"),
            quantity=float(first_item_data["quantity"]),
            unit=first_item_data["unit"],
            storage_location=first_item_data["storage_location"],
            purchase_date=parse_date(first_item_data["purchase_date"]),
            expiry_date=parse_date(first_item_data.get("expiry_date")),
            created_at=parse_datetime(first_item_data.get("created_at")),
            is_active=bool(first_item_data.get("is_active", 1)),
        )
        db.add(first_item)
        db.commit()

        assert db.query(InventoryItem).count() == 1
        assert db.query(TemperatureCheck).count() == 0
        assert db.query(ActivityLog).count() == 0

    # 2. Resume migration on next startup
    with TestSession() as db:
        res = auto_preserve_and_migrate(db)
        assert res is not None

        # The missing inventory item(s) were imported!
        expected_missing_inv = len(backup_inventory) - 1
        assert res["inventory_added"] == expected_missing_inv
        assert res["checks_added"] == len(backup_checks)
        assert res["logs_added"] == len(backup_logs)

        assert db.query(InventoryItem).count() == len(backup_inventory)
        assert db.query(TemperatureCheck).count() == len(backup_checks)
        assert db.query(ActivityLog).count() == len(backup_logs)

    # 3. Subsequent run does nothing
    with TestSession() as db:
        res2 = auto_preserve_and_migrate(db)
        assert res2["inventory_added"] == 0
        assert res2["checks_added"] == 0
        assert res2["logs_added"] == 0

    test_engine.dispose()


def test_fresh_database_full_migration(tmp_path):
    """Scenario 1: Fresh database migration from empty state.
    Verifies full migration of catalogues, inventory, checks, and logs,
    and verifies that a second run adds 0 duplicates."""
    test_db_path = tmp_path / "fresh_migration_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    records = export_sqlite_records()
    backup_inventory = records.get("inventory_items", [])
    backup_checks = records.get("temperature_checks", [])
    backup_logs = records.get("activity_logs", [])

    # 1. Run migration on fresh empty database
    with TestSession() as db:
        res = auto_preserve_and_migrate(db)
        assert res is not None
        assert res["inventory_added"] == len(backup_inventory)
        assert res["checks_added"] == len(backup_checks)
        assert res["logs_added"] == len(backup_logs)
        assert res["conflicts_detected"] == 0

        # Verify all tables have records
        assert db.query(FoodCatalogue).count() >= 10
        assert db.query(InventoryItem).count() == len(backup_inventory)
        assert db.query(TemperatureCheck).count() == len(backup_checks)
        assert db.query(ActivityLog).count() == len(backup_logs)

    # 2. Run migration a second time: must add zero records
    with TestSession() as db:
        res2 = auto_preserve_and_migrate(db)
        assert res2["catalogues_added"] == 0
        assert res2["inventory_added"] == 0
        assert res2["checks_added"] == 0
        assert res2["logs_added"] == 0
        assert res2["conflicts_detected"] == 0

    test_engine.dispose()


def test_handling_conflicting_ids_safely(tmp_path):
    """Scenario 9: Handle conflicting IDs safely.
    When a live database record exists with an ID matching a backup item but with divergent data,
    the live record must be preserved and not overwritten, a conflict must be reported,
    and non-conflicting backup records must still be imported."""
    test_db_path = tmp_path / "conflict_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    records = export_sqlite_records()
    backup_inventory = records.get("inventory_items", [])
    if len(backup_inventory) < 2:
        pytest.skip("Test requires at least 2 backup inventory items to test conflict handling")

    conflict_id = backup_inventory[0]["id"]

    # 1. Pre-insert a live user item with conflict_id but DIFFERENT data
    with TestSession() as db:
        seed_catalogue_data(db)
        live_user_item = InventoryItem(
            id=conflict_id,
            catalogue_id=1,
            custom_name="Live User Ribeye Steak",
            quantity=5.0,
            unit="kg",
            storage_location="Freezer",
            purchase_date=datetime.now(timezone.utc).date(),
            expiry_date=datetime.now(timezone.utc).date(),
            created_at=datetime.now(timezone.utc),
            is_active=True,
        )
        db.add(live_user_item)
        db.commit()

        assert db.query(InventoryItem).count() == 1

    # 2. Run auto_preserve_and_migrate
    with TestSession() as db:
        res = auto_preserve_and_migrate(db)
        assert res is not None

        # Conflict must be detected and reported
        assert res["conflicts_detected"] >= 1

        # Live user item MUST NOT be overwritten
        retained = db.query(InventoryItem).filter(InventoryItem.id == conflict_id).first()
        assert retained is not None
        assert retained.custom_name == "Live User Ribeye Steak"
        assert retained.quantity == 5.0
        assert retained.storage_location == "Freezer"

        # Non-conflicting backup items MUST be imported
        non_conflict_item = db.query(InventoryItem).filter(InventoryItem.id == backup_inventory[1]["id"]).first()
        assert non_conflict_item is not None
        assert non_conflict_item.custom_name == backup_inventory[1].get("custom_name")

    test_engine.dispose()


def test_foreign_key_relationship_integrity(tmp_path):
    """Scenario 6: Verify all foreign-key relationships remain completely intact
    after migration across inventory items and temperature checks."""
    test_db_path = tmp_path / "fk_integrity_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    with TestSession() as db:
        auto_preserve_and_migrate(db)

        # Verify every InventoryItem points to a valid FoodCatalogue
        items = db.query(InventoryItem).all()
        assert len(items) > 0
        for item in items:
            assert item.catalogue is not None
            assert item.catalogue.id == item.catalogue_id

        # Verify every TemperatureCheck points to a valid InventoryItem
        checks = db.query(TemperatureCheck).all()
        assert len(checks) > 0
        for check in checks:
            assert check.inventory_item is not None
            assert check.inventory_item.id == check.inventory_id

    test_engine.dispose()


def test_sequence_synchronization_helper(tmp_path):
    """Scenario 8: Verify sequence synchronization function executes safely on any dialect."""
    from app.migrate import sync_postgres_sequences

    test_db_path = tmp_path / "seq_sync_test.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    test_engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    with TestSession() as db:
        # Should gracefully return without error when dialect is SQLite
        sync_postgres_sequences(db)

    test_engine.dispose()


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL") or "postgresql" not in os.getenv("DATABASE_URL", ""),
    reason="Live PostgreSQL integration test requires DATABASE_URL with postgresql protocol",
)
def test_live_postgres_verification():
    """Execute full non-destructive live verification when DATABASE_URL points to PostgreSQL."""
    from app.verify_postgres import run_postgres_verification

    res = run_postgres_verification()
    assert res["connected"] is True
    assert res["tables_verified"] is True
    assert res["catalogue_seeded"] is True
    assert res["inventory_created"] is True
    assert res["temperature_check_created"] is True
    assert res["timestamp_timezone_aware"] is True
    assert res["foreign_keys_enforced"] is True
    assert res["persisted_across_reconnect"] is True
    assert res["cleanup_successful"] is True
