from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InventoryItem, TemperatureCheck, get_utc_now
from app.schemas import (
    TemperatureCheckDetailResponse,
    TemperatureCheckInput,
    TemperatureHistoryItem,
    TemperatureSimulateInput,
)
from app.services import (
    evaluate_temperature,
    get_display_name,
    log_activity,
    simulate_temperature,
)

router = APIRouter(prefix="/api/temperature", tags=["Temperature"])


@router.post("/check", response_model=TemperatureCheckDetailResponse)
def record_temperature_check(
    payload: TemperatureCheckInput,
    db: Session = Depends(get_db),
):
    """Record an actual manual temperature check for an active inventory item."""
    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == payload.inventory_id, InventoryItem.is_active == True)
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active inventory item with ID {payload.inventory_id} not found",
        )

    # Evaluate temperature against catalogue rules
    status_val, message = evaluate_temperature(
        storage_type=item.catalogue.storage_type,
        max_temp_c=item.catalogue.max_temp_c,
        recorded_temp_c=payload.recorded_temp_c,
        storage_guidance=item.catalogue.storage_guidance,
    )

    # Manual checks always set is_simulated = False
    temp_check = TemperatureCheck(
        inventory_id=item.id,
        recorded_temp_c=payload.recorded_temp_c,
        status=status_val,
        message=message,
        is_simulated=False,
        checked_at=get_utc_now(),
    )
    db.add(temp_check)
    db.commit()
    db.refresh(temp_check)

    display_name = get_display_name(item.custom_name, item.catalogue.name)
    log_activity(
        db,
        action_type="TEMP_CHECKED",
        description=(
            f"Manual temperature check ({status_val}) recorded for '{display_name}' "
            f"at {payload.recorded_temp_c:.1f}°C"
        ),
    )

    return TemperatureCheckDetailResponse(
        id=temp_check.id,
        inventory_id=temp_check.inventory_id,
        recorded_temp_c=temp_check.recorded_temp_c,
        status=temp_check.status,
        message=temp_check.message,
        is_simulated=temp_check.is_simulated,
        checked_at=temp_check.checked_at,
        display_name=display_name,
        storage_type=item.catalogue.storage_type,
        max_temp_c=item.catalogue.max_temp_c,
        storage_guidance=item.catalogue.storage_guidance,
        reference_title=item.catalogue.reference_title,
        reference_url=item.catalogue.reference_url,
    )


@router.post("/simulate", response_model=TemperatureCheckDetailResponse)
def simulate_temperature_check(
    payload: TemperatureSimulateInput,
    db: Session = Depends(get_db),
):
    """Simulate a realistic demo temperature reading for an active inventory item."""
    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == payload.inventory_id, InventoryItem.is_active == True)
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active inventory item with ID {payload.inventory_id} not found",
        )

    simulated_temp = simulate_temperature(
        storage_type=item.catalogue.storage_type,
        max_temp_c=item.catalogue.max_temp_c,
        mode=payload.mode,
    )

    status_val, message = evaluate_temperature(
        storage_type=item.catalogue.storage_type,
        max_temp_c=item.catalogue.max_temp_c,
        recorded_temp_c=simulated_temp,
        storage_guidance=item.catalogue.storage_guidance,
    )

    # Simulation endpoint always sets is_simulated = True
    temp_check = TemperatureCheck(
        inventory_id=item.id,
        recorded_temp_c=simulated_temp,
        status=status_val,
        message=message,
        is_simulated=True,
        checked_at=get_utc_now(),
    )
    db.add(temp_check)
    db.commit()
    db.refresh(temp_check)

    display_name = get_display_name(item.custom_name, item.catalogue.name)
    log_activity(
        db,
        action_type="TEMP_CHECKED",
        description=(
            f"Simulated temperature check ({status_val}) for '{display_name}' "
            f"at {simulated_temp:.1f}°C (mode: {payload.mode})"
        ),
    )

    return TemperatureCheckDetailResponse(
        id=temp_check.id,
        inventory_id=temp_check.inventory_id,
        recorded_temp_c=temp_check.recorded_temp_c,
        status=temp_check.status,
        message=temp_check.message,
        is_simulated=temp_check.is_simulated,
        checked_at=temp_check.checked_at,
        display_name=display_name,
        storage_type=item.catalogue.storage_type,
        max_temp_c=item.catalogue.max_temp_c,
        storage_guidance=item.catalogue.storage_guidance,
        reference_title=item.catalogue.reference_title,
        reference_url=item.catalogue.reference_url,
    )


@router.get("/history", response_model=List[TemperatureHistoryItem])
def get_temperature_history(
    inventory_id: Optional[int] = Query(None, description="Filter history by inventory item ID"),
    status: Optional[str] = Query(
        None, description="Filter by status: WITHIN_LIMIT, ABOVE_LIMIT, or NO_LIMIT"
    ),
    limit: int = Query(50, ge=1, le=500, description="Max number of records to return"),
    db: Session = Depends(get_db),
):
    """Retrieve historical temperature checks ordered by checked_at descending.

    Note: Historical records for soft-deleted items remain accessible here.
    """
    query = (
        db.query(TemperatureCheck)
        .join(InventoryItem, TemperatureCheck.inventory_id == InventoryItem.id)
    )

    if inventory_id is not None:
        query = query.filter(TemperatureCheck.inventory_id == inventory_id)

    if status:
        query = query.filter(TemperatureCheck.status == status.strip().upper())

    query = query.order_by(TemperatureCheck.checked_at.desc(), TemperatureCheck.id.desc()).limit(limit)
    checks = query.all()

    result = []
    for check in checks:
        item = check.inventory_item
        display_name = get_display_name(item.custom_name, item.catalogue.name)
        result.append(
            TemperatureHistoryItem(
                id=check.id,
                inventory_id=check.inventory_id,
                recorded_temp_c=check.recorded_temp_c,
                status=check.status,
                message=check.message,
                is_simulated=check.is_simulated,
                checked_at=check.checked_at,
                display_name=display_name,
                storage_location=item.storage_location,
                max_temp_c=item.catalogue.max_temp_c,
                reference_title=item.catalogue.reference_title,
                reference_url=item.catalogue.reference_url,
            )
        )

    return result

