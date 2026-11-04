from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Phase 1 Schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    database: str
    version: str


class FoodCatalogueBase(BaseModel):
    name: str
    category: str
    storage_type: str
    max_temp_c: Optional[float] = None
    default_location: str
    storage_guidance: str
    reference_title: str
    reference_url: str


class FoodCatalogueCreate(FoodCatalogueBase):
    pass


class FoodCatalogueResponse(FoodCatalogueBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class InventoryItemBase(BaseModel):
    catalogue_id: int
    custom_name: Optional[str] = None
    quantity: float
    unit: str
    storage_location: str
    purchase_date: date
    expiry_date: Optional[date] = None
    is_active: bool = True


class InventoryItemResponse(InventoryItemBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemperatureCheckBase(BaseModel):
    inventory_id: int
    recorded_temp_c: float
    status: str
    message: str
    is_simulated: bool = False


class TemperatureCheckCreate(TemperatureCheckBase):
    pass


class TemperatureCheckResponse(TemperatureCheckBase):
    id: int
    checked_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityLogBase(BaseModel):
    action_type: str
    description: str


class ActivityLogCreate(ActivityLogBase):
    pass


class ActivityLogResponse(ActivityLogBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Phase 2 Schemas: Inventory
# ---------------------------------------------------------------------------

class InventoryItemCreate(BaseModel):
    catalogue_id: int
    custom_name: Optional[str] = None
    quantity: float
    unit: str
    storage_location: Optional[str] = None
    purchase_date: date
    expiry_date: date

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "InventoryItemCreate":
        if self.expiry_date < self.purchase_date:
            raise ValueError("Expiry date cannot be earlier than purchase date")
        return self


class InventoryItemUpdate(BaseModel):
    custom_name: Optional[str] = None
    quantity: float
    unit: str
    storage_location: str
    purchase_date: date
    expiry_date: date

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "InventoryItemUpdate":
        if self.expiry_date < self.purchase_date:
            raise ValueError("Expiry date cannot be earlier than purchase date")
        return self


class TemperatureCheckSummary(BaseModel):
    id: int
    recorded_temp_c: float
    status: str
    message: str
    is_simulated: bool
    checked_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemDetailResponse(BaseModel):
    id: int
    catalogue_id: int
    custom_name: Optional[str] = None
    display_name: str
    quantity: float
    unit: str
    storage_location: str
    purchase_date: date
    expiry_date: date
    created_at: datetime
    is_active: bool
    days_until_expiry: int
    expiry_status: str
    catalogue: FoodCatalogueResponse
    latest_temp_check: Optional[TemperatureCheckSummary] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Phase 2 Schemas: Temperature Check & Simulation
# ---------------------------------------------------------------------------

class TemperatureCheckInput(BaseModel):
    inventory_id: int
    recorded_temp_c: float
    is_simulated: bool = False


class TemperatureSimulateInput(BaseModel):
    inventory_id: int
    mode: str = "random"

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        v_clean = v.strip().lower()
        if v_clean not in {"random", "safe", "warning"}:
            raise ValueError("Mode must be 'random', 'safe', or 'warning'")
        return v_clean


class TemperatureCheckDetailResponse(BaseModel):
    id: int
    inventory_id: int
    recorded_temp_c: float
    status: str
    message: str
    is_simulated: bool
    checked_at: datetime
    display_name: str
    storage_type: str
    max_temp_c: Optional[float] = None
    storage_guidance: str
    reference_title: str
    reference_url: str

    model_config = ConfigDict(from_attributes=True)


class TemperatureHistoryItem(BaseModel):
    id: int
    inventory_id: int
    recorded_temp_c: float
    status: str
    message: str
    is_simulated: bool
    checked_at: datetime
    display_name: str
    storage_location: str
    max_temp_c: Optional[float] = None
    reference_title: str
    reference_url: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Phase 2 Schemas: Dashboard & Alerts
# ---------------------------------------------------------------------------

class DashboardSummaryResponse(BaseModel):
    total_active_items: int
    expiring_soon_count: int
    expired_count: int
    nearing_expiry_total: int
    temperature_warning_count: int
    recent_activity: List[ActivityLogResponse]


class TemperatureAlertItem(BaseModel):
    inventory_id: int
    display_name: str
    storage_location: str
    storage_type: str
    recorded_temp_c: float
    max_temp_c: Optional[float] = None
    checked_at: datetime
    message: str
    storage_guidance: str
    reference_title: str
    reference_url: str


class ExpiryAlertItem(BaseModel):
    inventory_id: int
    display_name: str
    storage_location: str
    purchase_date: date
    expiry_date: date
    days_until_expiry: int
    expiry_status: str
    storage_guidance: str
    reference_title: str
    reference_url: str


class PreservationTipItem(BaseModel):
    category: str
    storage_type: str
    default_location: str
    storage_guidance: str
    reference_title: str
    reference_url: str


class AlertsResponse(BaseModel):
    temperature_warnings: List[TemperatureAlertItem]
    expiry_alerts: List[ExpiryAlertItem]
    preservation_tips: List[PreservationTipItem]


class ActionConfirmationResponse(BaseModel):
    message: str
    id: int
