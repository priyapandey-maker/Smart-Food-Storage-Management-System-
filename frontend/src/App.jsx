import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Header from './components/Header';

import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import TemperatureCheckerPage from './pages/TemperatureCheckerPage';
import AlertsHistoryPage from './pages/AlertsHistoryPage';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persistent desktop sidebar collapsed/expanded state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('freshguard_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('freshguard_sidebar_collapsed', JSON.stringify(next));
        } catch {
          // Ignore storage errors in restrictive browser environments
        }
        return next;
      });
    }
  };

  return (
    <BrowserRouter>
      <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Global Full-Width Top Navigation Bar (YouTube style) */}
        <Header
          onToggleSidebar={handleToggleSidebar}
          onToggleMobileMenu={handleToggleSidebar}
          isCollapsed={isCollapsed}
        />

        {/* Application Body: Sidebar + Main Content */}
        <div className="app-body">
          {/* Sidebar Navigation below Header */}
          <Sidebar
            isOpen={mobileMenuOpen}
            isCollapsed={isCollapsed}
            onClose={() => setMobileMenuOpen(false)}
          />

          {/* Main Content Area automatically expands when sidebar collapses */}
          <main className="main-content">
            <div className="content-container">
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/checker" element={<TemperatureCheckerPage />} />
                <Route path="/alerts" element={<AlertsHistoryPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
