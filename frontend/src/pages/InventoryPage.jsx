import React from 'react';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';

export default function InventoryPage() {
  return (
    <div className="page-inventory">
      <PageHeading
        title="Food Inventory"
        subtitle="Manage household food items, storage locations, quantities, and packaging expiry dates."
      />

      {/* Phase notice */}
      <Card variant="note-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📦</span>
          <div>
            <strong>Phase 3 Foundation Shell</strong>
            <p style={{ fontSize: '0.875rem', marginTop: '2px', color: 'var(--color-text-muted)' }}>
              Inventory page route initialized. Full inventory item creation form, edit modals, storage location filters, and soft-delete actions will be implemented in Phase 4.
            </p>
          </div>
        </div>
      </Card>

      {/* Food Catalogue Reference Shell */}
      <Card
        title="Predefined Food Catalogue Reference"
        subtitle="Verified baseline food-safety storage types and recommended limits"
      >
        <div className="placeholder-list">
          <div className="placeholder-row">
            <div>
              <strong>Fresh Milk / Dairy</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Default: Refrigerator &bull; Max 4.0&deg;C</div>
            </div>
            <StatusBadge status="REFRIGERATED" />
          </div>

          <div className="placeholder-row">
            <div>
              <strong>Raw Poultry / Meat</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Default: Refrigerator &bull; Max 4.0&deg;C</div>
            </div>
            <StatusBadge status="REFRIGERATED" />
          </div>

          <div className="placeholder-row">
            <div>
              <strong>Frozen Vegetables / Foods</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Default: Freezer &bull; Max -18.0&deg;C</div>
            </div>
            <StatusBadge status="FROZEN" />
          </div>

          <div className="placeholder-row">
            <div>
              <strong>Dry Rice / Pantry Grains</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Default: Pantry &bull; Cool &amp; dry (No numeric limit)</div>
            </div>
            <StatusBadge status="AMBIENT" />
          </div>
        </div>
      </Card>

      {/* Active Inventory Table Shell */}
      <Card
        title="Active Household Inventory"
        subtitle="Track stored items, remaining days until expiry, and storage locations"
      >
        <div className="placeholder-box">
          <p className="primary">Inventory Table Shell Ready</p>
          <p className="secondary">
            Filter controls (by storage location &amp; expiry status) and item management table will connect to <code>GET /api/inventory</code> in Phase 4.
          </p>
        </div>
      </Card>
    </div>
  );
}

