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

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Left Sidebar */}
        <Sidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="main-wrapper">
          <Header onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)} />

          <main className="content-container">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/checker" element={<TemperatureCheckerPage />} />
              <Route path="/alerts" element={<AlertsHistoryPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}

