"""Database migration and data preservation utility for FreshGuard.

Supports exporting records from local SQLite and migrating them idempotently
and resumably into a target PostgreSQL (Neon) database while preserving primary keys,
foreign key relationships, and synchronizing PostgreSQL sequences.
"""

import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import (
    DEFAULT_SQLITE_PATH,
    SessionLocal,
    engine,
    init_db,
    normalize_database_url,
)
from app.models import ActivityLog, FoodCatalogue, InventoryItem, TemperatureCheck
from app.seed_data import seed_catalogue_data

logger = logging.getLogger("freshguard.migrate")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def parse_datetime(val: Any) -> Optional[datetime]:
    """Parse string or timestamp into timezone-aware datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(val))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def parse_date(val: Any) -> Optional[Any]:
    """Parse string into date object."""
    if val is None:
        return None
    if hasattr(val, "strftime"):
        return val
    try:
        return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def export_sqlite_records(sqlite_path: Optional[Path] = None) -> Dict[str, List[Dict[str, Any]]]:
    """Export all records from existing SQLite storage.db or fallback to initial_data.json."""
    path = sqlite_path or DEFAULT_SQLITE_PATH
    if path.exists():
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        data: Dict[str, List[Dict[str, Any]]] = {}
        for table_name in ["food_catalogues", "inventory_items", "temperature_checks", "activity_logs"]:
            try:
                cursor.execute(f"SELECT * FROM {table_name}")
                data[table_name] = [dict(row) for row in cursor.fetchall()]
                logger.info("Exported %d records from SQLite table '%s'", len(data[table_name]), table_name)
            except sqlite3.OperationalError:
                data[table_name] = []

        conn.close()
        return data

    # Fallback to initial_data.json if present
    initial_json = Path(__file__).resolve().parent / "initial_data.json"
    if initial_json.exists():
        import json
        with open(initial_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            logger.info(
                "Loaded preserved records from initial_data.json: %s",
                {k: len(v) for k, v in data.items() if isinstance(v, list)},
            )
            return data

    logger.info("No SQLite database or initial_data.json found to export.")
    return {"food_catalogues": [], "inventory_items": [], "temperature_checks": [], "activity_logs": []}


def sync_postgres_sequences(db: Session) -> None:
    """Synchronize PostgreSQL auto-increment sequences after inserting explicit IDs."""
    if db.bind.dialect.name != "postgresql":
        return

    tables = ["food_catalogues", "inventory_items", "temperature_checks", "activity_logs"]
    for table in tables:
        try:
            # Query the max ID in the table and synchronize the sequence
            query = text(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table}), 1), "
                f"(SELECT MAX(id) FROM {table}) IS NOT NULL);"
            )
            db.execute(query)
            db.commit()
            logger.info("Synchronized PostgreSQL sequence for table '%s'", table)
        except Exception as exc:
            db.rollback()
            logger.warning("Could not sync sequence for table '%s': %s", table, exc)


def migrate_records_to_db(
    records: Dict[str, List[Dict[str, Any]]],
    db: Session,
) -> Dict[str, int]:
    """Migrate exported records idempotently and resumably into the current database session."""
    stats = {
        "catalogues_added": 0,
        "inventory_added": 0,
        "checks_added": 0,
        "logs_added": 0,
        "conflicts_detected": 0,
    }

    # 1. First ensure standard catalogue seed is executed
    seed_count = seed_catalogue_data(db)
    logger.info("Catalogue baseline seed added %d items.", seed_count)

    # 2. Check and migrate food catalogues
    existing_cat_names = {cat.name: cat.id for cat in db.query(FoodCatalogue).all()}
    cat_id_mapping = {cat.id: cat.id for cat in db.query(FoodCatalogue).all()}

    for item in records.get("food_catalogues", []):
        name = item["name"]
        if name not in existing_cat_names:
            new_cat = FoodCatalogue(
                name=item["name"],
                category=item["category"],
                storage_type=item["storage_type"],
                max_temp_c=item.get("max_temp_c"),
                default_location=item["default_location"],
                storage_guidance=item["storage_guidance"],
                reference_title=item["reference_title"],
                reference_url=item["reference_url"],
            )
            db.add(new_cat)
            db.flush()
            cat_id_mapping[item["id"]] = new_cat.id
            existing_cat_names[name] = new_cat.id
            stats["catalogues_added"] += 1
        else:
            cat_id_mapping[item["id"]] = existing_cat_names[name]

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to commit food catalogues during migration: %s", exc)
        raise

    # 3. Migrate inventory items with safe conflict detection
    existing_inv_items = {inv.id: inv for inv in db.query(InventoryItem).all()}
    conflicting_inv_ids = set()

    for inv in records.get("inventory_items", []):
        old_id = inv.get("id")
        if old_id is None:
            continue

        target_cat_id = cat_id_mapping.get(inv["catalogue_id"], inv["catalogue_id"])

        if old_id not in existing_inv_items:
            item = InventoryItem(
                id=old_id,
                catalogue_id=target_cat_id,
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
            stats["inventory_added"] += 1
        else:
            # Item already exists: verify whether it is an identical preserved record or a conflicting live record
            existing_item = existing_inv_items[old_id]
            if (
                existing_item.custom_name != inv.get("custom_name")
                or existing_item.catalogue_id != target_cat_id
            ):
                conflicting_inv_ids.add(old_id)
                stats["conflicts_detected"] += 1
                logger.warning(
                    "ID conflict detected on InventoryItem ID %d: live database record ('%s', cat_id=%d) "
                    "differs from backup record ('%s', cat_id=%d). "
                    "Preserving live database record and skipping backup overwrite.",
                    old_id,
                    existing_item.custom_name,
                    existing_item.catalogue_id,
                    inv.get("custom_name"),
                    target_cat_id,
                )
            else:
                logger.debug("InventoryItem ID %d already preserved in target database.", old_id)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to commit inventory items during migration: %s", exc)
        raise

    # 4. Migrate temperature checks (safely associating only with valid, non-conflicting parent items)
    existing_check_ids = {tc.id for tc in db.query(TemperatureCheck.id).all()}
    current_inv_ids = {inv.id for inv in db.query(InventoryItem.id).all()}

    for tc in records.get("temperature_checks", []):
        check_id = tc.get("id")
        if check_id is None or check_id in existing_check_ids:
            continue

        parent_inv_id = tc.get("inventory_id")
        if parent_inv_id in conflicting_inv_ids:
            stats["conflicts_detected"] += 1
            logger.warning(
                "Skipping backup temperature check ID %d because parent inventory item ID %d "
                "is a conflicting live record.",
                check_id,
                parent_inv_id,
            )
            continue

        if parent_inv_id in current_inv_ids:
            check = TemperatureCheck(
                id=check_id,
                inventory_id=parent_inv_id,
                recorded_temp_c=float(tc["recorded_temp_c"]),
                status=tc["status"],
                message=tc["message"],
                is_simulated=bool(tc.get("is_simulated", 0)),
                checked_at=parse_datetime(tc.get("checked_at")),
            )
            db.add(check)
            stats["checks_added"] += 1

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to commit temperature checks during migration: %s", exc)
        raise

    # 5. Migrate activity logs
    existing_log_ids = {log.id for log in db.query(ActivityLog.id).all()}
    for log in records.get("activity_logs", []):
        log_id = log.get("id")
        if log_id is not None and log_id not in existing_log_ids:
            activity = ActivityLog(
                id=log_id,
                action_type=log["action_type"],
                description=log["description"],
                created_at=parse_datetime(log.get("created_at")),
            )
            db.add(activity)
            stats["logs_added"] += 1

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to commit activity logs during migration: %s", exc)
        raise

    # 6. Synchronize sequences if target is PostgreSQL
    sync_postgres_sequences(db)

    logger.info("Migration complete: %s", stats)
    return stats


def auto_preserve_and_migrate(db: Session, sqlite_path: Optional[Path] = None) -> Optional[Dict[str, int]]:
    """Automatically preserve and migrate SQLite records idempotently and resumably.

    Ensures that any missing catalogue entries, inventory items, temperature checks,
    and activity logs from the source backup are safely imported, even if a previous
    migration run was interrupted or only partially completed. Existing user data and
    soft-deleted items are never overwritten or duplicated.
    """
    records = export_sqlite_records(sqlite_path)
    if not records or not any(records.values()):
        logger.info("No records found to migrate.")
        return None

    # Inspect current database IDs to determine what is already present
    existing_cat_names = {cat.name for cat in db.query(FoodCatalogue.name).all()}
    existing_inv_ids = {inv.id for inv in db.query(InventoryItem.id).all()}
    existing_check_ids = {tc.id for tc in db.query(TemperatureCheck.id).all()}
    existing_log_ids = {log.id for log in db.query(ActivityLog.id).all()}

    missing_cats = [c for c in records.get("food_catalogues", []) if c.get("name") not in existing_cat_names]
    missing_inv = [inv for inv in records.get("inventory_items", []) if inv.get("id") not in existing_inv_ids]
    missing_checks = [tc for tc in records.get("temperature_checks", []) if tc.get("id") not in existing_check_ids]
    missing_logs = [log for log in records.get("activity_logs", []) if log.get("id") not in existing_log_ids]

    if not missing_cats and not missing_inv and not missing_checks and not missing_logs:
        logger.info(
            "Target database already contains all backup records (%d inv, %d checks, %d logs). Skipping auto-migration.",
            len(existing_inv_ids),
            len(existing_check_ids),
            len(existing_log_ids),
        )
        return {
            "catalogues_added": 0,
            "inventory_added": 0,
            "checks_added": 0,
            "logs_added": 0,
            "conflicts_detected": 0,
        }

    logger.info(
        "Pending migration detected: %d catalogues, %d inventory items, %d temperature checks, %d activity logs missing. Resuming migration...",
        len(missing_cats),
        len(missing_inv),
        len(missing_checks),
        len(missing_logs),
    )
    return migrate_records_to_db(records, db)


if __name__ == "__main__":
    init_db()
    with SessionLocal() as session:
        auto_preserve_and_migrate(session)
