import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getDashboard, getAlerts } from '../services/api';

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
 * Map action_type to an appropriate icon.
 */
function getActionIcon(actionType) {
  switch (actionType) {
    case 'ITEM_ADDED':
      return '➕';
    case 'ITEM_UPDATED':
      return '✏️';
    case 'ITEM_DELETED':
      return '🗑️';
    case 'TEMP_CHECKED':
      return '🌡️';
    default:
      return '📋';
  }
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch dashboard summary and active alerts
  const loadDashboardData = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setFetchError(null);

    try {
      const [dash, alerts] = await Promise.all([getDashboard(), getAlerts()]);
      setDashboardData(dash);
      setAlertsData(alerts);
    } catch (err) {
      setFetchError(err.message || 'Failed to load dashboard data from backend.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="page-dashboard">
        <PageHeading
          title="Dashboard"
          subtitle="Real-time overview of stored food items, expiry notifications, temperature warnings, and recent activity."
        />
        <LoadingState message="Loading dashboard metrics and active storage conditions..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="page-dashboard">
        <PageHeading
          title="Dashboard"
          subtitle="Real-time overview of stored food items, expiry notifications, temperature warnings, and recent activity."
        />
        <ErrorState
          title="Unable to load dashboard"
          message={fetchError}
          onRetry={() => loadDashboardData(false)}
        />
      </div>
    );
  }

  // Derive counts and lists safely from backend data
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
      <PageHeading
        title="Dashboard"
        subtitle="Real-time overview of stored food items, expiry notifications, temperature warnings, and recent activity."
        action={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            title="Refresh dashboard data from backend"
          >
            <span className={isRefreshing ? 'spinner-icon' : ''}>🔄</span>
            {isRefreshing ? ' Refreshing...' : ' Refresh Data'}
          </button>
        }
      />

      {/* =================================================================== */}
      {/* 1. Summary Metric Cards                                             */}
      {/* =================================================================== */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {/* Total Active Items */}
        <Link to="/inventory" className="metric-card-link">
          <Card className="metric-card">
            <div className="metric-header">
              <span className="metric-icon icon-primary">📦</span>
              <span className="metric-nav-arrow">→</span>
            </div>
            <div className="metric-body">
              <span className="metric-number">{totalItems}</span>
              <span className="metric-label">Total Stored Items</span>
              <span className="metric-subtext">Active household inventory</span>
            </div>
          </Card>
        </Link>

        {/* Expiring Soon */}
        <Link to="/alerts" className="metric-card-link">
          <Card className={`metric-card ${expiringSoonCount > 0 ? 'card-accent-warn' : ''}`}>
            <div className="metric-header">
              <span className="metric-icon icon-warn">⏰</span>
              {expiringSoonCount > 0 && <StatusBadge status="NEAR_EXPIRY" />}
            </div>
            <div className="metric-body">
              <span className="metric-number">{expiringSoonCount}</span>
              <span className="metric-label">Expiring Soon</span>
              <span className="metric-subtext">Within next 3 days</span>
            </div>
          </Card>
        </Link>

        {/* Expired Items */}
        <Link to="/alerts" className="metric-card-link">
          <Card className={`metric-card ${expiredCount > 0 ? 'card-accent-danger' : ''}`}>
            <div className="metric-header">
              <span className="metric-icon icon-danger">⚠️</span>
              {expiredCount > 0 && <StatusBadge status="EXPIRED" />}
            </div>
            <div className="metric-body">
              <span className="metric-number">{expiredCount}</span>
              <span className="metric-label">Expired Items</span>
              <span className="metric-subtext">Safe disposal required</span>
            </div>
          </Card>
        </Link>

        {/* Temperature Warnings */}
        <Link to="/alerts" className="metric-card-link">
          <Card className={`metric-card ${tempWarningCount > 0 ? 'card-accent-breach' : ''}`}>
            <div className="metric-header">
              <span className="metric-icon icon-breach">🌡️</span>
              {tempWarningCount > 0 ? (
                <StatusBadge status="ABOVE_LIMIT" label="Active Alert" />
              ) : (
                <StatusBadge status="WITHIN_LIMIT" label="Compliant" />
              )}
            </div>
            <div className="metric-body">
              <span className="metric-number">{tempWarningCount}</span>
              <span className="metric-label">Temperature Warnings</span>
              <span className="metric-subtext">Exceeds recommended limit</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* =================================================================== */}
      {/* 2. Quick Actions Bar                                                */}
      {/* =================================================================== */}
      <div className="dashboard-quick-actions-grid" style={{ marginBottom: '1.5rem' }}>
        <Link to="/inventory" className="quick-action-card">
          <div className="qa-icon">➕</div>
          <div className="qa-content">
            <strong>Manage Food Inventory</strong>
            <p>Browse catalogue, add new food items, edit locations, and track quantities.</p>
          </div>
          <span className="qa-arrow">→</span>
        </Link>

        <Link to="/checker" className="quick-action-card">
          <div className="qa-icon">🌡️</div>
          <div className="qa-content">
            <strong>Check Temperatures</strong>
            <p>Record manual probe readings or run demonstration simulations against official thresholds.</p>
          </div>
          <span className="qa-arrow">→</span>
        </Link>

        <Link to="/alerts" className="quick-action-card">
          <div className="qa-icon">🔔</div>
          <div className="qa-content">
            <strong>View Alerts &amp; History</strong>
            <p>Review active warnings, upcoming expirations, preservation tips, and full audit logs.</p>
          </div>
          <span className="qa-arrow">→</span>
        </Link>
      </div>

      {/* =================================================================== */}
      {/* 3. Main Dashboard Grid (Attention Items & Recent Activity)          */}
      {/* =================================================================== */}
      <div className="grid-2">
        {/* Left Column: Items Requiring Attention */}
        <Card
          title="Items Requiring Attention"
          subtitle="Active temperature breaches, expired items, and upcoming shelf-life limits"
          action={
            hasUrgentAttentionItems && (
              <Link to="/alerts" className="card-action-link">
                View all in Alerts →
              </Link>
            )
          }
        >
          {!hasUrgentAttentionItems ? (
            <div className="placeholder-box" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🛡️</span>
              <p className="primary" style={{ color: 'var(--status-safe-text)' }}>
                All Stored Food Items Optimal
              </p>
              <p className="secondary" style={{ maxWidth: '380px', margin: '0 auto 1.25rem' }}>
                No active temperature warnings or upcoming expirations. Storage environments are complying with food safety guidelines.
              </p>
              <Link to="/inventory" className="btn btn-secondary btn-sm">
                View Active Inventory
              </Link>
            </div>
          ) : (
            <div className="attention-items-list">
              {/* Active Temperature Warnings */}
              {tempWarnings.map((item) => (
                <div key={`temp-${item.inventory_id}`} className="attention-item-row breach-row">
                  <div className="attention-icon">🌡️</div>
                  <div className="attention-details">
                    <div className="attention-header">
                      <strong>{item.display_name}</strong>
                      <StatusBadge status="ABOVE_LIMIT" />
                    </div>
                    <p className="attention-meta">
                      Recorded: <strong>{item.recorded_temp_c.toFixed(1)}°C</strong> (Limit: ≤ {item.max_temp_c?.toFixed(1) ?? 'N/A'}°C) • Location: {item.storage_location}
                    </p>
                    <p className="attention-message">{item.message}</p>
                  </div>
                  <Link
                    to="/checker"
                    className="btn btn-secondary btn-sm attention-action-btn"
                    title="Evaluate temperature reading"
                  >
                    Check
                  </Link>
                </div>
              ))}

              {/* Expired Items */}
              {expiryAlerts
                .filter((item) => item.expiry_status === 'EXPIRED')
                .map((item) => (
                  <div key={`exp-${item.inventory_id}`} className="attention-item-row expired-row">
                    <div className="attention-icon">⚠️</div>
                    <div className="attention-details">
                      <div className="attention-header">
                        <strong>{item.display_name}</strong>
                        <StatusBadge status="EXPIRED" />
                      </div>
                      <p className="attention-meta">
                        Expired {Math.abs(item.days_until_expiry)} day(s) ago ({item.expiry_date}) • Location: {item.storage_location}
                      </p>
                    </div>
                    <Link
                      to="/inventory"
                      className="btn btn-secondary btn-sm attention-action-btn"
                      title="Manage expired item in inventory"
                    >
                      Manage
                    </Link>
                  </div>
                ))}

              {/* Near Expiry Items */}
              {expiryAlerts
                .filter((item) => item.expiry_status === 'NEAR_EXPIRY')
                .map((item) => (
                  <div key={`near-${item.inventory_id}`} className="attention-item-row near-row">
                    <div className="attention-icon">⏰</div>
                    <div className="attention-details">
                      <div className="attention-header">
                        <strong>{item.display_name}</strong>
                        <StatusBadge status="NEAR_EXPIRY" />
                      </div>
                      <p className="attention-meta">
                        Expires {item.days_until_expiry === 0 ? 'today' : item.days_until_expiry === 1 ? 'tomorrow' : `in ${item.days_until_expiry} days`} ({item.expiry_date}) • Location: {item.storage_location}
                      </p>
                    </div>
                    <Link
                      to="/inventory"
                      className="btn btn-secondary btn-sm attention-action-btn"
                      title="View item in inventory"
                    >
                      View
                    </Link>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Right Column: Recent Activity Audit Feed */}
        <Card
          title="Recent Storage Activity"
          subtitle="Chronological audit log of inventory changes, updates, and temperature checks"
          action={
            recentActivities.length > 0 && (
              <Link to="/alerts" className="card-action-link">
                View History →
              </Link>
            )
          }
        >
          {recentActivities.length === 0 ? (
            <div className="placeholder-box" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
              <p className="primary">No Activity Recorded Yet</p>
              <p className="secondary" style={{ maxWidth: '380px', margin: '0 auto 1.25rem' }}>
                Actions such as adding inventory items, editing locations, and performing temperature checks will be recorded here automatically.
              </p>
              <Link to="/inventory" className="btn btn-primary btn-sm">
                Add First Food Item
              </Link>
            </div>
          ) : (
            <div className="activity-feed-list">
              {recentActivities.map((log) => (
                <div key={log.id} className="activity-feed-item">
                  <span className="activity-action-icon">{getActionIcon(log.action_type)}</span>
                  <div className="activity-content">
                    <p className="activity-description">{log.description}</p>
                    <div className="activity-meta">
                      <span className="activity-type-tag">
                        {log.action_type.replace('_', ' ')}
                      </span>
                      <span className="activity-timestamp">{formatDateTime(log.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* =================================================================== */}
      {/* 4. Safety & Storage Temperature Benchmarks Reference                */}
      {/* =================================================================== */}
      <Card
        title="Household Storage Safety Standards"
        subtitle="Official temperature thresholds based on FoodSafety.gov & USDA FSIS guidelines"
        className="mt-4"
      >
        <div className="placeholder-list">
          <div className="placeholder-row">
            <div>
              <strong>Household Refrigerator Threshold: &le; 4.0&deg;C (40.0&deg;F)</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Prevents rapid pathogen proliferation in raw meats, poultry, seafood, dairy, and leftovers.
              </div>
            </div>
            <StatusBadge status="REFRIGERATED" />
          </div>

          <div className="placeholder-row">
            <div>
              <strong>Household Freezer Threshold: &le; -18.0&deg;C (0.0&deg;F)</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Halts microbial activity completely, maintaining long-term food safety.
              </div>
            </div>
            <StatusBadge status="FROZEN" />
          </div>

          <div className="placeholder-row">
            <div>
              <strong>Ambient Pantry Storage: Cool &amp; Dry</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                No universal numerical limit; storage requires airtight sealing away from heat and humidity.
              </div>
            </div>
            <StatusBadge status="AMBIENT" />
          </div>
        </div>
      </Card>
    </div>
  );
}
