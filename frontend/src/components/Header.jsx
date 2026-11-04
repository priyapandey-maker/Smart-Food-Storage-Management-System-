import React, { useState, useEffect } from 'react';
import { checkHealth } from '../services/api';

export default function Header({ onToggleMobileMenu }) {
  const [healthStatus, setHealthStatus] = useState('checking'); // 'checking' | 'connected' | 'offline'
  const [version, setVersion] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setHealthStatus('checking');
    try {
      const data = await checkHealth();
      if (data && data.status === 'healthy' && data.database === 'connected') {
        setHealthStatus('connected');
        setVersion(data.version);
      } else {
        setHealthStatus('offline');
      }
    } catch {
      setHealthStatus('offline');
    } finally {
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="header-title-crumb">Storage Safety Console</span>
      </div>

      <div className="header-right">
        {/* Backend Connection Status Indicator */}
        <div
          className={`backend-status-pill ${healthStatus}`}
          title={lastChecked ? `Last checked: ${lastChecked}` : 'Checking backend connection'}
        >
          <span
            className={`status-dot ${
              healthStatus === 'connected' ? 'green' : healthStatus === 'checking' ? 'amber' : 'red'
            }`}
          />
          <span>
            {healthStatus === 'connected'
              ? `Backend Connected ${version ? `(v${version})` : ''}`
              : healthStatus === 'checking'
              ? 'Checking Backend...'
              : 'Backend Offline'}
          </span>
          <button
            type="button"
            className="btn-icon-refresh"
            onClick={fetchHealth}
            title="Retry health check"
            aria-label="Retry backend connection check"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

