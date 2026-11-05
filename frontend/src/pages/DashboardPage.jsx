import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getDashboard, getAlerts } from '../services/api';

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

function getFoodEmoji(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('milk')) return '🥛';
  if (lower.includes('apple')) return '🍎';
  if (lower.includes('yogurt')) return '🥫';
  if (lower.includes('chicken') || lower.includes('meat') || lower.includes('beef')) return '🍗';
  if (lower.includes('fish') || lower.includes('salmon')) return '🐟';
  if (lower.includes('spinach') || lower.includes('produce') || lower.includes('salad') || lower.includes('vegetable')) return '🥬';
  if (lower.includes('egg')) return '🥚';
  if (lower.includes('rice') || lower.includes('pasta') || lower.includes('bread')) return '🍞';
  return '📦';
}

function getActivityIcon(actionType) {
  switch (actionType) {
    case 'ITEM_ADDED':
      return { icon: '+', className: 'act-icon-add' };
    case 'TEMP_CHECKED':
      return { icon: '🌡️', className: 'act-icon-temp' };
    case 'ITEM_UPDATED':
      return { icon: '✏️', className: 'act-icon-edit' };
    case 'ITEM_DELETED':
      return { icon: '🗑️', className: 'act-icon-del' };
    default:
      return { icon: '📋', className: 'act-icon-default' };
  }
}

function getActivityHeading(actionType) {
  switch (actionType) {
    case 'ITEM_ADDED':
      return 'Item Added';
    case 'TEMP_CHECKED':
      return 'Temperature Checked';
    case 'ITEM_UPDATED':
      return 'Item Updated';
    case 'ITEM_DELETED':
      return 'Item Deleted';
    default:
      return 'Activity';
  }
}

