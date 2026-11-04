# Smart Food Storage Management System

A food safety and inventory management backend built with FastAPI, SQLAlchemy 2.x, Pydantic 2.x, and SQLite.

## Phase 1 & Phase 2: Backend Architecture & Domain Logic

### Project Structure

```
Smart-Food-Storage-Management-System-/
  backend/
    app/
      __init__.py
      database.py       # SQLite connection, session factory, foreign key pragma
      models.py         # SQLAlchemy ORM models (FoodCatalogue, InventoryItem, TemperatureCheck, ActivityLog)
      schemas.py        # Pydantic v2 validation and response schemas
      seed_data.py      # Idempotent seed function for FoodCatalogue
      services.py       # Domain logic: expiry evaluation, temp checks, simulation, activity logging
      main.py           # FastAPI app, lifespan setup, CORS, and endpoint mounting
      routers/
        __init__.py
        inventory.py    # CRUD & filtering for active inventory items
        temperature.py  # Manual & simulated temperature evaluation & history
        dashboard.py    # Dashboard metrics, recent activity, and active alerts
    tests/
      conftest.py       # Test configuration and python path resolution
      test_foundation.py # Phase 1 test suite (8 tests)
      test_phase2_api.py # Phase 2 test suite (18 isolated tests)
    requirements.txt    # Production & test dependencies
    storage.db          # SQLite database file
  .gitignore
  README.md
```

### Setup & Installation

1. Create and activate a Python 3.10+ virtual environment:
   ```bash
   python -m venv .venv
   # Windows (PowerShell):
   .\.venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

### Running the Backend

From the `backend` directory:
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### API Endpoints

#### Foundation & Catalogue
- `GET /health` – System & database connectivity check
- `GET /api/catalogue` – Retrieve all predefined food catalogue items
- `GET /api/catalogue/{id}` – Retrieve an individual food catalogue item
- `GET /docs` – Interactive Swagger API documentation

#### Inventory Management (`/api/inventory`)
- `GET /api/inventory` – Retrieve all active items (ordered by `expiry_date` ascending); supports `storage_location` and `expiry_status` query filters
- `GET /api/inventory/{id}` – Retrieve active inventory item by ID
- `POST /api/inventory` – Create new item; defaults `storage_location` to catalogue `default_location` if omitted; validates `quantity > 0` and `expiry_date >= purchase_date`
- `PUT /api/inventory/{id}` – Update inventory item details
- `DELETE /api/inventory/{id}` – Soft-delete inventory item (`is_active = False`)

#### Temperature Checker & Simulation (`/api/temperature`)
- `POST /api/temperature/check` – Record manual temperature check (`is_simulated = False`) and evaluate thresholds
- `POST /api/temperature/simulate` – Generate realistic demo temperature reading (`mode: safe | warning | random`) with `is_simulated = True`
- `GET /api/temperature/history` – Retrieve historical checks ordered by `checked_at` descending; supports `inventory_id` and `status` filters

#### Dashboard & Alerts (`/api`)
- `GET /api/dashboard` – High-level summary metrics (`total_active_items`, `expiring_soon_count`, `expired_count`, `temperature_warning_count` based on latest checks) and recent 10 activity logs
- `GET /api/alerts` – Active temperature warnings, expiry alerts, and tailored preservation tips

### Running Automated Tests

From the `backend` directory:
```bash
pytest -v
```
All tests run with complete isolation against a temporary database fixture without polluting `storage.db`.
