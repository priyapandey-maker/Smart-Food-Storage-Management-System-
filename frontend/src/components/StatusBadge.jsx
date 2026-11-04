import React from 'react';

const STATUS_LABELS = {
  // Expiry statuses
  FRESH: 'Fresh',
  NEAR_EXPIRY: 'Near Expiry',
  EXPIRED: 'Expired',

  // Temperature check statuses
  WITHIN_LIMIT: 'Within Limit',
  ABOVE_LIMIT: 'Above Limit',
  NO_LIMIT: 'No Limit',

  // Storage types
  REFRIGERATED: 'Refrigerated',
  FROZEN: 'Frozen',
  AMBIENT: 'Ambient',
};

export default function StatusBadge({ status, label, className = '' }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();
  const displayLabel = label || STATUS_LABELS[normalized] || normalized.replace('_', ' ');
  const statusClass = normalized.toLowerCase();

  return (
    <span className={`status-badge ${statusClass} ${className}`}>
      {displayLabel}
    </span>
  );
}

