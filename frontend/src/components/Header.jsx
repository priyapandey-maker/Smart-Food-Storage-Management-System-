import React from 'react';
import { Link } from 'react-router-dom';

export default function Header({ onToggleSidebar, onToggleMobileMenu, isCollapsed = false }) {
  const handleToggle = onToggleSidebar || onToggleMobileMenu;

  return (
    <header className="app-header">
      <div className="header-left">
        {/* 1. Hamburger menu button (far left, only controls sidebar toggle) */}
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={handleToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Global Brand Lockup (Shield Logo, Application Name, Subtitle) */}
        <Link to="/" className="header-brand" title="FreshGuard - Smart Food Storage System">
          {/* 2. FreshGuard shield logo */}
          <div className="brand-icon">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>

          {/* 3 & 4. FreshGuard application name and subtitle */}
          <div className="brand-text">
            <span className="brand-name">FreshGuard</span>
            <span className="brand-subtitle">Smart Food Storage and Inventory Management System</span>
          </div>
        </Link>
      </div>

      {/* Clean header right section */}
      <div className="header-right" />
    </header>
  );
}
