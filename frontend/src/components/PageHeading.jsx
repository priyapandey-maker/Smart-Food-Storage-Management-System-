import React from 'react';

export default function PageHeading({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div className="page-heading-text">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

