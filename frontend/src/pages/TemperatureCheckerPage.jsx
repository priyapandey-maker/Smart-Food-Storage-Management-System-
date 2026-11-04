import React from 'react';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

export default function TemperatureCheckerPage() {
  return (
    <div className="page-checker">
      <PageHeading
        title="Temperature Checker"
        subtitle="Compare manual or simulated storage temperatures against verified household food-safety limits."
      />

      {/* Phase notice */}
      <Card variant="note-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🌡️</span>
          <div>
            <strong>Phase 3 Foundation Shell</strong>
            <p style={{ fontSize: '0.875rem', marginTop: '2px', color: 'var(--color-text-muted)' }}>
              Temperature evaluation route initialized. Manual reading checks, demo simulation controls, and threshold compliance badges will be implemented in Phase 5.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid-2">
        {/* Manual Temperature Check Form Shell */}
        <Card
          title="Manual Temperature Check"
          subtitle="Input physical probe or thermometer readings"
        >
          <div className="placeholder-box">
            <p className="primary">Manual Evaluation Form</p>
            <p className="secondary">
              Input item selection, recorded temperature (&deg;C), and threshold evaluation via <code>POST /api/temperature/check</code> will be connected in Phase 5.
            </p>
          </div>
        </Card>

        {/* Demo Simulator Shell */}
        <Card
          title="Demo Temperature Simulator"
          subtitle="Generate realistic presentation readings for testing alerts"
        >
          <div className="placeholder-box">
            <p className="primary">Simulation Controls</p>
            <p className="secondary" style={{ marginBottom: '0.75rem' }}>
              One-click simulation modes (Safe, Warning, Random) via <code>POST /api/temperature/simulate</code>.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <StatusBadge status="WITHIN_LIMIT" label="Safe Mode" />
              <StatusBadge status="ABOVE_LIMIT" label="Warning Mode" />
              <StatusBadge status="NO_LIMIT" label="Random Mode" />
            </div>
          </div>
        </Card>
      </div>

      {/* Verified Safety Guidelines Card */}
      <Card
        title="Household Temperature Benchmarks"
        subtitle="Official recommendations based on FoodSafety.gov &amp; USDA FSIS standards"
      >
        <div className="placeholder-list">
          <div className="placeholder-row">
            <div>
              <strong>Household Refrigerator Threshold: &le; 4.0&deg;C (40&deg;F)</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Prevents rapid pathogen proliferation in raw meats, poultry, seafood, dairy, and leftovers.
              </div>
            </div>
            <StatusBadge status="REFRIGERATED" />
          </div>

          <div className="placeholder-row">
            <div>
              <strong>Household Freezer Threshold: &le; -18.0&deg;C (0&deg;F)</strong>
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

