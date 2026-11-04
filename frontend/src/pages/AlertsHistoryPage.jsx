import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getAlerts, getTemperatureHistory, getInventory } from '../services/api';

/**
 * Format ISO datetime string to user-friendly local date & time.
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * Format date string (YYYY-MM-DD) to friendly format.
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const [year, month, day] = dateString.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export default function AlertsHistoryPage() {
  // Navigation tab: 'alerts' or 'history'
  const [activeTab, setActiveTab] = useState('alerts');

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

  // History filters
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedInventoryId, setSelectedInventoryId] = useState('ALL');
  const [recordLimit, setRecordLimit] = useState(50);

  // History expanded row tracking
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());

  // Global refresh indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Fetch alerts data
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

  // 2. Fetch history records with current filters
  const loadHistory = async (silent = false) => {
    if (!silent) setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const params = {
        limit: Number(recordLimit),
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

  // 3. Load active inventory items for history filter dropdown
  const loadFilterItems = async () => {
    try {
      const items = await getInventory();
      setInventoryItems(items || []);
    } catch {
      // Non-critical, filter dropdown will just omit custom list
    }
  };

  // Initial load
  useEffect(() => {
    loadAlerts();
    loadHistory();
    loadFilterItems();
  }, []);

  // Reload history when filters change
  useEffect(() => {
    loadHistory(false);
  }, [selectedStatus, selectedInventoryId, recordLimit]);

  // Unified refresh handler
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([loadAlerts(true), loadHistory(true), loadFilterItems()]);
    setIsRefreshing(false);
  };

  // Toggle expanded row for history table
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

  const tempWarnings = alertsData?.temperature_warnings || [];
  const expiryAlerts = alertsData?.expiry_alerts || [];
  const preservationTips = alertsData?.preservation_tips || [];
  const totalAlertsCount = tempWarnings.length + expiryAlerts.length;

  return (
    <div className="page-alerts">
      <PageHeading
        title="Alerts & Temperature History"
        subtitle="Monitor active temperature breaches, upcoming expiry notifications, category preservation tips, and historical check logs."
        action={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            title="Refresh alerts and temperature history"
          >
            <span className={isRefreshing ? 'spinner-icon' : ''}>🔄</span>
            {isRefreshing ? ' Refreshing...' : ' Refresh Data'}
          </button>
        }
      />

      {/* =================================================================== */}
      {/* Navigation Tabs Header                                              */}
      {/* =================================================================== */}
      <div className="alerts-tabs-nav" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <span className="tab-icon">🔔</span>
          <span>Active Alerts &amp; Preservation</span>
          {totalAlertsCount > 0 ? (
            <span className="tab-count-badge alert-count">{totalAlertsCount}</span>
          ) : (
            <span className="tab-count-badge zero-count">0</span>
          )}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">📜</span>
          <span>Temperature History Log</span>
          <span className="tab-count-badge neutral-count">{historyList.length}</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: ACTIVE ALERTS & PRESERVATION RECOMMENDATIONS                 */}
      {/* =================================================================== */}
      {activeTab === 'alerts' && (
        <div className="alerts-tab-content">
          {isLoadingAlerts ? (
            <LoadingState message="Loading active temperature warnings and expiry notifications..." />
          ) : alertsError ? (
            <ErrorState
              title="Unable to load alerts"
              message={alertsError}
              onRetry={() => loadAlerts(false)}
            />
          ) : (
            <>
              {/* Top Grid: Temperature Warnings & Expiry Alerts */}
              <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                {/* 1. Active Temperature Warnings */}
                <Card
                  title="Active Temperature Warnings"
                  subtitle="Monitored items whose latest recorded reading exceeded recommended maximum limits"
                  action={
                    tempWarnings.length > 0 && (
                      <span className="badge-count-danger">{tempWarnings.length} breach(es)</span>
                    )
                  }
                >
                  {tempWarnings.length === 0 ? (
                    <div className="placeholder-box" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>❄️</span>
                      <p className="primary" style={{ color: 'var(--status-safe-text)' }}>
                        No Active Temperature Warnings
                      </p>
                      <p className="secondary" style={{ maxWidth: '360px', margin: '0 auto 1.25rem' }}>
                        All active inventory items with recorded checks are currently within their recommended household temperature limits.
                      </p>
                      <Link to="/checker" className="btn btn-secondary btn-sm">
                        Go to Temperature Checker
                      </Link>
                    </div>
                  ) : (
                    <div className="alerts-card-list">
                      {tempWarnings.map((item) => (
                        <div key={item.inventory_id} className="alert-card-item breach-alert-card">
                          <div className="alert-card-header">
                            <div>
                              <h4 className="alert-food-title">{item.display_name}</h4>
                              <span className="alert-location-tag">
                                📍 {item.storage_location} • {item.storage_type}
                              </span>
                            </div>
                            <StatusBadge status="ABOVE_LIMIT" />
                          </div>

                          <div className="alert-temp-comparison">
                            <div className="temp-stat recorded">
                              <span className="stat-label">Recorded:</span>
                              <strong className="stat-value">{item.recorded_temp_c.toFixed(1)}&deg;C</strong>
                            </div>
                            <span className="stat-separator">vs</span>
                            <div className="temp-stat target">
                              <span className="stat-label">Recommended Max:</span>
                              <strong className="stat-value">
                                &le; {item.max_temp_c !== null ? item.max_temp_c.toFixed(1) : 'N/A'}&deg;C
                              </strong>
                            </div>
                          </div>

                          <div className="alert-message-box">
                            <p className="alert-msg-text">{item.message}</p>
                          </div>

                          <div className="alert-guidance-box">
                            <strong>💡 Storage Guidance:</strong>
                            <p>{item.storage_guidance}</p>
                          </div>

                          <div className="alert-card-footer">
                            <span className="alert-timestamp">Checked: {formatDateTime(item.checked_at)}</span>
                            {item.reference_title && (
                              <a
                                href={item.reference_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="citation-link"
                              >
                                {item.reference_title} ↗
                              </a>
                            )}
                            <Link to="/checker" className="btn btn-secondary btn-sm alert-action-btn">
                              Re-check Probe
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* 2. Upcoming & Overdue Expiry Alerts */}
                <Card
                  title="Upcoming &amp; Overdue Expiry Alerts"
                  subtitle="Stored items expiring within 3 days or already past their safe consumption date"
                  action={
                    expiryAlerts.length > 0 && (
                      <span className="badge-count-warn">{expiryAlerts.length} alert(s)</span>
                    )
                  }
                >
                  {expiryAlerts.length === 0 ? (
                    <div className="placeholder-box" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🥗</span>
                      <p className="primary" style={{ color: 'var(--status-safe-text)' }}>
                        No Pending Expiry Alerts
                      </p>
                      <p className="secondary" style={{ maxWidth: '360px', margin: '0 auto 1.25rem' }}>
                        All active inventory items are fresh and well within their safe consumption window.
                      </p>
                      <Link to="/inventory" className="btn btn-secondary btn-sm">
                        View Food Inventory
                      </Link>
                    </div>
                  ) : (
                    <div className="alerts-card-list">
                      {expiryAlerts.map((item) => {
                        const isExpired = item.expiry_status === 'EXPIRED';
                        return (
                          <div
                            key={item.inventory_id}
                            className={`alert-card-item ${isExpired ? 'expired-alert-card' : 'near-alert-card'}`}
                          >
                            <div className="alert-card-header">
                              <div>
                                <h4 className="alert-food-title">{item.display_name}</h4>
                                <span className="alert-location-tag">📍 {item.storage_location}</span>
                              </div>
                              <StatusBadge status={item.expiry_status} />
                            </div>

                            <div className="alert-expiry-timeline">
                              <div className="timeline-stat">
                                <span className="stat-label">Expiry Date:</span>
                                <strong>{formatDate(item.expiry_date)}</strong>
                              </div>
                              <div className="timeline-stat">
                                <span className="stat-label">Shelf-Life Status:</span>
                                <strong className={isExpired ? 'text-danger' : 'text-warn'}>
                                  {isExpired
                                    ? `Expired ${Math.abs(item.days_until_expiry)} day(s) ago`
                                    : item.days_until_expiry === 0
                                    ? 'Expires today'
                                    : item.days_until_expiry === 1
                                    ? 'Expires tomorrow'
                                    : `Expires in ${item.days_until_expiry} days`}
                                </strong>
                              </div>
                            </div>

                            <div className="alert-guidance-box">
                              <strong>💡 Guidance:</strong>
                              <p>{item.storage_guidance}</p>
                            </div>

                            <div className="alert-card-footer">
                              <span className="alert-timestamp">Purchased: {formatDate(item.purchase_date)}</span>
                              {item.reference_title && (
                                <a
                                  href={item.reference_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="citation-link"
                                >
                                  {item.reference_title} ↗
                                </a>
                              )}
                              <Link to="/inventory" className="btn btn-secondary btn-sm alert-action-btn">
                                Manage Item
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* 3. Tailored Preservation Recommendations Section */}
              <Card
                title="Verified Category Preservation Guidelines"
                subtitle="Storage advice and official standards tailored to the active categories currently in your inventory"
              >
                {preservationTips.length === 0 ? (
                  <div className="placeholder-box" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                    <p className="primary">No active food categories detected</p>
                    <p className="secondary">
                      Add food items to your inventory to view category-specific preservation advice from FoodSafety.gov &amp; USDA FSIS.
                    </p>
                  </div>
                ) : (
                  <div className="preservation-tips-grid">
                    {preservationTips.map((tip) => (
                      <div key={tip.category} className="preservation-tip-card">
                        <div className="tip-card-header">
                          <h4 className="tip-category-title">{tip.category}</h4>
                          <StatusBadge status={tip.storage_type} />
                        </div>
                        <div className="tip-location-row">
                          <span className="tip-label">Standard Location:</span>
                          <span className="tip-value">{tip.default_location}</span>
                        </div>
                        <p className="tip-guidance-text">{tip.storage_guidance}</p>
                        <div className="tip-citation-footer">
                          <span>Authority Standard: </span>
                          <a
                            href={tip.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="citation-link"
                          >
                            {tip.reference_title} ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: TEMPERATURE CHECK HISTORY AUDIT LOG                          */}
      {/* =================================================================== */}
      {activeTab === 'history' && (
        <div className="history-tab-content">
          <Card
            title="Temperature Check Audit History"
            subtitle="Chronological log of all recorded probe checks and simulated readings across active and archived items"
          >
            {/* Filter Bar */}
            <div className="history-filter-bar" style={{ marginBottom: '1.25rem' }}>
              {/* Status Filter */}
              <div className="filter-select-wrapper">
                <label htmlFor="history-status-filter" className="filter-label">
                  Evaluation Status:
                </label>
                <select
                  id="history-status-filter"
                  className="filter-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="WITHIN_LIMIT">Within Limit (Compliant)</option>
                  <option value="ABOVE_LIMIT">Above Limit (Warning)</option>
                  <option value="NO_LIMIT">No Limit (Ambient)</option>
                </select>
              </div>

              {/* Food Item Filter */}
              <div className="filter-select-wrapper">
                <label htmlFor="history-item-filter" className="filter-label">
                  Food Item:
                </label>
                <select
                  id="history-item-filter"
                  className="filter-select"
                  value={selectedInventoryId}
                  onChange={(e) => setSelectedInventoryId(e.target.value)}
                >
                  <option value="ALL">All Food Items</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name} (ID: {item.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Limit Selector */}
              <div className="filter-select-wrapper">
                <label htmlFor="history-limit-select" className="filter-label">
                  Record Limit:
                </label>
                <select
                  id="history-limit-select"
                  className="filter-select"
                  value={recordLimit}
                  onChange={(e) => setRecordLimit(Number(e.target.value))}
                >
                  <option value={25}>25 records</option>
                  <option value={50}>50 records</option>
                  <option value={100}>100 records</option>
                  <option value={200}>200 records</option>
                </select>
              </div>

              {/* Reset Filters Button */}
              {(selectedStatus !== 'ALL' || selectedInventoryId !== 'ALL' || recordLimit !== 50) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedStatus('ALL');
                    setSelectedInventoryId('ALL');
                    setRecordLimit(50);
                  }}
                  style={{ padding: '0.45rem 0.75rem' }}
                >
                  Reset Filters
                </button>
              )}

              <div className="filter-counter">
                Showing <strong>{historyList.length}</strong> check(s)
              </div>
            </div>

            {/* Table Content */}
            {isLoadingHistory ? (
              <LoadingState message="Loading historical temperature checks..." />
            ) : historyError ? (
              <ErrorState
                title="Unable to load history"
                message={historyError}
                onRetry={() => loadHistory(false)}
              />
            ) : historyList.length === 0 ? (
              <div className="placeholder-box" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
                <p className="primary">No Temperature Checks Found</p>
                <p className="secondary" style={{ maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                  No historical records match your filter criteria. Perform manual temperature evaluations or demo simulations on the Temperature Checker page.
                </p>
                <Link to="/checker" className="btn btn-primary btn-sm">
                  Go to Temperature Checker
                </Link>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="inventory-table history-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Checked Timestamp</th>
                      <th>Food Item</th>
                      <th>Storage Location</th>
                      <th>Recorded Temp</th>
                      <th>Target Limit</th>
                      <th>Status</th>
                      <th>Reading Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((record) => {
                      const isExpanded = expandedHistoryIds.has(record.id);
                      return (
                        <React.Fragment key={record.id}>
                          <tr
                            className={`inventory-row ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => toggleHistoryRow(record.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <button
                                type="button"
                                className="btn-row-toggle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleHistoryRow(record.id);
                                }}
                                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            </td>
                            <td>
                              <span className="history-timestamp">{formatDateTime(record.checked_at)}</span>
                            </td>
                            <td>
                              <div className="food-name-cell">
                                <span className="display-name">{record.display_name}</span>
                                <span className="base-cat-name">Item #{record.inventory_id}</span>
                              </div>
                            </td>
                            <td>{record.storage_location}</td>
                            <td>
                              <strong className="qty-cell">{record.recorded_temp_c.toFixed(1)}&deg;C</strong>
                            </td>
                            <td>
                              {record.max_temp_c !== null && record.max_temp_c !== undefined
                                ? `≤ ${record.max_temp_c.toFixed(1)}°C`
                                : 'No numerical limit'}
                            </td>
                            <td>
                              <StatusBadge status={record.status} />
                            </td>
                            <td>
                              <span
                                className={`badge-reading-type ${
                                  record.is_simulated ? 'type-simulated' : 'type-manual'
                                }`}
                              >
                                {record.is_simulated ? 'Demo Simulation' : 'Manual Probe'}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded row with finding message and authority reference */}
                          {isExpanded && (
                            <tr className="expanded-row">
                              <td colSpan={8}>
                                <div className="history-expanded-detail">
                                  <div className="detail-section">
                                    <strong>Authoritative Evaluation Message</strong>
                                    <p className="detail-message-text">{record.message}</p>
                                  </div>

                                  {record.reference_title && (
                                    <div className="detail-section citation-section">
                                      <strong>Verified Authority Standard</strong>
                                      {record.reference_url ? (
                                        <a
                                          href={record.reference_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="citation-link"
                                        >
                                          {record.reference_title} ↗
                                        </a>
                                      ) : (
                                        <span>{record.reference_title}</span>
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
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
