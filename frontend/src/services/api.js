/**
 * Centralized API service layer for FreshGuard
 * Connects directly to the FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

/**
 * Shared fetch helper with error handling and JSON parsing.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new Error(
      `Unable to reach backend server at ${API_BASE_URL}. Please verify the FastAPI service is running.`
    );
  }

  // Handle successful responses
  if (response.ok) {
    if (response.status === 204) {
      return null;
    }
    return await response.json();
  }

  // Handle error responses from FastAPI
  let errorMessage = `Request failed with status ${response.status} (${response.statusText})`;
  try {
    const errorData = await response.json();
    if (errorData && errorData.detail) {
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((err) => (err.loc ? `${err.loc.slice(1).join('.')}: ${err.msg}` : err.msg || JSON.stringify(err)))
          .join('; ');
      } else if (typeof errorData.detail === 'object') {
        errorMessage = errorData.detail.error || errorData.detail.message || JSON.stringify(errorData.detail);
      }
    }
  } catch {
    // Response body was not JSON, fallback to status text
  }

  const error = new Error(errorMessage);
  error.status = response.status;
  throw error;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/**
 * Check backend and database health.
 * @returns {Promise<{ status: string, database: string, version: string }>}
 */
export async function checkHealth() {
  return request('/health');
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

/**
 * Retrieve all predefined food catalogue items.
 * @returns {Promise<Array>}
 */
export async function getCatalogue() {
  return request('/api/catalogue');
}

/**
 * Retrieve an individual food catalogue item by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function getCatalogueItem(id) {
  return request(`/api/catalogue/${id}`);
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/**
 * Retrieve active inventory items with optional filters.
 * @param {Object} [params]
 * @param {string} [params.storage_location]
 * @param {string} [params.expiry_status] FRESH, NEAR_EXPIRY, or EXPIRED
 * @returns {Promise<Array>}
 */
export async function getInventory(params = {}) {
  const query = new URLSearchParams();
  if (params.storage_location) {
    query.set('storage_location', params.storage_location);
  }
  if (params.expiry_status) {
    query.set('expiry_status', params.expiry_status);
  }
  const qs = query.toString();
  return request(`/api/inventory${qs ? `?${qs}` : ''}`);
}

/**
 * Retrieve a single active inventory item by ID.
 * @param {number|string} id
 * @returns {Promise<Object>}
 */
export async function getInventoryItem(id) {
  return request(`/api/inventory/${id}`);
}

/**
 * Create a new inventory item.
 * @param {Object} payload
 * @param {number} payload.catalogue_id
 * @param {string} [payload.custom_name]
 * @param {number} payload.quantity
 * @param {string} payload.unit
 * @param {string} [payload.storage_location] Defaults to catalogue's default location if empty
 * @param {string} payload.purchase_date YYYY-MM-DD
 * @param {string} payload.expiry_date YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function createInventoryItem(payload) {
  return request('/api/inventory', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Update an existing active inventory item.
 * @param {number|string} id
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function updateInventoryItem(id, payload) {
  return request(`/api/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Soft-delete an active inventory item.
 * @param {number|string} id
 * @returns {Promise<{ message: string, id: number }>}
 */
export async function deleteInventoryItem(id) {
  return request(`/api/inventory/${id}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Temperature Checking & Simulation
// ---------------------------------------------------------------------------

/**
 * Record a manual temperature check.
 * @param {Object} payload
 * @param {number} payload.inventory_id
 * @param {number} payload.recorded_temp_c
 * @param {boolean} [payload.is_simulated=false]
 * @returns {Promise<Object>}
 */
export async function checkTemperature(payload) {
  return request('/api/temperature/check', {
    method: 'POST',
    body: JSON.stringify({
      inventory_id: payload.inventory_id,
      recorded_temp_c: payload.recorded_temp_c,
      is_simulated: false,
    }),
  });
}

/**
 * Simulate a realistic demo temperature reading.
 * @param {Object} payload
 * @param {number} payload.inventory_id
 * @param {'safe'|'warning'|'random'} [payload.mode='random']
 * @returns {Promise<Object>}
 */
export async function simulateTemperature(payload) {
  return request('/api/temperature/simulate', {
    method: 'POST',
    body: JSON.stringify({
      inventory_id: payload.inventory_id,
      mode: payload.mode || 'random',
    }),
  });
}

/**
 * Retrieve historical temperature checks.
 * @param {Object} [params]
 * @param {number} [params.inventory_id]
 * @param {'WITHIN_LIMIT'|'ABOVE_LIMIT'|'NO_LIMIT'} [params.status]
 * @param {number} [params.limit=50]
 * @returns {Promise<Array>}
 */
export async function getTemperatureHistory(params = {}) {
  const query = new URLSearchParams();
  if (params.inventory_id !== undefined && params.inventory_id !== null) {
    query.set('inventory_id', params.inventory_id);
  }
  if (params.status) {
    query.set('status', params.status);
  }
  if (params.limit) {
    query.set('limit', params.limit);
  }
  const qs = query.toString();
  return request(`/api/temperature/history${qs ? `?${qs}` : ''}`);
}

// ---------------------------------------------------------------------------
// Dashboard & Alerts
// ---------------------------------------------------------------------------

/**
 * Retrieve high-level dashboard metrics and recent activity logs.
 * @returns {Promise<{
 *   total_active_items: number,
 *   expiring_soon_count: number,
 *   expired_count: number,
 *   nearing_expiry_total: number,
 *   temperature_warning_count: number,
 *   recent_activity: Array
 * }>}
 */
export async function getDashboard() {
  return request('/api/dashboard');
}

/**
 * Retrieve active temperature warnings, expiry alerts, and preservation tips.
 * @returns {Promise<{
 *   temperature_warnings: Array,
 *   expiry_alerts: Array,
 *   preservation_tips: Array
 * }>}
 */
export async function getAlerts() {
  return request('/api/alerts');
}

