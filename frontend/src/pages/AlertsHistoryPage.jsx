import React from 'react';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

export default function AlertsHistoryPage() {
  return (
    <div className="page-alerts">
      <PageHeading
        title="Alerts & History"
        subtitle="Monitor active temperature warnings, upcoming expiry notifications, preservation tips, and historical check logs."
      />

      {/* Phase notice */}
      <Card variant="note-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔔</span>
          <div>
            <strong>Phase 3 Foundation Shell</strong>
            <p style={{ fontSize: '0.875rem', marginTop: '2px', color: 'var(--color-text-muted)' }}>
              Alerts and history route initialized. Active temperature warnings, near-expiry alerts, tailored preservation tips, and filterable check history will be implemented in Phase 6.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid-2">
        {/* Active Temperature Warnings Shell */}
        <Card
          title="Active Temperature Warnings"
          subtitle="Items whose most recent check exceeded safe storage limits"
        >
          <div className="placeholder-box">
            <p className="primary">No active temperature alerts</p>
            <p className="secondary">
              Items flagged with <StatusBadge status="ABOVE_LIMIT" /> will appear here with corrective guidance.
            </p>
          </div>
        </Card>

        {/* Expiry Alerts Shell */}
        <Card
          title="Upcoming Expiry Alerts"
          subtitle="Stored items expiring within 3 days or already expired"
        >
          <div className="placeholder-box">
            <p className="primary">No pending expiry alerts</p>
            <p className="secondary">
              Items marked <StatusBadge status="NEAR_EXPIRY" /> or <StatusBadge status="EXPIRED" /> will appear here.
            </p>
          </div>
        </Card>
      </div>

      {/* Tailored Preservation Tips Shell */}
      <Card
        title="Preservation Tips & Citations"
        subtitle="Tailored storage recommendations for categories currently in your active inventory"
      >
        <div className="placeholder-box">
          <p className="primary">Preservation Recommendations</p>
          <p className="secondary">
            Category-specific food storage guidance and official citations from FoodSafety.gov &amp; USDA FSIS via <code>GET /api/alerts</code>.
          </p>
        </div>
      </Card>

      {/* Temperature History Shell */}
      <Card
        title="Temperature Check History"
        subtitle="Complete chronological audit log of manual and simulated readings"
      >
        <div className="placeholder-box">
          <p className="primary">Check History Log</p>
          <p className="secondary">
            Filterable historical table (by item ID and compliance status) connecting to <code>GET /api/temperature/history</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}

