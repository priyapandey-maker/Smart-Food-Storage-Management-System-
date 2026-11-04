from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodCatalogue, InventoryItem, TemperatureCheck
from app.schemas import (
    ActionConfirmationResponse,
    InventoryItemCreate,
    InventoryItemDetailResponse,
    InventoryItemUpdate,
)
from app.services import (
    build_inventory_item_detail,
    compute_days_until_expiry,
    compute_expiry_status,
    get_display_name,
    log_activity,
)

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("", response_model=List[InventoryItemDetailResponse])
def get_inventory_items(
    storage_location: Optional[str] = Query(None, description="Filter by storage location"),
    expiry_status: Optional[str] = Query(
        None, description="Filter by status: FRESH, NEAR_EXPIRY, or EXPIRED"
    ),
    db: Session = Depends(get_db),
):
    """Retrieve all active inventory items ordered by expiry_date ascending."""
    query = (
        db.query(InventoryItem)
        .filter(InventoryItem.is_active == True)
        .order_by(InventoryItem.expiry_date.asc(), InventoryItem.id.asc())
    )
    items = query.all()

    result = []
    for item in items:
        # Check storage_location filter
        if storage_location and item.storage_location.strip().lower() != storage_location.strip().lower():
            continue

        days_left = compute_days_until_expiry(item.expiry_date)
        status_val = compute_expiry_status(days_left)

        # Check expiry_status filter
        if expiry_status and status_val.upper() != expiry_status.strip().upper():
            continue

        latest_check = (
            db.query(TemperatureCheck)
            .filter(TemperatureCheck.inventory_id == item.id)
            .order_by(TemperatureCheck.checked_at.desc(), TemperatureCheck.id.desc())
            .first()
        )

        result.append(build_inventory_item_detail(item, latest_check))

    return result


@router.get("/{item_id}", response_model=InventoryItemDetailResponse)
def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    """Retrieve a single active inventory item by ID."""
    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == item_id, InventoryItem.is_active == True)
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active inventory item with ID {item_id} not found",
        )

    latest_check = (
        db.query(TemperatureCheck)
        .filter(TemperatureCheck.inventory_id == item.id)
        .order_by(TemperatureCheck.checked_at.desc(), TemperatureCheck.id.desc())
        .first()
    )

    return build_inventory_item_detail(item, latest_check)


@router.post("", response_model=InventoryItemDetailResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_item(payload: InventoryItemCreate, db: Session = Depends(get_db)):
    """Create a new inventory item linked to a food catalogue entry."""
    catalogue = db.query(FoodCatalogue).filter(FoodCatalogue.id == payload.catalogue_id).first()
    if catalogue is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food catalogue item with ID {payload.catalogue_id} not found",
        )

    # If storage_location is omitted or empty, default to catalogue default_location
    storage_loc = payload.storage_location
    if storage_loc is None or not storage_loc.strip():
        storage_loc = catalogue.default_location
    else:
        storage_loc = storage_loc.strip()

    item = InventoryItem(
        catalogue_id=payload.catalogue_id,
        custom_name=payload.custom_name.strip() if payload.custom_name else None,
        quantity=payload.quantity,
        unit=payload.unit.strip(),
        storage_location=storage_loc,
        purchase_date=payload.purchase_date,
        expiry_date=payload.expiry_date,
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    display_name = get_display_name(item.custom_name, catalogue.name)
    log_activity(
        db,
        action_type="ITEM_ADDED",
        description=f"Added '{display_name}' ({item.quantity} {item.unit}) to {item.storage_location}",
    )

    return build_inventory_item_detail(item, latest_check=None)


@router.put("/{item_id}", response_model=InventoryItemDetailResponse)
def update_inventory_item(
    item_id: int,
    payload: InventoryItemUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing active inventory item."""
    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == item_id, InventoryItem.is_active == True)
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active inventory item with ID {item_id} not found",
        )

    item.custom_name = payload.custom_name.strip() if payload.custom_name else None
    item.quantity = payload.quantity
    item.unit = payload.unit.strip()
    item.storage_location = payload.storage_location.strip()
    item.purchase_date = payload.purchase_date
    item.expiry_date = payload.expiry_date

    db.commit()
    db.refresh(item)

    display_name = get_display_name(item.custom_name, item.catalogue.name)
    log_activity(
        db,
        action_type="ITEM_UPDATED",
        description=f"Updated details for inventory item '{display_name}'",
    )

    latest_check = (
        db.query(TemperatureCheck)
        .filter(TemperatureCheck.inventory_id == item.id)
        .order_by(TemperatureCheck.checked_at.desc(), TemperatureCheck.id.desc())
        .first()
    )

    return build_inventory_item_detail(item, latest_check)


@router.delete("/{item_id}", response_model=ActionConfirmationResponse)
def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    """Soft-delete an active inventory item, retaining its temperature check history."""
    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.id == item_id, InventoryItem.is_active == True)
        .first()
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active inventory item with ID {item_id} not found",
        )

    item.is_active = False
    db.commit()

    display_name = get_display_name(item.custom_name, item.catalogue.name)
    log_activity(
        db,
        action_type="ITEM_DELETED",
        description=f"Removed '{display_name}' from active inventory (soft deleted)",
    )

    return ActionConfirmationResponse(
        message=f"Inventory item '{display_name}' soft-deleted successfully",
        id=item_id,
    )