function cleanActivityDescription(desc = '', actionType = '') {
  const prefix = `${getActivityHeading(actionType)}: `;
  if (desc.startsWith(prefix)) {
    return desc.slice(prefix.length);
  }
  return desc.replace(/^(Added|Updated details for inventory item|Removed|Simulated temperature check|Manual temperature check)\s*/i, '');
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const [dash, alerts] = await Promise.all([getDashboard(), getAlerts()]);
      setDashboardData(dash);
      setAlertsData(alerts);
    } catch (err) {
      setFetchError(err.message || 'Failed to load dashboard data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="page-dashboard">
        <div className="dashboard-page-heading">
          <h2>Dashboard</h2>
          <p>Real-time overview of stored food items, expiry notifications, temperature warnings, and recent activity.</p>
        </div>
        <LoadingState message="Loading dashboard metrics and active storage conditions..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="page-dashboard">
        <div className="dashboard-page-heading">
          <h2>Dashboard</h2>
          <p>Real-time overview of stored food items, expiry notifications, temperature warnings, and recent activity.</p>
        </div>
        <ErrorState
          title="Unable to load dashboard"
          message={fetchError}
          onRetry={() => loadDashboardData()}
        />
      </div>
    );
  }

  const totalItems = dashboardData?.total_active_items ?? 0;
  const expiringSoonCount = dashboardData?.expiring_soon_count ?? 0;
  const expiredCount = dashboardData?.expired_count ?? 0;
  const tempWarningCount = dashboardData?.temperature_warning_count ?? 0;
  const recentActivities = dashboardData?.recent_activity || [];

  const tempWarnings = alertsData?.temperature_warnings || [];
  const expiryAlerts = alertsData?.expiry_alerts || [];

  const hasUrgentAttentionItems = tempWarningCount > 0 || expiredCount > 0 || expiringSoonCount > 0;

  return (
    <div className="page-dashboard">
      {/* =================================================================== */}
      {/* 1. Page Heading                                                     */}
      {/* =================================================================== */}
      <div className="dashboard-page-heading">
        <h2>Dashboard</h2>
        <p>Real-time overview of stored food items, expiry notifications, temperature warnings, and recent activity.</p>
      </div>

      {/* =================================================================== */}
      {/* 2. Dark Green Hero Overview Banner                                  */}
      {/* =================================================================== */}
      <div className="system-status-hero">
        <div className="hero-top-bar">
          <div className="hero-title-group">
            <div className="hero-icon-shield">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="hero-heading">System Status Overview</h3>
              <p className="hero-subheading">
                Live monitoring of active food storage metrics and temperature safety conditions.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Metric Cards inside the Hero */}
        <div className="hero-metrics-grid">
          {/* Card 1: Total Stored */}
          <Link to="/inventory" className="hero-stat-card">
            <div className="stat-circle stat-circle-green">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div className="stat-value">{totalItems}</div>
            <div className="stat-label">Total Food Items</div>
            <div className="stat-link">View Inventory →</div>
          </Link>

          {/* Card 2: Expiring Soon */}
          <Link to="/alerts" className="hero-stat-card">
            <div className="stat-circle stat-circle-amber">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-value">{expiringSoonCount}</div>
            <div className="stat-label">Expiring Soon</div>
            <div className="stat-link">View Alerts →</div>
          </Link>

          {/* Card 3: Expired Items */}
          <Link to="/alerts" className="hero-stat-card">
            <div className="stat-circle stat-circle-red">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="stat-value">{expiredCount}</div>
            <div className="stat-label">Expired Items</div>
            <div className="stat-link">View Alerts →</div>
          </Link>

          {/* Card 4: Temperature Warnings */}
          <Link to="/alerts" className="hero-stat-card">
            <div className="stat-circle stat-circle-coral">
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
              </svg>
            </div>
            <div className="stat-value">{tempWarningCount}</div>
            <div className="stat-label">Temperature Warnings</div>
            <div className="stat-link">View Alerts →</div>
          </Link>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. Quick Actions Bar                                                */}
      {/* =================================================================== */}
      <div className="dashboard-quick-actions-row">
        <Link to="/inventory" className="qa-card">
          <div className="qa-circle qa-circle-green">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div className="qa-body">
            <strong>Manage Food Inventory</strong>
            <p>Browse catalogue, add new items, and edit locations.</p>
          </div>
          <span className="qa-arrow-icon">→</span>
        </Link>

        <Link to="/checker" className="qa-card">
          <div className="qa-circle qa-circle-blue">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
          </div>
          <div className="qa-body">
            <strong>Check Temperatures</strong>
            <p>Record manual probe readings or run simulations.</p>
          </div>
          <span className="qa-arrow-icon">→</span>
        </Link>

        <Link to="/alerts" className="qa-card">
          <div className="qa-circle qa-circle-amber">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className="qa-body">
            <strong>View Alerts &amp; History</strong>
            <p>Review warnings, upcoming expirations, and history logs.</p>
          </div>
          <span className="qa-arrow-icon">→</span>
        </Link>
      </div>

      {/* =================================================================== */}
      {/* 3. Attention Items & Recent Activity (2-Column Grid)               */}
      {/* =================================================================== */}
      <div className="dashboard-two-col-grid">
        {/* Left Column: Items Requiring Attention */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="section-title-icon text-amber">⚠️</span>
              <h3 className="dash-card-title">Items Requiring Attention</h3>
            </div>
            <Link to="/alerts" className="dash-card-link">
              View All →
            </Link>
          </div>

          <div className="attention-rows-container">
            {/* 1. Temperature warnings */}
            {tempWarnings.map((item) => (
              <div key={`temp-${item.inventory_id}`} className="attention-clean-row breach-row">
                <div className="food-avatar-box">{getFoodEmoji(item.display_name)}</div>
                <div className="attention-text-col">
                  <div className="tag-pill tag-temperature">TEMPERATURE</div>
                  <h4 className="food-item-name">{item.display_name}</h4>
                  <p className="food-item-sub">
                    {item.storage_location} • {item.recorded_temp_c.toFixed(1)}°C (max {item.max_temp_c?.toFixed(1) ?? '4.0'}°C)
                  </p>
                </div>
                <div className="attention-right-col">
                  <span className="status-pill status-pill-danger">
                    <span className="pill-dot">!</span> High Risk
                  </span>
                  <Link to="/checker" className="btn-action-outline">
                    Re-check
                  </Link>
                </div>
              </div>
            ))}

            {/* 2. Near Expiry items */}
            {expiryAlerts
              .filter((item) => item.expiry_status === 'NEAR_EXPIRY')
              .map((item) => (
                <div key={`near-${item.inventory_id}`} className="attention-clean-row near-row">
                  <div className="food-avatar-box">{getFoodEmoji(item.display_name)}</div>
                  <div className="attention-text-col">
                    <div className="tag-pill tag-near">NEAR EXPIRY</div>
                    <h4 className="food-item-name">{item.display_name}</h4>
                    <p className="food-item-sub">
                      {item.storage_location} • expires in {item.days_until_expiry} day{item.days_until_expiry === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="attention-right-col">
                    <span className="status-pill status-pill-warn">
                      <span className="pill-icon">🕒</span> {item.days_until_expiry} days
                    </span>
                    <Link to="/inventory" className="btn-action-outline">
                      Manage
                    </Link>
                  </div>
                </div>
              ))}

            {/* 3. Expired items */}
            {expiryAlerts
              .filter((item) => item.expiry_status === 'EXPIRED')
              .map((item) => (
                <div key={`exp-${item.inventory_id}`} className="attention-clean-row expired-row">
                  <div className="food-avatar-box">{getFoodEmoji(item.display_name)}</div>
                  <div className="attention-text-col">
                    <div className="tag-pill tag-expired">EXPIRED</div>
                    <h4 className="food-item-name">{item.display_name}</h4>
                    <p className="food-item-sub">
                      {item.storage_location} • expired {Math.abs(item.days_until_expiry)} day{Math.abs(item.days_until_expiry) === 1 ? '' : 's'} ago
                    </p>
                  </div>
                  <div className="attention-right-col">
                    <span className="status-pill status-pill-danger">
                      <span className="pill-icon">✖</span> Expired
                    </span>
                    <Link to="/inventory" className="btn-action-outline">
                      Manage
                    </Link>
                  </div>
                </div>
              ))}

            {!hasUrgentAttentionItems && (
              <div className="empty-attention-box">
                <span className="empty-icon">🛡️</span>
                <h4>All Stored Food Items Optimal</h4>
                <p>No active temperature warnings or upcoming expirations.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Activity */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <span className="section-title-icon text-green">🕒</span>
              <h3 className="dash-card-title">Recent Activity</h3>
            </div>
            <Link to="/alerts" className="dash-card-link">
              View History →
            </Link>
          </div>

          <div className="activity-timeline-list">
            {recentActivities.map((log) => {
              const { icon, className } = getActivityIcon(log.action_type);
              const heading = getActivityHeading(log.action_type);
              const detail = cleanActivityDescription(log.description, log.action_type);

              return (
                <div key={log.id} className="activity-row">
                  <div className={`activity-circle ${className}`}>
                    {icon}
                  </div>
                  <div className="activity-body">
                    <div className="activity-heading-line">
                      <strong className="activity-title">{heading}</strong>
                      <span className="activity-time">{formatDateTime(log.created_at)}</span>
                    </div>
                    <p className="activity-detail">{detail}</p>
                  </div>
                </div>
              );
            })}

            {recentActivities.length === 0 && (
              <div className="empty-attention-box">
                <p>No activity recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. Storage Safety Standards (Bottom 4 Cards)                        */}
      {/* =================================================================== */}
      <div className="dash-card standards-section">
        <div className="dash-card-header">
          <div className="dash-card-title-group">
            <span className="section-title-icon text-green">🛡️</span>
            <h3 className="dash-card-title">Storage Safety Standards</h3>
          </div>
          <a
            href="https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-card-link"
          >
            Learn More ↗
          </a>
        </div>

        <div className="standards-cards-grid">
          {/* Refrigerator Card */}
          <div className="standard-card">
            <div className="standard-icon-box text-blue">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="5" y1="10" x2="19" y2="10" />
                <line x1="9" y1="6" x2="9" y2="8" />
                <line x1="9" y1="14" x2="9" y2="16" />
              </svg>
            </div>
            <div className="standard-content">
              <h4>Refrigerator</h4>
              <p className="standard-temp">≤ 4.0°C (40°F)</p>
              <p className="standard-desc">Prevents rapid pathogen growth.</p>
              <a
                href="https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts"
                target="_blank"
                rel="noopener noreferrer"
                className="standard-link"
              >
                FoodSafety.gov ↗
              </a>
            </div>
          </div>

          {/* Freezer Card */}
          <div className="standard-card">
            <div className="standard-icon-box text-blue">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
              </svg>
            </div>
            <div className="standard-content">
              <h4>Freezer</h4>
              <p className="standard-temp">≤ -18.0°C (0°F)</p>
              <p className="standard-desc">Halts bacterial growth while frozen.</p>
              <a
                href="https://ask.fsis.usda.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="standard-link"
              >
                USDA FSIS ↗
              </a>
            </div>
          </div>

          {/* Pantry Card */}
          <div className="standard-card">
            <div className="standard-icon-box text-orange">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="standard-content">
              <h4>Pantry</h4>
              <p className="standard-temp">Cool &amp; Dry</p>
              <p className="standard-desc">Keep in a cool, dry place.</p>
              <a
                href="https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety"
                target="_blank"
                rel="noopener noreferrer"
                className="standard-link"
              >
                FoodSafety.gov ↗
              </a>
            </div>
          </div>

          {/* 2-Hour Danger Zone Card */}
          <div className="standard-card danger-zone-card">
            <div className="standard-icon-box text-green">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="standard-content">
              <h4>2-Hour Danger Zone</h4>
              <p className="standard-temp text-dark">4.4°C – 60°C (40°F – 140°F)</p>
              <p className="standard-desc">
                Do not leave perishable food in this range for more than 2 hours.
              </p>
              <div className="danger-zone-footer">
                <span className="info-badge">ℹ️</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
