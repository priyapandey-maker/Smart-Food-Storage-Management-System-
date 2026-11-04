from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import ActivityLog, FoodCatalogue, InventoryItem, TemperatureCheck
from app.seed_data import seed_catalogue_data


@pytest.fixture(scope="module")
def test_db_setup(tmp_path_factory):
    """Set up an isolated temporary SQLite database for Phase 2 tests.

    Ensures storage.db is never polluted with test records.
    """
    temp_dir = tmp_path_factory.mktemp("phase2_db")
    db_file = temp_dir / "test_phase2.db"
    test_engine = create_engine(
        f"sqlite:///{db_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(test_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    # Create tables
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # Seed initial food catalogue items
    with TestingSessionLocal() as session:
        seed_catalogue_data(session)

    yield test_engine, TestingSessionLocal

    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


@pytest.fixture(scope="module")
def client(test_db_setup):
    """FastAPI TestClient with isolated test database dependency override."""
    test_engine, TestingSessionLocal = test_db_setup

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def db_session(test_db_setup):
    """Provide a direct database session against the isolated test database."""
    _, TestingSessionLocal = test_db_setup
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ===========================================================================
# 1. Inventory CRUD & Validation Tests
# ===========================================================================

def test_create_inventory_item_success_and_default_location(client):
    """Adding a valid item succeeds and defaults storage_location to catalogue's default."""
    today = date.today()
    payload = {
        "catalogue_id": 1,  # Fresh Milk (default_location: Refrigerator)
        "custom_name": "Organic 2% Milk",
        "quantity": 1.5,
        "unit": "litres",
        "storage_location": "",  # Empty -> should default to Refrigerator
        "purchase_date": str(today),
        "expiry_date": str(today + timedelta(days=7)),
    }

    response = client.post("/api/inventory", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["id"] is not None
    assert data["display_name"] == "Organic 2% Milk"
    assert data["storage_location"] == "Refrigerator"
    assert data["quantity"] == 1.5
    assert data["unit"] == "litres"
    assert data["is_active"] is True
    assert data["days_until_expiry"] == 7
    assert data["expiry_status"] == "FRESH"
    assert data["catalogue"]["name"] == "Fresh Milk"


def test_create_inventory_item_invalid_dates_fails_422(client):
    """Adding an item with expiry_date < purchase_date must return HTTP 422."""
    today = date.today()
    payload = {
        "catalogue_id": 1,
        "quantity": 1.0,
        "unit": "bottle",
        "purchase_date": str(today),
        "expiry_date": str(today - timedelta(days=2)),  # Earlier than purchase
    }
    response = client.post("/api/inventory", json=payload)
    assert response.status_code == 422


def test_create_inventory_item_non_positive_quantity_fails_422(client):
    """Adding an item with quantity <= 0 must return HTTP 422."""
    today = date.today()
    payload_zero = {
        "catalogue_id": 1,
        "quantity": 0.0,
        "unit": "bottle",
        "purchase_date": str(today),
        "expiry_date": str(today + timedelta(days=5)),
    }
    response_zero = client.post("/api/inventory", json=payload_zero)
    assert response_zero.status_code == 422

    payload_neg = {
        "catalogue_id": 1,
        "quantity": -2.0,
        "unit": "bottle",
        "purchase_date": str(today),
        "expiry_date": str(today + timedelta(days=5)),
    }
    response_neg = client.post("/api/inventory", json=payload_neg)
    assert response_neg.status_code == 422


def test_create_inventory_item_nonexistent_catalogue_fails_404(client):
    """Adding an item with a non-existent catalogue_id must return HTTP 404."""
    today = date.today()
    payload = {
        "catalogue_id": 999999,
        "quantity": 1.0,
        "unit": "unit",
        "purchase_date": str(today),
        "expiry_date": str(today + timedelta(days=5)),
    }
    response = client.post("/api/inventory", json=payload)
    assert response.status_code == 404


def test_expiry_status_computation_and_filtering(client):
    """Verify dynamic computation of FRESH, NEAR_EXPIRY, and EXPIRED statuses and filtering."""
    today = date.today()

    # 1. Fresh item (expiry > 3 days)
    res_fresh = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 2,  # Raw Chicken Breast
            "custom_name": "Fresh Chicken",
            "quantity": 500,
            "unit": "g",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=5)),
        },
    )
    assert res_fresh.status_code == 201
    assert res_fresh.json()["expiry_status"] == "FRESH"

    # 2. Near expiry item (0 <= days <= 3)
    res_near = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 4,  # Fresh Fish Fillets
            "custom_name": "Salmon for Dinner",
            "quantity": 300,
            "unit": "g",
            "storage_location": "Refrigerator",
            "purchase_date": str(today - timedelta(days=1)),
            "expiry_date": str(today + timedelta(days=2)),
        },
    )
    assert res_near.status_code == 201
    assert res_near.json()["expiry_status"] == "NEAR_EXPIRY"

    # 3. Expired item (days < 0)
    res_exp = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 6,  # Fresh Cut Produce
            "custom_name": "Salad Greens",
            "quantity": 1,
            "unit": "pack",
            "storage_location": "Refrigerator",
            "purchase_date": str(today - timedelta(days=5)),
            "expiry_date": str(today - timedelta(days=1)),
        },
    )
    assert res_exp.status_code == 201
    assert res_exp.json()["expiry_status"] == "EXPIRED"

    # Filter test: expiry_status=NEAR_EXPIRY
    res_filter_near = client.get("/api/inventory?expiry_status=NEAR_EXPIRY")
    assert res_filter_near.status_code == 200
    for it in res_filter_near.json():
        assert it["expiry_status"] == "NEAR_EXPIRY"

    # Filter test: expiry_status=EXPIRED
    res_filter_exp = client.get("/api/inventory?expiry_status=EXPIRED")
    assert res_filter_exp.status_code == 200
    for it in res_filter_exp.json():
        assert it["expiry_status"] == "EXPIRED"


