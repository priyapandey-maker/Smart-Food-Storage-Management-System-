import React from 'react';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
  return (
    <div className="page-dashboard">
      <PageHeading
        title="Dashboard"
        subtitle="Overview of stored food items, expiry alerts, temperature warnings, and recent storage activity."
      />

      {/* Development / Phase notice */}
      <Card variant="note-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📌</span>
          <div>
            <strong>Phase 3 Foundation Shell</strong>
            <p style={{ fontSize: '0.875rem', marginTop: '2px', color: 'var(--color-text-muted)' }}>
              Layout and route structure initialized. Live dashboard metric cards, active warning counters, and recent activity logs will be connected in Phase 6.
            </p>
          </div>
        </div>
      </Card>

      {/* Summary Metrics Shell */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <Card title="Total Active Items" subtitle="Stored household items">
          <div className="placeholder-box" style={{ padding: '1.25rem 1rem' }}>
            <p className="primary">—</p>
            <p className="secondary">Awaiting Phase 6 integration</p>
          </div>
        </Card>

        <Card title="Expiring Soon" subtitle="Within 3 days">
          <div className="placeholder-box" style={{ padding: '1.25rem 1rem' }}>
            <p className="primary">—</p>
            <p className="secondary">
              <StatusBadge status="NEAR_EXPIRY" />
            </p>
          </div>
        </Card>

        <Card title="Expired Items" subtitle="Needs removal">
          <div className="placeholder-box" style={{ padding: '1.25rem 1rem' }}>
            <p className="primary">—</p>
            <p className="secondary">
              <StatusBadge status="EXPIRED" />
            </p>
          </div>
        </Card>

        <Card title="Temperature Alerts" subtitle="Exceeds safe limit">
          <div className="placeholder-box" style={{ padding: '1.25rem 1rem' }}>
            <p className="primary">—</p>
            <p className="secondary">
              <StatusBadge status="ABOVE_LIMIT" />
            </p>
          </div>
        </Card>
      </div>

      <div className="grid-2">
        {/* Safety & Storage Overview Shell */}
        <Card
          title="Safety & Storage Overview"
          subtitle="Monitored temperature limits across household locations"
        >
          <div className="placeholder-list">
            <div className="placeholder-row">
              <span>Refrigerator (&le; 4.0&deg;C)</span>
              <StatusBadge status="REFRIGERATED" />
            </div>
            <div className="placeholder-row">
              <span>Freezer (&le; -18.0&deg;C)</span>
              <StatusBadge status="FROZEN" />
            </div>
            <div className="placeholder-row">
              <span>Pantry (Cool &amp; Dry)</span>
              <StatusBadge status="AMBIENT" />
            </div>
          </div>
        </Card>

        {/* Recent Activity Feed Shell */}
        <Card
          title="Recent Activity Feed"
          subtitle="Audit log of inventory additions, checks, and updates"
        >
          <div className="placeholder-box">
            <p className="primary">No activity recorded yet</p>
            <p className="secondary">
              Events such as ITEM_ADDED, TEMP_CHECKED, and ITEM_UPDATED will appear here once connected.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

