import React from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/inventory': 'Food Inventory',
  '/checker': 'Temperature Checker',
  '/alerts': 'Alerts & History',
};

export default function Header({ onToggleSidebar, onToggleMobileMenu, isCollapsed = false }) {
  const location = useLocation();
  const currentTitle = PAGE_TITLES[location.pathname] || 'Dashboard';
  const handleToggle = onToggleSidebar || onToggleMobileMenu;

  return (
    <header className="app-header">
      <div className="header-left">
        {/* Universal Sidebar Hamburger Toggle Button */}
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
        <h1 className="header-page-title">{currentTitle}</h1>
      </div>
      <div className="header-right" />
    </header>
  );
}