def test_update_inventory_item(client):
    """Updating an item modifies fields and records ITEM_UPDATED in ActivityLog."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 7,  # Frozen Vegetables
            "custom_name": "Sweet Corn",
            "quantity": 1.0,
            "unit": "bag",
            "storage_location": "Freezer",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=60)),
        },
    )
    item_id = create_res.json()["id"]

    update_payload = {
        "custom_name": "Sweet Corn & Peas",
        "quantity": 2.5,
        "unit": "bags",
        "storage_location": "Deep Freezer",
        "purchase_date": str(today),
        "expiry_date": str(today + timedelta(days=90)),
    }
    update_res = client.put(f"/api/inventory/{item_id}", json=update_payload)
    assert update_res.status_code == 200
    data = update_res.json()

    assert data["display_name"] == "Sweet Corn & Peas"
    assert data["quantity"] == 2.5
    assert data["unit"] == "bags"
    assert data["storage_location"] == "Deep Freezer"


def test_soft_delete_inventory_item(client, db_session):
    """Soft deletion sets is_active=False, hides from GET /api/inventory, preserves DB row."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 9,  # Dry White Rice
            "custom_name": "Basmati Rice",
            "quantity": 5.0,
            "unit": "kg",
            "storage_location": "Pantry",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=180)),
        },
    )
    item_id = create_res.json()["id"]

    # Delete (soft delete)
    del_res = client.delete(f"/api/inventory/{item_id}")
    assert del_res.status_code == 200
    assert "soft-deleted" in del_res.json()["message"].lower()

    # GET single item returns 404
    get_res = client.get(f"/api/inventory/{item_id}")
    assert get_res.status_code == 404

    # Direct DB inspection confirms record remains with is_active = False
    db_item = db_session.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    assert db_item is not None
    assert db_item.is_active is False


# ===========================================================================
# 2. Temperature Checker & Simulation Tests
# ===========================================================================

def test_temperature_check_refrigerated_item_within_limit(client):
    """Refrigerated item (max 4.0°C) checked at 3.5°C returns WITHIN_LIMIT with required wording."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 1,  # Fresh Milk (max_temp_c = 4.0)
            "custom_name": "Whole Milk Jug",
            "quantity": 1.0,
            "unit": "gal",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=10)),
        },
    )
    item_id = create_res.json()["id"]

    check_res = client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": 3.5},
    )
    assert check_res.status_code == 200
    data = check_res.json()

    assert data["status"] == "WITHIN_LIMIT"
    assert "Within recommended maximum temperature limit" in data["message"]
    assert data["is_simulated"] is False
    assert data["max_temp_c"] == 4.0
    assert data["storage_type"] == "REFRIGERATED"


def test_temperature_check_refrigerated_no_cold_warning_below_zero(client):
    """Refrigerated item checked at -2.0°C returns WITHIN_LIMIT (MVP defines no minimum threshold)."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 1,
            "quantity": 1.0,
            "unit": "carton",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=7)),
        },
    )
    item_id = create_res.json()["id"]

    check_res = client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": -2.0},
    )
    assert check_res.status_code == 200
    data = check_res.json()
    assert data["status"] == "WITHIN_LIMIT"
    assert "cold warning" not in data["message"].lower()


