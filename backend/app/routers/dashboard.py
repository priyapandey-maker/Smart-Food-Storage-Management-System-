from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ActivityLog, InventoryItem, TemperatureCheck
from app.schemas import (
    ActivityLogResponse,
    AlertsResponse,
    DashboardSummaryResponse,
    ExpiryAlertItem,
    PreservationTipItem,
    TemperatureAlertItem,
)
from app.services import (
    compute_days_until_expiry,
    compute_expiry_status,
    get_display_name,
)

router = APIRouter(prefix="/api", tags=["Dashboard & Alerts"])


@router.get("/dashboard", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Retrieve high-level dashboard metrics and recent activity."""
    active_items = (
        db.query(InventoryItem)
        .filter(InventoryItem.is_active == True)
        .order_by(InventoryItem.expiry_date.asc(), InventoryItem.id.asc())
        .all()
    )

    total_active_items = len(active_items)
    expiring_soon_count = 0
    expired_count = 0
    temperature_warning_count = 0

    for item in active_items:
        days_left = compute_days_until_expiry(item.expiry_date)
        if days_left < 0:
            expired_count += 1
        elif 0 <= days_left <= 3:
            expiring_soon_count += 1

        # Evaluate only the latest temperature check for this active item
        latest_check = (
            db.query(TemperatureCheck)
            .filter(TemperatureCheck.inventory_id == item.id)
            .order_by(TemperatureCheck.checked_at.desc(), TemperatureCheck.id.desc())
            .first()
        )
        if latest_check and latest_check.status == "ABOVE_LIMIT":
            temperature_warning_count += 1

    nearing_expiry_total = expiring_soon_count + expired_count

    # Recent activity logs (deterministic sort: created_at desc, id desc)
    recent_logs = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
        .limit(10)
        .all()
    )
    activity_responses = [ActivityLogResponse.model_validate(log) for log in recent_logs]

    return DashboardSummaryResponse(
        total_active_items=total_active_items,
        expiring_soon_count=expiring_soon_count,
        expired_count=expired_count,
        nearing_expiry_total=nearing_expiry_total,
        temperature_warning_count=temperature_warning_count,
        recent_activity=activity_responses,
    )


@router.get("/alerts", response_model=AlertsResponse)
def get_active_alerts(db: Session = Depends(get_db)):
    """Retrieve active temperature warnings, expiry alerts, and tailored preservation tips."""
    active_items = (
        db.query(InventoryItem)
        .filter(InventoryItem.is_active == True)
        .order_by(InventoryItem.expiry_date.asc(), InventoryItem.id.asc())
        .all()
    )

    temp_warnings: List[TemperatureAlertItem] = []
    expiry_alerts: List[ExpiryAlertItem] = []
    categories_seen: Dict[str, PreservationTipItem] = {}

    for item in active_items:
        display_name = get_display_name(item.custom_name, item.catalogue.name)
        cat = item.catalogue

        # Track category for preservation tips
        if cat.category not in categories_seen:
            categories_seen[cat.category] = PreservationTipItem(
                category=cat.category,
                storage_type=cat.storage_type,
                default_location=cat.default_location,
                storage_guidance=cat.storage_guidance,
                reference_title=cat.reference_title,
                reference_url=cat.reference_url,
            )

        # 1. Temperature warning evaluation (only latest check per active item)
        latest_check = (
            db.query(TemperatureCheck)
            .filter(TemperatureCheck.inventory_id == item.id)
            .order_by(TemperatureCheck.checked_at.desc(), TemperatureCheck.id.desc())
            .first()
        )
        if latest_check and latest_check.status == "ABOVE_LIMIT":
            temp_warnings.append(
                TemperatureAlertItem(
                    inventory_id=item.id,
                    display_name=display_name,
                    storage_location=item.storage_location,
                    storage_type=cat.storage_type,
                    recorded_temp_c=latest_check.recorded_temp_c,
                    max_temp_c=cat.max_temp_c,
                    checked_at=latest_check.checked_at,
                    message=latest_check.message,
                    storage_guidance=cat.storage_guidance,
                    reference_title=cat.reference_title,
                    reference_url=cat.reference_url,
                )
            )

        # 2. Expiry alert evaluation (near expiry or expired)
        days_left = compute_days_until_expiry(item.expiry_date)
        status_val = compute_expiry_status(days_left)
        if status_val in {"NEAR_EXPIRY", "EXPIRED"}:
            expiry_alerts.append(
                ExpiryAlertItem(
                    inventory_id=item.id,
                    display_name=display_name,
                    storage_location=item.storage_location,
                    purchase_date=item.purchase_date,
                    expiry_date=item.expiry_date,
                    days_until_expiry=days_left,
                    expiry_status=status_val,
                    storage_guidance=cat.storage_guidance,
                    reference_title=cat.reference_title,
                    reference_url=cat.reference_url,
                )
            )

    # Sort expiry alerts: expired first, then nearest expiry, then item ID
    expiry_alerts.sort(key=lambda x: (x.days_until_expiry, x.inventory_id))

    # Sort preservation tips deterministically by category name
    preservation_tips = sorted(categories_seen.values(), key=lambda x: x.category)

    return AlertsResponse(
        temperature_warnings=temp_warnings,
        expiry_alerts=expiry_alerts,
        preservation_tips=preservation_tips,
    )

