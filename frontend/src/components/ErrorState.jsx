import React from 'react';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}) {
  return (
    <div className="error-card" role="alert">
      <div className="error-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="error-card-content">
        <h4>{title}</h4>
        {message && <p>{message}</p>}
        {onRetry && (
          <button type="button" className="btn-retry" onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