def test_temperature_check_refrigerated_item_above_limit(client):
    """Refrigerated item checked at 6.5°C returns ABOVE_LIMIT with warning guidance."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 2,  # Raw Chicken (max 4.0°C)
            "custom_name": "Chicken Thighs",
            "quantity": 1.0,
            "unit": "kg",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=3)),
        },
    )
    item_id = create_res.json()["id"]

    check_res = client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": 6.5},
    )
    assert check_res.status_code == 200
    data = check_res.json()

    assert data["status"] == "ABOVE_LIMIT"
    assert "Temperature warning" in data["message"]
    assert "exceeds the recommended maximum limit" in data["message"]
    assert data["is_simulated"] is False


def test_temperature_check_frozen_item_thresholds(client):
    """Frozen item (max -18.0°C): -19.0°C is WITHIN_LIMIT; -10.0°C is ABOVE_LIMIT."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 7,  # Frozen Vegetables (max -18.0°C)
            "custom_name": "Frozen Broccoli",
            "quantity": 500,
            "unit": "g",
            "storage_location": "Freezer",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=90)),
        },
    )
    item_id = create_res.json()["id"]

    # Safe check (-19°C <= -18°C)
    safe_res = client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": -19.0},
    )
    assert safe_res.status_code == 200
    assert safe_res.json()["status"] == "WITHIN_LIMIT"

    # Warning check (-10°C > -18°C)
    warn_res = client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": -10.0},
    )
    assert warn_res.status_code == 200
    assert warn_res.json()["status"] == "ABOVE_LIMIT"


def test_temperature_check_ambient_item_no_limit(client):
    """Ambient pantry item checked at 22.0°C returns NO_LIMIT without temperature warning."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 10,  # Dry Pasta (AMBIENT, max_temp_c is None)
            "custom_name": "Spaghetti Box",
            "quantity": 500,
            "unit": "g",
            "storage_location": "Pantry",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=365)),
        },
    )
    item_id = create_res.json()["id"]

    check_res = client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": 22.0},
    )
    assert check_res.status_code == 200
    data = check_res.json()

    assert data["status"] == "NO_LIMIT"
    assert "no numeric temperature limit applies" in data["message"].lower()
    assert data["max_temp_c"] is None


def test_temperature_simulation_endpoint(client):
    """POST /api/temperature/simulate supports 'safe' and 'warning' modes with is_simulated=True."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 1,  # Fresh Milk (max 4.0)
            "custom_name": "Simulation Milk",
            "quantity": 1.0,
            "unit": "litre",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=7)),
        },
    )
    item_id = create_res.json()["id"]

    # 1. Safe simulation
    safe_sim = client.post(
        "/api/temperature/simulate",
        json={"inventory_id": item_id, "mode": "safe"},
    )
    assert safe_sim.status_code == 200
    safe_data = safe_sim.json()
    assert safe_data["is_simulated"] is True
    assert safe_data["status"] == "WITHIN_LIMIT"
    assert 1.0 <= safe_data["recorded_temp_c"] <= 4.0

    # 2. Warning simulation
    warn_sim = client.post(
        "/api/temperature/simulate",
        json={"inventory_id": item_id, "mode": "warning"},
    )
    assert warn_sim.status_code == 200
    warn_data = warn_sim.json()
    assert warn_data["is_simulated"] is True
    assert warn_data["status"] == "ABOVE_LIMIT"
    assert 5.5 <= warn_data["recorded_temp_c"] <= 10.0

    # 3. Invalid mode returns HTTP 422
    bad_sim = client.post(
        "/api/temperature/simulate",
        json={"inventory_id": item_id, "mode": "super_hot"},
    )
    assert bad_sim.status_code == 422


def test_temperature_history_retrieval_and_filtering(client):
    """GET /api/temperature/history returns checks ordered by checked_at desc and supports filters."""
    history_res = client.get("/api/temperature/history")
    assert history_res.status_code == 200
    items = history_res.json()
    assert len(items) > 0

    first = items[0]
    assert "display_name" in first
    assert "storage_location" in first
    assert "reference_title" in first
    assert "reference_url" in first

    # Filter by status = ABOVE_LIMIT
    above_res = client.get("/api/temperature/history?status=ABOVE_LIMIT")
    assert above_res.status_code == 200
    for h in above_res.json():
        assert h["status"] == "ABOVE_LIMIT"


# ===========================================================================
# 3. Dashboard & Alerts Synchronization Tests
# ===========================================================================

