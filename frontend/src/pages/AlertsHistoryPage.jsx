import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getAlerts, getTemperatureHistory, getInventory } from '../services/api';

/**
 * Format ISO datetime string to exact reference screenshot format:
 * "Nov 4, 2026 • 04:15 PM"
 */
function formatHistoryDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} • ${timePart}`;
  } catch {
    return isoString;
  }
}

/**
 * Formats a temperature in Celsius.
 */
function formatTemp(celsius) {
  if (celsius === null || celsius === undefined || isNaN(celsius)) return '—';
  return `${Number(celsius).toFixed(1)}°C`;
}

/**
 * Contextual category icon, color, and condition for preservation cards.
 */
function getCategoryVisual(category = '', storageType = '') {
  const cat = `${category} ${storageType}`.toLowerCase();
  if (cat.includes('dairy') || cat.includes('milk')) {
    return {
      emoji: '🥛',
      color: '#E0F2FE',
      defaultCondition: 'Refrigerator • ≤ 4°C',
    };
  }
  if (cat.includes('meat') || cat.includes('poultry') || cat.includes('chicken') || cat.includes('beef')) {
    return {
      emoji: '🥩',
      color: '#FEE2E2',
      defaultCondition: 'Refrigerator • ≤ 4°C',
    };
  }
  if (cat.includes('produce') || cat.includes('lettuce') || cat.includes('vegetable') || cat.includes('salad')) {
    return {
      emoji: '🥬',
      color: '#DCFCE7',
      defaultCondition: 'Refrigerator • 4–7°C',
    };
  }
  if (cat.includes('frozen')) {
    return {
      emoji: '❄️',
      color: '#E0F2FE',
      defaultCondition: 'Freezer • ≤ -18°C',
    };
  }
  if (cat.includes('seafood') || cat.includes('fish') || cat.includes('salmon')) {
    return {
      emoji: '🐟',
      color: '#CFFAFE',
      defaultCondition: 'Refrigerator • ≤ 4°C',
    };
  }
  if (cat.includes('egg')) {
    return {
      emoji: '🥚',
      color: '#DCFCE7',
      defaultCondition: 'Refrigerator • ≤ 4°C',
    };
  }
  if (cat.includes('pantry') || cat.includes('dry') || cat.includes('rice') || cat.includes('grain')) {
    return {
      emoji: '🌾',
      color: '#FEF9C3',
      defaultCondition: 'Pantry • Cool & Dry',
    };
  }
  if (cat.includes('leftover')) {
    return {
      emoji: '🍲',
      color: '#FEF3C7',
      defaultCondition: 'Refrigerator • ≤ 4°C',
    };
  }
  return {
    emoji: '📦',
    color: '#F1F5F9',
    defaultCondition:
      storageType === 'FROZEN'
        ? 'Freezer • ≤ -18°C'
        : storageType === 'REFRIGERATED'
          ? 'Refrigerator • ≤ 4°C'
          : 'Pantry • Cool & Dry',
  };
}

export default function AlertsHistoryPage() {
  // Alerts data state
  const [alertsData, setAlertsData] = useState(null);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const [alertsError, setAlertsError] = useState(null);

  // Temperature history data state
  const [historyList, setHistoryList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Available inventory items for history filter
  const [inventoryItems, setInventoryItems] = useState([]);

  // Primary filters matching reference image
  const [readingTypeFilter, setReadingTypeFilter] = useState('ALL'); // 'ALL' | 'MANUAL' | 'SIMULATED'
  const [timeRange, setTimeRange] = useState('7'); // '7' | '30' | 'all'

  // Secondary filters (status & item)
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedInventoryId, setSelectedInventoryId] = useState('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Expanded row tracking for history table
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());

  // Collapsible active warning details
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [showExpiryDetails, setShowExpiryDetails] = useState(false);

  // Refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Fetch alerts
  const loadAlerts = async (silent = false) => {
    if (!silent) setIsLoadingAlerts(true);
    setAlertsError(null);
    try {
      const data = await getAlerts();
      setAlertsData(data);
    } catch (err) {
      setAlertsError(err.message || 'Failed to load active alerts.');
    } finally {
      setIsLoadingAlerts(false);
    }
  };

  // 2. Fetch history records from backend
  const loadHistory = async (silent = false) => {
    if (!silent) setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const params = {
        limit: 100,
      };
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (selectedInventoryId !== 'ALL') {
        params.inventory_id = Number(selectedInventoryId);
      }
      const data = await getTemperatureHistory(params);
      setHistoryList(data || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load temperature check history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 3. Load active inventory items for filter dropdown
  const loadFilterItems = async () => {
    try {
      const items = await getInventory();
      setInventoryItems(items || []);
    } catch {
      // Non-critical
    }
  };

  // Initial load
  useEffect(() => {
    loadAlerts();
    loadHistory();
    loadFilterItems();
  }, []);

  // Reload history when status or inventory filter changes
  useEffect(() => {
    loadHistory(false);
  }, [selectedStatus, selectedInventoryId]);

  // Unified refresh handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([loadAlerts(true), loadHistory(true), loadFilterItems()]);
    setIsRefreshing(false);
  };

  // Toggle expanded row
  const toggleHistoryRow = (id) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Derived filtered history records
  const filteredHistory = historyList.filter((record) => {
    // Reading type filter (segmented buttons)
    if (readingTypeFilter === 'MANUAL' && record.is_simulated) return false;
    if (readingTypeFilter === 'SIMULATED' && !record.is_simulated) return false;

    // Time range filter
    if (timeRange === '7') {
      const recordTime = new Date(record.checked_at).getTime();
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (recordTime < cutoff) return false;
    } else if (timeRange === '30') {
      const recordTime = new Date(record.checked_at).getTime();
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      if (recordTime < cutoff) return false;
    }

    return true;
  });

  const tempWarnings = alertsData?.temperature_warnings || [];
  const expiryAlerts = alertsData?.expiry_alerts || [];
  const preservationTips = alertsData?.preservation_tips || [];

  const isFiltered =
    readingTypeFilter !== 'ALL' ||
    timeRange !== '7' ||
    selectedStatus !== 'ALL' ||
    selectedInventoryId !== 'ALL';

  const resetAllFilters = () => {
    setReadingTypeFilter('ALL');
    setTimeRange('7');
    setSelectedStatus('ALL');
    setSelectedInventoryId('ALL');
  };

  // Loading state
  if (isLoadingAlerts && isLoadingHistory) {
    return (
      <div className="page-alerts">
        <div className="alerts-page-heading">
          <h2>Alerts &amp; History</h2>
          <p>Monitor storage warnings, expiry dates and food preservation records.</p>
        </div>
        <LoadingState message="Loading storage alerts, preservation guidelines, and history records..." />
      </div>
    );
  }

  // Error state
  if (alertsError && historyError) {
    return (
      <div className="page-alerts">
        <div className="alerts-page-heading">
          <h2>Alerts &amp; History</h2>
          <p>Monitor storage warnings, expiry dates and food preservation records.</p>
        </div>
        <ErrorState
          title="Unable to load alerts & history data"
          message={alertsError}
          onRetry={handleRefreshAll}
        />
      </div>
    );
  }

  return (
    <div className="page-alerts">
      {/* =================================================================== */}
      {/* 1. Page Heading                                                     */}
      {/* =================================================================== */}
      <div className="alerts-page-heading-row">
        <div className="alerts-page-heading">
          <h2>Alerts &amp; History</h2>
          <p>Monitor storage warnings, expiry dates and food preservation records.</p>
        </div>

        <button
          type="button"
          className="btn-refresh-alerts"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          title="Refresh alerts and temperature history"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            className={isRefreshing ? 'spin-animation' : ''}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
          </svg>
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* 2. Alert Summary Cards (Two Prominent Cards Side-by-Side)          */}
      {/* =================================================================== */}
      <div className="alerts-summary-grid">
        {/* Card 1: Temperature Warnings */}
        <div className={`alerts-summary-card ${tempWarnings.length > 0 ? 'has-breaches' : 'is-safe'}`}>
          <div className="summary-card-left">
            <div
              className={`summary-icon-circle ${tempWarnings.length > 0 ? 'icon-circle-danger' : 'icon-circle-green'}`}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                width="30"
                height="30"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                <circle cx="11.5" cy="16.5" r="2.2" fill="currentColor" />
                <line x1="11.5" y1="9" x2="11.5" y2="14.3" stroke="currentColor" strokeWidth="2.4" />
              </svg>
            </div>

            <div className="summary-info-col">
              <span className="summary-label">Temperature Warnings</span>
              <div className="summary-stat-row">
                <span className="summary-count">{tempWarnings.length}</span>
                {tempWarnings.length === 0 ? (
                  <span className="summary-status-pill pill-status-clean-green">
                    <span className="pill-status-dot">✓</span>
                    <span>No active alerts</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="summary-status-pill pill-status-danger"
                    onClick={() => setShowWarningDetails((prev) => !prev)}
                    title="Click to toggle warning item details"
                  >
                    <span className="pill-status-dot">⚠️</span>
                    <span>
                      {tempWarnings.length === 1 ? '1 active warning' : `${tempWarnings.length} active warnings`}
                    </span>
                    <span className="pill-expand-arrow">{showWarningDetails ? '▲' : '▼'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="summary-card-divider" />

          <div className="summary-card-right">
            <Link to="/checker" className="summary-nav-link">
              <span>View Temperature Checker</span>
              <span className="nav-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Card 2: Expiry Alerts */}
        <div className={`alerts-summary-card ${expiryAlerts.length > 0 ? 'has-expiry' : 'is-safe'}`}>
          <div className="summary-card-left">
            <div
              className={`summary-icon-circle ${expiryAlerts.length > 0 ? 'icon-circle-amber' : 'icon-circle-amber-soft'}`}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                width="30"
                height="30"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <circle cx="16" cy="16" r="3" />
                <polyline points="16 14.5 16 16 17.5 16" />
              </svg>
            </div>

            <div className="summary-info-col">
              <span className="summary-label">Expiry Alerts</span>
              <div className="summary-stat-row">
                <span className="summary-count">{expiryAlerts.length}</span>
                {expiryAlerts.length === 0 ? (
                  <span className="summary-status-pill pill-status-clean-amber">
                    <span className="pill-status-dot">✓</span>
                    <span>No pending alerts</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="summary-status-pill pill-status-warn"
                    onClick={() => setShowExpiryDetails((prev) => !prev)}
                    title="Click to toggle expiry alert details"
                  >
                    <span className="pill-status-dot">⚠️</span>
                    <span>
                      {expiryAlerts.length === 1 ? '1 item requires attention' : `${expiryAlerts.length} items require attention`}
                    </span>
                    <span className="pill-expand-arrow">{showExpiryDetails ? '▲' : '▼'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="summary-card-divider" />

          <div className="summary-card-right">
            <Link to="/inventory" className="summary-nav-link">
              <span>View Food Inventory</span>
              <span className="nav-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2B. Expandable Active Alerts Panels (When Items Require Action)      */}
      {/* =================================================================== */}
      {showWarningDetails && tempWarnings.length > 0 && (
        <div className="active-alerts-panel">
          <div className="active-alerts-panel-header">
            <h4>Active Temperature Warning Details</h4>
            <button
              type="button"
              className="btn-close-panel"
              onClick={() => setShowWarningDetails(false)}
            >
              ✕ Close
            </button>
          </div>
          <div className="active-alerts-items-grid">
            {tempWarnings.map((item) => (
              <div key={item.inventory_id} className="active-alert-item-card alert-breach-item">
                <div className="alert-item-title-row">
                  <strong>{item.display_name}</strong>
                  <span className="alert-breach-badge">Above Limit</span>
                </div>
                <div className="alert-item-meta-line">
                  <span>Location: {item.storage_location}</span>
                  <span>•</span>
                  <span>
                    Recorded: <strong>{item.recorded_temp_c.toFixed(1)}°C</strong> (Max ≤ {item.max_temp_c}°C)
                  </span>
                </div>
                <p className="alert-item-msg">{item.message}</p>
                <div className="alert-item-actions">
                  <Link to="/checker" className="alert-action-link">
                    Re-check in Temperature Checker →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showExpiryDetails && expiryAlerts.length > 0 && (
        <div className="active-alerts-panel">
          <div className="active-alerts-panel-header">
            <h4>Active Expiry Alert Details</h4>
            <button
              type="button"
              className="btn-close-panel"
              onClick={() => setShowExpiryDetails(false)}
            >
              ✕ Close
            </button>
          </div>
          <div className="active-alerts-items-grid">
            {expiryAlerts.map((item) => {
              const isExpired = item.expiry_status === 'EXPIRED';
              return (
                <div
                  key={item.inventory_id}
                  className={`active-alert-item-card ${isExpired ? 'alert-expired-item' : 'alert-near-item'}`}
                >
                  <div className="alert-item-title-row">
                    <strong>{item.display_name}</strong>
                    <span className={isExpired ? 'alert-expired-badge' : 'alert-near-badge'}>
                      {isExpired ? 'Expired' : 'Near Expiry'}
                    </span>
                  </div>
                  <div className="alert-item-meta-line">
                    <span>Location: {item.storage_location}</span>
                    <span>•</span>
                    <span>
                      {isExpired
                        ? `Expired ${Math.abs(item.days_until_expiry)} day(s) ago`
                        : item.days_until_expiry === 0
                          ? 'Expires today'
                          : `Expires in ${item.days_until_expiry} days`}
                    </span>
                  </div>
                  <p className="alert-item-msg">{item.storage_guidance}</p>
                  <div className="alert-item-actions">
                    <Link to="/inventory" className="alert-action-link">
                      Manage in Food Inventory →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. Verified Preservation Guidelines                                */}
      {/* =================================================================== */}
      <div className="preservation-section-wrapper">
        <div className="section-header-row">
          <div className="section-title-group">
            <span className="section-title-icon icon-book-green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.2" fill="none">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
            <div>
              <h3 className="section-title">Verified Preservation Guidelines</h3>
              <p className="section-subtitle">
                Follow official storage recommendations from USDA and FoodSafety.gov.
              </p>
            </div>
          </div>

          <Link to="/inventory" className="btn-view-all-guidelines">
            <span>View All Guidelines</span>
            <span className="btn-arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        {preservationTips.length === 0 ? (
          <div className="preservation-empty-card">
            <span className="empty-icon-sm">📦</span>
            <h4>No Active Food Categories Detected</h4>
            <p>
              Add food items to your inventory to view official category preservation recommendations.
            </p>
            <Link to="/inventory" className="btn-empty-action">
              + Go to Food Inventory
            </Link>
          </div>
        ) : (
          <div className="preservation-cards-grid">
            {preservationTips.map((tip) => {
              const vis = getCategoryVisual(tip.category, tip.storage_type);
              const defaultLoc = tip.default_location || 'Refrigerator';
              const tempCondition =
                tip.storage_type === 'FROZEN'
                  ? '≤ -18°C'
                  : tip.storage_type === 'REFRIGERATED'
                    ? '≤ 4°C'
                    : 'Cool & Dry';

              return (
                <div key={tip.category} className="preservation-card">
                  <div
                    className="preservation-card-avatar"
                    style={{ backgroundColor: vis.color }}
                    aria-hidden="true"
                  >
                    <span>{vis.emoji}</span>
                  </div>

                  <div className="preservation-card-content">
                    <h4 className="preservation-card-title">{tip.category}</h4>
                    <span className="preservation-card-condition">
                      {defaultLoc} • {tempCondition}
                    </span>
                    <p className="preservation-card-desc">{tip.storage_guidance}</p>
                    {tip.reference_url && (
                      <a
                        href={tip.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="preservation-learn-more"
                      >
                        Learn more ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 4. Temperature History                                              */}
      {/* =================================================================== */}
      <div className="history-section-wrapper">
        <div className="section-header-row history-header-row">
          <div className="section-title-group">
            <span className="section-title-icon icon-clock-green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.2" fill="none">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l4 2" />
              </svg>
            </span>
            <div>
              <h3 className="section-title">Temperature History</h3>
              <p className="section-subtitle">
                Track all temperature checks, including manual and simulated readings.
              </p>
            </div>
          </div>

          <div className="history-toolbar-right">
            {/* Segmented Filter Pills */}
            <div className="segmented-filter-bar" role="group" aria-label="Filter readings by type">
              <button
                type="button"
                className={`seg-btn ${readingTypeFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setReadingTypeFilter('ALL')}
              >
                All Readings
              </button>
              <button
                type="button"
                className={`seg-btn ${readingTypeFilter === 'MANUAL' ? 'active' : ''}`}
                onClick={() => setReadingTypeFilter('MANUAL')}
              >
                Manual
              </button>
              <button
                type="button"
                className={`seg-btn ${readingTypeFilter === 'SIMULATED' ? 'active' : ''}`}
                onClick={() => setReadingTypeFilter('SIMULATED')}
              >
                Simulated
              </button>
            </div>

            {/* Time Filter Dropdown */}
            <div className="time-select-container">
              <select
                className="time-select-control"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                aria-label="Filter history by time range"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
              <span className="time-select-caret" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            {/* Toggle for Advanced Filters */}
            <button
              type="button"
              className={`btn-toggle-filters ${showAdvancedFilters ? 'active' : ''}`}
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              title="Filter by status or food item"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.2" fill="none">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Optional Secondary Filter Row */}
        {showAdvancedFilters && (
          <div className="history-advanced-filters-row">
            <div className="filter-item-col">
              <label htmlFor="filter-status">Status</label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="advanced-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="WITHIN_LIMIT">Within Limit (Safe)</option>
                <option value="ABOVE_LIMIT">Above Limit (Warning)</option>
                <option value="NO_LIMIT">No Limit (Ambient)</option>
              </select>
            </div>

            <div className="filter-item-col">
              <label htmlFor="filter-item">Food Item</label>
              <select
                id="filter-item"
                value={selectedInventoryId}
                onChange={(e) => setSelectedInventoryId(e.target.value)}
                className="advanced-select"
              >
                <option value="ALL">All Food Items</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.display_name}
                  </option>
                ))}
              </select>
            </div>

            {isFiltered && (
              <button type="button" className="btn-reset-filters" onClick={resetAllFilters}>
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* History Table Container */}
        {filteredHistory.length === 0 ? (
          <div className="history-empty-card">
            <div className="empty-icon-circle" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="36" height="36" stroke="#166534" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h4>No Temperature Records Yet</h4>
            <p>
              {isFiltered
                ? 'No recorded temperature checks match your current filter settings. Try adjusting or resetting the filters.'
                : 'Temperature checks will appear here after performing a manual probe check or simulation in the Temperature Checker.'}
            </p>
            {isFiltered ? (
              <button type="button" className="btn-empty-action" onClick={resetAllFilters}>
                Clear Active Filters
              </button>
            ) : (
              <Link to="/checker" className="btn-empty-action">
                Go to Temperature Checker
              </Link>
            )}
          </div>
        ) : (
          <div className="history-table-card">
            <div className="history-table-responsive">
              <table className="custom-history-table">
                <thead>
                  <tr>
                    <th>DATE &amp; TIME</th>
                    <th>FOOD ITEM</th>
                    <th>TEMPERATURE</th>
                    <th>STATUS</th>
                    <th>READING TYPE</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record) => {
                    const isExpanded = expandedHistoryIds.has(record.id);
                    return (
                      <React.Fragment key={record.id}>
                        <tr className={`history-table-row ${isExpanded ? 'row-expanded' : ''}`}>
                          {/* 1. Date & Time */}
                          <td>
                            <div className="table-datetime-cell">
                              <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                stroke="#64748B"
                                strokeWidth="2"
                                fill="none"
                                aria-hidden="true"
                              >
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              <span>{formatHistoryDateTime(record.checked_at)}</span>
                            </div>
                          </td>

                          {/* 2. Food Item */}
                          <td>
                            <strong className="table-food-name">{record.display_name}</strong>
                          </td>

                          {/* 3. Temperature */}
                          <td>
                            <strong className="table-temp-val">{formatTemp(record.recorded_temp_c)}</strong>
                          </td>

                          {/* 4. Status */}
                          <td>
                            <span
                              className={`history-status-pill ${record.status === 'WITHIN_LIMIT'
                                  ? 'pill-safe'
                                  : record.status === 'ABOVE_LIMIT'
                                    ? 'pill-danger'
                                    : 'pill-neutral'
                                }`}
                            >
                              <span className="status-dot" aria-hidden="true">
                                <svg viewBox="0 0 6 6" width="6" height="6" fill="currentColor">
                                  <circle cx="3" cy="3" r="3" />
                                </svg>
                              </span>
                              <span>
                                {record.status === 'WITHIN_LIMIT'
                                  ? 'Within Limit'
                                  : record.status === 'ABOVE_LIMIT'
                                    ? 'Above Limit'
                                    : 'No Limit'}
                              </span>
                            </span>
                          </td>

                          {/* 5. Reading Type */}
                          <td>
                            <div className="table-reading-type-cell">
                              {record.is_simulated ? (
                                <>
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="16"
                                    height="16"
                                    stroke="#64748B"
                                    strokeWidth="2.2"
                                    fill="none"
                                    aria-hidden="true"
                                  >
                                    <polyline points="16 3 21 3 21 8" />
                                    <line x1="4" y1="20" x2="21" y2="3" />
                                    <polyline points="21 16 21 21 16 21" />
                                    <line x1="15" y1="15" x2="21" y2="21" />
                                    <line x1="4" y1="4" x2="9" y2="9" />
                                  </svg>
                                  <span>Simulated</span>
                                </>
                              ) : (
                                <>
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="16"
                                    height="16"
                                    stroke="#64748B"
                                    strokeWidth="2.2"
                                    fill="none"
                                    aria-hidden="true"
                                  >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                  <span>Manual</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* 6. Actions */}
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-view-details"
                              onClick={() => toggleHistoryRow(record.id)}
                              aria-expanded={isExpanded}
                            >
                              <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                              <span className="action-arrow" aria-hidden="true">
                                {isExpanded ? '↑' : '→'}
                              </span>
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Finding & Storage Reference */}
                        {isExpanded && (
                          <tr className="history-expanded-row">
                            <td colSpan={6}>
                              <div className="expanded-detail-container">
                                <div className="expanded-col">
                                  <span className="expanded-label">Evaluation Finding</span>
                                  <p className="expanded-text">{record.message}</p>
                                </div>

                                <div className="expanded-col">
                                  <span className="expanded-label">Recommended Threshold</span>
                                  <p className="expanded-text">
                                    {record.max_temp_c !== null && record.max_temp_c !== undefined
                                      ? `≤ ${Number(record.max_temp_c).toFixed(1)}°C (${((Number(record.max_temp_c) * 9) / 5 + 32).toFixed(1)}°F)`
                                      : 'Ambient (Cool & Dry — No numerical limit)'}
                                  </p>
                                </div>

                                {record.reference_title && (
                                  <div className="expanded-col">
                                    <span className="expanded-label">Authority Reference Standard</span>
                                    {record.reference_url ? (
                                      <a
                                        href={record.reference_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="expanded-link"
                                      >
                                        {record.reference_title} ↗
                                      </a>
                                    ) : (
                                      <span className="expanded-text">{record.reference_title}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
