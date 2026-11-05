from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def get_utc_now():
    """Return current UTC datetime with timezone awareness."""
    return datetime.now(timezone.utc)


class FoodCatalogue(Base):
    """Predefined food catalogue containing baseline safety thresholds and guidance."""

    __tablename__ = "food_catalogues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    category = Column(String(100), nullable=False)
    storage_type = Column(String(50), nullable=False)  # REFRIGERATED, FROZEN, AMBIENT
    max_temp_c = Column(Float, nullable=True)  # Null for AMBIENT items
    default_location = Column(String(100), nullable=False)  # Refrigerator, Freezer, Pantry
    storage_guidance = Column(Text, nullable=False)
    reference_title = Column(String(255), nullable=False)
    reference_url = Column(String(500), nullable=False)

    # Relationship to inventory items
    inventory_items = relationship(
        "InventoryItem",
        back_populates="catalogue",
    )


class InventoryItem(Base):
    """User inventory item mapped to a food catalogue entry with soft-delete support."""

    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    catalogue_id = Column(Integer, ForeignKey("food_catalogues.id"), nullable=False)
    custom_name = Column(String(255), nullable=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    storage_location = Column(String(100), nullable=False)
    purchase_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    catalogue = relationship("FoodCatalogue", back_populates="inventory_items")
    temperature_checks = relationship(
        "TemperatureCheck",
        back_populates="inventory_item",
    )


class TemperatureCheck(Base):
    """Recorded temperature check against an inventory item's threshold."""

    __tablename__ = "temperature_checks"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    recorded_temp_c = Column(Float, nullable=False)
    status = Column(String(50), nullable=False)  # WITHIN_LIMIT, ABOVE_LIMIT
    message = Column(Text, nullable=False)
    is_simulated = Column(Boolean, default=False, nullable=False)
    checked_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

    # Relationship
    inventory_item = relationship("InventoryItem", back_populates="temperature_checks")


class ActivityLog(Base):
    """Audit and activity logging for user actions and system events."""

    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False)

