import random
from datetime import date, datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models import ActivityLog, FoodCatalogue, InventoryItem, TemperatureCheck, get_utc_now
from app.schemas import (
    FoodCatalogueResponse,
    InventoryItemDetailResponse,
    TemperatureCheckSummary,
)


def compute_days_until_expiry(expiry_date: date, today: Optional[date] = None) -> int:
    """Calculate the number of days until the given expiry date."""
    if today is None:
        today = date.today()
    return (expiry_date - today).days


def compute_expiry_status(days_until_expiry: int) -> str:
    """Compute the expiry status based on days remaining."""
    if days_until_expiry < 0:
        return "EXPIRED"
    elif 0 <= days_until_expiry <= 3:
        return "NEAR_EXPIRY"
    else:
        return "FRESH"


def get_display_name(custom_name: Optional[str], catalogue_name: str) -> str:
    """Return user's custom name if set, otherwise fallback to catalogue food name."""
    if custom_name and custom_name.strip():
        return custom_name.strip()
    return catalogue_name


def evaluate_temperature(
    storage_type: str,
    max_temp_c: Optional[float],
    recorded_temp_c: float,
    storage_guidance: str,
) -> Tuple[str, str]:
    """Evaluate recorded temperature against catalogue food safety rules.

    Returns:
        Tuple of (status, message)
        Statuses: WITHIN_LIMIT, ABOVE_LIMIT, NO_LIMIT
    """
    storage_upper = storage_type.upper()

    # Ambient foods have no numerical safety threshold in MVP
    if storage_upper == "AMBIENT" or max_temp_c is None:
        status = "NO_LIMIT"
        message = (
            f"Ambient item: no numeric temperature limit applies. Store in a cool, dry place. "
            f"Storage guidance: {storage_guidance}"
        )
        return status, message

    # Refrigerated or Frozen foods with a defined maximum threshold
    if recorded_temp_c <= max_temp_c:
        status = "WITHIN_LIMIT"
        message = (
            f"Within recommended maximum temperature limit: Recorded temperature ({recorded_temp_c:.1f}°C) "
            f"is at or below the recommended maximum limit ({max_temp_c:.1f}°C) for {storage_type.lower()} storage. "
            f"Storage guidance: {storage_guidance}"
        )
    else:
        status = "ABOVE_LIMIT"
        message = (
            f"Temperature warning: Recorded temperature ({recorded_temp_c:.1f}°C) exceeds the recommended "
            f"maximum limit of {max_temp_c:.1f}°C for {storage_type.lower()} storage. "
            f"Lower the storage temperature or relocate the food immediately to prevent rapid bacterial growth. "
            f"Storage guidance: {storage_guidance}"
        )

    return status, message


def simulate_temperature(
    storage_type: str,
    max_temp_c: Optional[float],
    mode: str = "random",
) -> float:
    """Generate realistic demo temperature reading rounded to 1 decimal place.

    Modes:
      - 'safe': guaranteed safe reading within threshold
      - 'warning': reading that exceeds threshold
      - 'random': randomly selects safe or warning reading
    """
    mode_clean = mode.strip().lower()
    if mode_clean == "random":
        mode_clean = random.choice(["safe", "warning"])

    storage_upper = storage_type.upper()

    if storage_upper == "REFRIGERATED":
        if mode_clean == "safe":
            return round(random.uniform(1.0, 4.0), 1)
        else:
            return round(random.uniform(5.5, 10.0), 1)

    elif storage_upper == "FROZEN":
        if mode_clean == "safe":
            return round(random.uniform(-22.0, -18.0), 1)
        else:
            return round(random.uniform(-15.0, -5.0), 1)

    else:
        # Ambient pantry food
        return round(random.uniform(18.0, 22.0), 1)


def log_activity(db: Session, action_type: str, description: str) -> ActivityLog:
    """Insert an audit record into the ActivityLog table."""
    log_entry = ActivityLog(
        action_type=action_type,
        description=description,
        created_at=get_utc_now(),
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def build_inventory_item_detail(
    item: InventoryItem,
    latest_check: Optional[TemperatureCheck] = None,
) -> InventoryItemDetailResponse:
    """Construct an InventoryItemDetailResponse from an ORM InventoryItem."""
    display_name = get_display_name(item.custom_name, item.catalogue.name)
    days_left = compute_days_until_expiry(item.expiry_date)
    expiry_status = compute_expiry_status(days_left)

    latest_check_summary = None
    if latest_check is not None:
        latest_check_summary = TemperatureCheckSummary(
            id=latest_check.id,
            recorded_temp_c=latest_check.recorded_temp_c,
            status=latest_check.status,
            message=latest_check.message,
            is_simulated=latest_check.is_simulated,
            checked_at=latest_check.checked_at,
        )

    catalogue_resp = FoodCatalogueResponse.model_validate(item.catalogue)

    return InventoryItemDetailResponse(
        id=item.id,
        catalogue_id=item.catalogue_id,
        custom_name=item.custom_name,
        display_name=display_name,
        quantity=item.quantity,
        unit=item.unit,
        storage_location=item.storage_location,
        purchase_date=item.purchase_date,
        expiry_date=item.expiry_date,
        created_at=item.created_at,
        is_active=item.is_active,
        days_until_expiry=days_left,
        expiry_status=expiry_status,
        catalogue=catalogue_resp,
        latest_temp_check=latest_check_summary,
    )

