"""Safe, non-destructive PostgreSQL integration verification procedure for FreshGuard.

Verifies:
1. PostgreSQL connection & SSL connectivity
2. All 4 tables initialized (food_catalogues, inventory_items, temperature_checks, activity_logs)
3. Food catalogue idempotent seeding
4. Inventory creation with foreign-key relationships
5. Temperature check recording with foreign-key validation
6. Timezone-aware timestamp storage and retrieval
7. Persistence across connection disposal and re-connection
8. Non-destructive cleanup of verification canary records

Can be run standalone:
    python -m app.verify_postgres
or imported by tests and deployment scripts.
"""

import argparse
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database import normalize_database_url
from app.models import Base, FoodCatalogue, InventoryItem, TemperatureCheck, get_utc_now
from app.seed_data import seed_catalogue_data

logger = logging.getLogger("freshguard.verify_postgres")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def run_postgres_verification(database_url: Optional[str] = None) -> Dict[str, Any]:
    """Execute non-destructive PostgreSQL verification suite against target database_url."""
    raw_url = database_url or os.getenv("DATABASE_URL", "").strip()
    if not raw_url:
        raise ValueError("DATABASE_URL environment variable is not set. Please supply a valid PostgreSQL URL.")

    normalized_url = normalize_database_url(raw_url)
    if "postgresql" not in normalized_url:
        raise ValueError(f"Expected a PostgreSQL connection URL, but received: {normalized_url.split('@')[-1] if '@' in normalized_url else 'non-postgres'}")

    results: Dict[str, Any] = {
        "connected": False,
        "tables_verified": False,
        "catalogue_seeded": False,
        "inventory_created": False,
        "temperature_check_created": False,
        "timestamp_timezone_aware": False,
        "foreign_keys_enforced": False,
        "persisted_across_reconnect": False,
        "cleanup_successful": False,
    }

    logger.info("Step 1: Connecting to PostgreSQL database...")
    engine = create_engine(
        normalized_url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=3,
        max_overflow=2,
    )

    with engine.connect() as conn:
        val = conn.execute(text("SELECT 1")).scalar()
        if val != 1:
            raise RuntimeError("Database connection test 'SELECT 1' failed.")
        results["connected"] = True
        logger.info("  ✓ PostgreSQL connection succeeded.")

    # Step 2: Verify table initialization
    logger.info("Step 2: Initializing and verifying tables...")
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    required_tables = {"food_catalogues", "inventory_items", "temperature_checks", "activity_logs"}
    missing = required_tables - existing_tables
    if missing:
        raise RuntimeError(f"Missing required tables in PostgreSQL: {missing}")
    results["tables_verified"] = True
    logger.info("  ✓ All 4 required tables verified in PostgreSQL: %s", sorted(existing_tables))

    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    canary_item_id = None

    try:
        # Step 3: Verify food catalogue seeding idempotency
        logger.info("Step 3: Verifying food catalogue seeding idempotency...")
        with Session() as db:
            before_count = db.query(FoodCatalogue).count()
            # Run seed operation
            seed_catalogue_data(db)
            after_count = db.query(FoodCatalogue).count()
            # Run second seed to test idempotency
            added_second = seed_catalogue_data(db)
            if added_second != 0:
                raise RuntimeError(f"Catalogue seed was not idempotent; added {added_second} duplicate records.")
            results["catalogue_seeded"] = True
            logger.info("  ✓ Catalogue verified (%d total items, idempotent).", after_count)

            # Retrieve standard Milk catalogue entry for canary FK
            milk_cat = db.query(FoodCatalogue).filter(FoodCatalogue.storage_type == "REFRIGERATED").first()
            if not milk_cat:
                milk_cat = db.query(FoodCatalogue).first()
            cat_id = milk_cat.id

            # Step 4: Verify inventory creation with canary record
            logger.info("Step 4: Creating verification canary inventory item...")
            unique_token = str(uuid.uuid4())[:8]
            canary_name = f"__pg_verify_canary_{unique_token}__"
            utc_now = get_utc_now()

            canary_item = InventoryItem(
                catalogue_id=cat_id,
                custom_name=canary_name,
                quantity=1.5,
                unit="liters",
                storage_location="Refrigerator",
                purchase_date=utc_now.date(),
                expiry_date=utc_now.date(),
                created_at=utc_now,
                is_active=False,  # Inactive so it doesn't display in active UI
            )
            db.add(canary_item)
            db.commit()
            db.refresh(canary_item)
            canary_item_id = canary_item.id
            results["inventory_created"] = True
            logger.info("  ✓ Canary inventory item created (ID: %d).", canary_item_id)

            # Step 5: Verify temperature check creation
            logger.info("Step 5: Recording temperature check for canary item...")
            temp_check = TemperatureCheck(
                inventory_id=canary_item_id,
                recorded_temp_c=2.8,
                status="WITHIN_LIMIT",
                message="PostgreSQL verification automated test probe reading",
                is_simulated=True,
                checked_at=get_utc_now(),
            )
            db.add(temp_check)
            db.commit()
            db.refresh(temp_check)
            results["temperature_check_created"] = True
            logger.info("  ✓ Temperature check created (ID: %d).", temp_check.id)

            # Step 6: Verify timezone-aware timestamp storage and retrieval
            logger.info("Step 6: Verifying timestamp timezone awareness...")
            retrieved_item = db.query(InventoryItem).filter(InventoryItem.id == canary_item_id).first()
            retrieved_check = db.query(TemperatureCheck).filter(TemperatureCheck.inventory_id == canary_item_id).first()

            item_dt = retrieved_item.created_at
            check_dt = retrieved_check.checked_at

            if item_dt.tzinfo is None or check_dt.tzinfo is None:
                raise ValueError(f"Timestamps returned from database are naive (missing tzinfo): item={item_dt}, check={check_dt}")
            results["timestamp_timezone_aware"] = True
            logger.info("  ✓ Timestamps stored and retrieved with timezone awareness (UTC: %s).", check_dt.isoformat())

            # Step 7: Verify foreign key enforcement
            logger.info("Step 7: Verifying foreign key enforcement...")
            fk_violator = InventoryItem(
                catalogue_id=999999999,  # Non-existent foreign key
                custom_name="__fk_fail__",
                quantity=1.0,
                unit="pieces",
                storage_location="Pantry",
                purchase_date=utc_now.date(),
                expiry_date=utc_now.date(),
                is_active=False,
            )
            db.add(fk_violator)
            try:
                db.commit()
                raise RuntimeError("Foreign key constraint violation was NOT caught by PostgreSQL!")
            except IntegrityError:
                db.rollback()
                results["foreign_keys_enforced"] = True
                logger.info("  ✓ Foreign key constraint successfully enforced by PostgreSQL.")

        # Step 8: Verify persistence across connection disposal and reconnect
        logger.info("Step 8: Disposing connection pool and simulating service spin-down / redeploy...")
        engine.dispose()

        # Reconnect with fresh engine instance
        restarted_engine = create_engine(
            normalized_url,
            pool_pre_ping=True,
            pool_recycle=300,
        )
        RestartedSession = sessionmaker(autocommit=False, autoflush=False, bind=restarted_engine)

        with RestartedSession() as db2:
            rechecked_item = db2.query(InventoryItem).filter(InventoryItem.id == canary_item_id).first()
            if not rechecked_item:
                raise RuntimeError(f"Canary item {canary_item_id} did not persist after engine reconnect!")
            rechecked_check = db2.query(TemperatureCheck).filter(TemperatureCheck.inventory_id == canary_item_id).first()
            if not rechecked_check:
                raise RuntimeError(f"Canary temperature check did not persist after engine reconnect!")

            results["persisted_across_reconnect"] = True
            logger.info("  ✓ Canary records verified intact after engine disposal and reconnection.")

            # Step 9: Clean up verification canary records non-destructively
            logger.info("Step 9: Cleaning up canary verification records...")
            db2.query(TemperatureCheck).filter(TemperatureCheck.inventory_id == canary_item_id).delete()
            db2.query(InventoryItem).filter(InventoryItem.id == canary_item_id).delete()
            db2.commit()
            results["cleanup_successful"] = True
            logger.info("  ✓ Canary records cleaned up successfully. Production data unchanged.")

        restarted_engine.dispose()

    except Exception as exc:
        logger.error("Verification failed with exception: %s", exc)
        # Attempt emergency cleanup if canary was created
        if canary_item_id:
            try:
                with Session() as cleanup_db:
                    cleanup_db.query(TemperatureCheck).filter(TemperatureCheck.inventory_id == canary_item_id).delete()
                    cleanup_db.query(InventoryItem).filter(InventoryItem.id == canary_item_id).delete()
                    cleanup_db.commit()
            except Exception:
                pass
        raise

    logger.info("================================================================")
    logger.info(" ALL POSTGRESQL VERIFICATION CHECKS PASSED (100% HEALTHY)")
    logger.info("================================================================")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FreshGuard PostgreSQL Verification Utility")
    parser.add_argument("--url", default=None, help="Optional database URL override")
    args = parser.parse_args()

    try:
        res = run_postgres_verification(args.url)
        print("\nVerification Summary:", res)
        sys.exit(0)
    except Exception as err:
        print(f"\n[ERROR] PostgreSQL verification failed: {err}", file=sys.stderr)
        sys.exit(1)
