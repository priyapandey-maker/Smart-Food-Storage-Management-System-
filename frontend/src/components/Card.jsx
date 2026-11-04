import React from 'react';

export default function Card({ title, subtitle, action, children, className = '', variant = '' }) {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <div className={`card ${variant} ${className}`}>
      {hasHeader && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}

