import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, get_db
from app.main import app
from app.models import FoodCatalogue, InventoryItem
from app.seed_data import seed_catalogue_data


@pytest.fixture(scope="module")
def client():
    """TestClient context that triggers the lifespan event (init_db & seed)."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """Database session fixture for direct database assertions."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_health_endpoint_returns_200(client):
    """1. Test that the health endpoint returns HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_database_connection_functional(client):
    """2. Test that the database connection is verified and functional."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["database"] == "connected"
    assert data["version"] == "1.0.0"


def test_catalogue_contains_at_least_eight_items(client):
    """3. Test that the catalogue contains at least eight items."""
    response = client.get("/api/catalogue")
    assert response.status_code == 200
    items = response.json()
    assert isinstance(items, list)
    assert len(items) >= 8

    # Verify key required categories are represented
    categories = {item["category"] for item in items}
    expected_categories = {
        "Dairy",
        "Meat and poultry",
        "Seafood",
        "Eggs",
        "Produce",
        "Frozen foods",
        "Cooked leftovers",
        "Pantry/dry goods",
    }
    for expected in expected_categories:
        assert expected in categories, f"Missing expected category: {expected}"


def test_catalogue_entries_have_valid_source_title_and_url(client):
    """4. Test that every catalogue entry has a valid source title and URL."""
    response = client.get("/api/catalogue")
    assert response.status_code == 200
    items = response.json()

    for item in items:
        # Title must be non-empty string
        assert item["reference_title"] is not None
        assert len(item["reference_title"].strip()) > 0

        # URL must be a valid HTTP/HTTPS URL
        url = item["reference_url"]
        assert url is not None
        assert url.startswith("http://") or url.startswith("https://")


def test_ambient_items_have_no_invented_temperature_threshold(client):
    """5. Test that ambient items have max_temp_c set to null (no numerical threshold)."""
    response = client.get("/api/catalogue")
    assert response.status_code == 200
    items = response.json()

    ambient_items = [item for item in items if item["storage_type"] == "AMBIENT"]
    assert len(ambient_items) > 0, "Expected at least one AMBIENT food item"

    for item in ambient_items:
        assert item["max_temp_c"] is None, (
            f"Ambient item '{item['name']}' should have max_temp_c set to None, "
            f"found: {item['max_temp_c']}"
        )


def test_seed_process_is_idempotent(db_session, client):
    """6. Test that re-running the seed process does not generate duplicate entries."""
    initial_count = db_session.query(FoodCatalogue).count()
    assert initial_count >= 8

    # Re-run seed function
    added_count = seed_catalogue_data(db_session)
    assert added_count == 0

    after_count = db_session.query(FoodCatalogue).count()
    assert after_count == initial_count

    # Verify all names remain unique
    names = [name for (name,) in db_session.query(FoodCatalogue.name).all()]
    assert len(names) == len(set(names))


def test_individual_catalogue_item_retrieval(client):
    """7. Test individual catalogue item retrieval works for valid IDs and returns 404 for nonexistent IDs."""
    # Fetch list to get a valid ID
    list_response = client.get("/api/catalogue")
    assert list_response.status_code == 200
    items = list_response.json()
    first_item = items[0]

    # Test retrieval of existing item
    detail_response = client.get(f"/api/catalogue/{first_item['id']}")
    assert detail_response.status_code == 200
    detail_data = detail_response.json()
    assert detail_data["id"] == first_item["id"]
    assert detail_data["name"] == first_item["name"]
    assert detail_data["category"] == first_item["category"]
    assert detail_data["storage_type"] == first_item["storage_type"]

    # Test retrieval of nonexistent item
    nonexistent_id = 999999
    not_found_response = client.get(f"/api/catalogue/{nonexistent_id}")
    assert not_found_response.status_code == 404
    assert "not found" in not_found_response.json()["detail"].lower()


def test_sqlite_foreign_key_constraints_enforced(db_session):
    """Bonus test: Verify SQLite foreign key constraints are actively enforced."""
    invalid_item = InventoryItem(
        catalogue_id=999999,  # Does not exist
        custom_name="Nonexistent Catalogue Food",
        quantity=1.0,
        unit="kg",
        storage_location="Refrigerator",
        purchase_date=date.today(),
        is_active=True,
    )
    db_session.add(invalid_item)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

