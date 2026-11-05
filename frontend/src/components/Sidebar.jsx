import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ isOpen, isCollapsed = false, onClose }) {
  const handleNavClick = () => {
    if (onClose && typeof window !== 'undefined' && window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Navigation Links (Sidebar begins directly below global header) */}
        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            data-tooltip="Dashboard"
            title={isCollapsed ? 'Dashboard' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/inventory"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            data-tooltip="Food Inventory"
            title={isCollapsed ? 'Food Inventory' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Food Inventory</span>
          </NavLink>

          <NavLink
            to="/checker"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            data-tooltip="Temperature Checker"
            title={isCollapsed ? 'Temperature Checker' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            </svg>
            <span>Temperature Checker</span>
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            data-tooltip="Alerts & History"
            title={isCollapsed ? 'Alerts & History' : undefined}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Alerts &amp; History</span>
          </NavLink>
        </nav>

        {/* Informational callout card */}
        <div className="sidebar-promo-card">
          <div className="promo-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="promo-text">
            <span>Keep food fresh,</span>
            <span>stay healthy!</span>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <p>FreshGuard</p>
        </div>
      </aside>
    </>
  );
}