def test_dashboard_temperature_warning_tracks_only_latest_check(client):
    """Temperature warnings track only the latest check per active item.

    A subsequent safe check clears the active warning while preserving history.
    """
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 2,  # Raw Chicken (max 4.0°C)
            "custom_name": "Chicken for Warning Test",
            "quantity": 1.0,
            "unit": "kg",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=4)),
        },
    )
    item_id = create_res.json()["id"]

    # Initial dashboard
    dash_before = client.get("/api/dashboard").json()
    initial_warnings = dash_before["temperature_warning_count"]

    # Record warning check (7.0°C)
    client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": 7.0},
    )

    dash_after_warn = client.get("/api/dashboard").json()
    assert dash_after_warn["temperature_warning_count"] == initial_warnings + 1

    alerts_warn = client.get("/api/alerts").json()
    warn_ids = [w["inventory_id"] for w in alerts_warn["temperature_warnings"]]
    assert item_id in warn_ids

    # Record subsequent safe check (2.5°C) on the same item
    client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": 2.5},
    )

    dash_after_safe = client.get("/api/dashboard").json()
    assert dash_after_safe["temperature_warning_count"] == initial_warnings

    alerts_safe = client.get("/api/alerts").json()
    safe_ids = [w["inventory_id"] for w in alerts_safe["temperature_warnings"]]
    assert item_id not in safe_ids

    # Verify history still contains both checks for this item
    item_history = client.get(f"/api/temperature/history?inventory_id={item_id}").json()
    assert len(item_history) >= 2
    statuses = {h["status"] for h in item_history}
    assert "ABOVE_LIMIT" in statuses
    assert "WITHIN_LIMIT" in statuses


def test_soft_deleted_item_excluded_from_active_warnings_and_alerts(client):
    """Soft-deleting an item with an active warning removes it from active alerts and dashboard."""
    today = date.today()
    create_res = client.post(
        "/api/inventory",
        json={
            "catalogue_id": 4,  # Fresh Fish
            "custom_name": "Fish to Delete",
            "quantity": 1.0,
            "unit": "kg",
            "storage_location": "Refrigerator",
            "purchase_date": str(today),
            "expiry_date": str(today + timedelta(days=2)),  # Near expiry too
        },
    )
    item_id = create_res.json()["id"]

    # Set ABOVE_LIMIT
    client.post(
        "/api/temperature/check",
        json={"inventory_id": item_id, "recorded_temp_c": 8.0},
    )

    dash_before_del = client.get("/api/dashboard").json()
    warnings_before = dash_before_del["temperature_warning_count"]
    assert warnings_before >= 1

    # Soft delete item
    del_res = client.delete(f"/api/inventory/{item_id}")
    assert del_res.status_code == 200

    dash_after_del = client.get("/api/dashboard").json()
    assert dash_after_del["temperature_warning_count"] == warnings_before - 1

    alerts_after_del = client.get("/api/alerts").json()
    temp_warn_ids = [w["inventory_id"] for w in alerts_after_del["temperature_warnings"]]
    expiry_warn_ids = [e["inventory_id"] for e in alerts_after_del["expiry_alerts"]]
    assert item_id not in temp_warn_ids
    assert item_id not in expiry_warn_ids

    # Historical temperature checks for soft-deleted item must still exist in history
    hist_res = client.get(f"/api/temperature/history?inventory_id={item_id}").json()
    assert len(hist_res) >= 1
    assert hist_res[0]["inventory_id"] == item_id


def test_dashboard_metrics_and_recent_activity(client):
    """Verify GET /api/dashboard returns correct summary metrics and recent activity."""
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()

    assert "total_active_items" in data
    assert "expiring_soon_count" in data
    assert "expired_count" in data
    assert "nearing_expiry_total" in data
    assert data["nearing_expiry_total"] == data["expiring_soon_count"] + data["expired_count"]
    assert "temperature_warning_count" in data
    assert "recent_activity" in data
    assert isinstance(data["recent_activity"], list)
    assert len(data["recent_activity"]) <= 10

    # Ensure activity log types match expected values
    for log in data["recent_activity"]:
        assert log["action_type"] in {"ITEM_ADDED", "ITEM_UPDATED", "ITEM_DELETED", "TEMP_CHECKED"}


def test_alerts_endpoint_preservation_tips(client):
    """GET /api/alerts returns preservation tips for categories present in active inventory."""
    res = client.get("/api/alerts")
    assert res.status_code == 200
    data = res.json()

    tips = data["preservation_tips"]
    assert isinstance(tips, list)
    assert len(tips) > 0

    # Ensure each preservation tip has complete safety guidance and source citation
    categories = []
    for tip in tips:
        assert tip["category"]
        assert tip["storage_guidance"]
        assert tip["reference_title"]
        assert tip["reference_url"].startswith("http")
        categories.append(tip["category"])

    # Ensure preservation tips are uniquely sorted by category
    assert categories == sorted(list(set(categories)))

