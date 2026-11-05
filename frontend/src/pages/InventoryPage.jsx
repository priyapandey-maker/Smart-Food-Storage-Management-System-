import React, { useState, useEffect, useMemo, useRef } from 'react';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import InventoryFormModal from '../components/InventoryFormModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { getCatalogue, getInventory } from '../services/api';

const LOCATIONS = ['All Locations', 'Pantry', 'Refrigerator', 'Freezer', 'Crisper Drawer', 'Root Cellar'];
const STATUSES = ['All Statuses', 'FRESH', 'NEAR_EXPIRY', 'EXPIRED'];

/**
 * Handle singular and plural quantity units correctly (e.g. "1 liter" vs "2 liters", "1 piece" vs "6 pieces")
 * without modifying stored data.
 */
function formatQuantity(quantity, unit) {
  const num = parseFloat(quantity);
  const cleanUnit = (unit || '').trim().toLowerCase();

  if (cleanUnit === 'liters' || cleanUnit === 'liter') {
    return num === 1 ? '1 liter' : `${quantity} liters`;
  }
  if (cleanUnit === 'pieces' || cleanUnit === 'piece') {
    return num === 1 ? '1 piece' : `${quantity} pieces`;
  }
  if (cleanUnit === 'packets' || cleanUnit === 'packet') {
    return num === 1 ? '1 packet' : `${quantity} packets`;
  }
  if (cleanUnit === 'heads' || cleanUnit === 'head') {
    return num === 1 ? '1 head' : `${quantity} heads`;
  }
  return `${quantity} ${unit}`;
}

/**
 * Format expiry date into user-friendly presentation (e.g. "Nov 11, 2026").
 */
function formatExpiryDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [year, month, day] = dateStr.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format days remaining with precise countdown text.
 */
function formatDaysRemaining(days) {
  if (days > 1) {
    return `${days} days left`;
  } else if (days === 1) {
    return '1 day left (Tomorrow)';
  } else if (days === 0) {
    return 'Expires today';
  } else if (days === -1) {
    return 'Expired 1 day ago';
  } else {
    return `Expired ${Math.abs(days)} days ago`;
  }
}

/**
 * Contextual food icons matching the design screenshot.
 */
function getFoodVisual(name = '', category = '') {
  const lower = `${name} ${category}`.toLowerCase();
  if (lower.includes('milk') || lower.includes('dairy')) return { emoji: '🥛', color: '#E0F2FE' };
  if (lower.includes('lettuce') || lower.includes('spinach') || lower.includes('produce') || lower.includes('salad'))
    return { emoji: '🥬', color: '#DCFCE7' };
  if (lower.includes('cheese')) return { emoji: '🧀', color: '#FEF9C3' };
  if (lower.includes('chicken') || lower.includes('poultry')) return { emoji: '🍗', color: '#F3E8FF' };
  if (lower.includes('beef') || lower.includes('meat')) return { emoji: '🥩', color: '#FEE2E2' };
  if (lower.includes('fish') || lower.includes('salmon') || lower.includes('seafood'))
    return { emoji: '🐟', color: '#CFFAFE' };
  if (lower.includes('egg')) return { emoji: '🥚', color: '#DCFCE7' };
  if (lower.includes('vegetable') || lower.includes('frozen')) return { emoji: '🥦', color: '#E0F2FE' };
  if (lower.includes('rice') || lower.includes('pasta') || lower.includes('bread') || lower.includes('grain'))
    return { emoji: '🍞', color: '#FEF9C3' };
  if (lower.includes('leftover') || lower.includes('cooked')) return { emoji: '🍲', color: '#FEF3C7' };
  return { emoji: '📦', color: '#F1F5F9' };
}

/**
 * Clean semantic category badge classes.
 */
function getCategoryBadgeClass(category = '') {
  const cat = category.toLowerCase();
  if (cat.includes('dairy')) return 'cat-badge-dairy';
  if (cat.includes('produce')) return 'cat-badge-produce';
  if (cat.includes('meat') || cat.includes('poultry')) return 'cat-badge-meat';
  if (cat.includes('seafood')) return 'cat-badge-seafood';
  if (cat.includes('egg')) return 'cat-badge-eggs';
  if (cat.includes('frozen')) return 'cat-badge-frozen';
  return 'cat-badge-default';
}

/**
 * Location badge icon and styling.
 */
function getLocationInfo(location = '') {
  const loc = location.toLowerCase();
  if (loc.includes('freezer')) {
    return { icon: '❄️', className: 'loc-badge-freezer' };
  }
  if (loc.includes('crisper')) {
    return { icon: '📥', className: 'loc-badge-crisper' };
  }
  if (loc.includes('pantry') || loc.includes('cellar')) {
    return { icon: '🏠', className: 'loc-badge-pantry' };
  }
  return { icon: '🗄️', className: 'loc-badge-refrig' };
}

export default function InventoryPage() {
  const [inventoryList, setInventoryList] = useState([]);
  const [catalogueList, setCatalogueList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [preselectedCatalogueId, setPreselectedCatalogueId] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Expandable row state (track set of expanded item IDs)
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());

  // Notification / Success banner
  const [notification, setNotification] = useState(null);

  // Catalogue section toggle (collapsible, expanded by default matching screenshot)
  const [showCatalogue, setShowCatalogue] = useState(true);

  // Carousel scroll ref for catalogue presets
  const catalogueScrollRef = useRef(null);

  // Initial data fetch
  const loadData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [invData, catData] = await Promise.all([getInventory(), getCatalogue()]);
      setInventoryList(invData || []);
      setCatalogueList(catData || []);
    } catch (err) {
      setFetchError(err.message || 'Failed to load inventory data from backend.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Show auto-dismissing notification
  const triggerNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Toggle row expansion for details
  const toggleRowExpansion = (id) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Open Add modal (generic or from catalogue quick-add)
  const handleOpenAddModal = (catId = null) => {
    setItemToEdit(null);
    setPreselectedCatalogueId(catId);
    setIsFormModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (item) => {
    setItemToEdit(item);
    setPreselectedCatalogueId(null);
    setIsFormModalOpen(true);
  };

  // Open Delete modal
  const handleOpenDeleteModal = (item) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  // Callback on successful Add or Edit
  const handleSaveSuccess = (savedItem, action) => {
    loadData();
    const actionText = action === 'added' ? 'Added' : 'Updated';
    triggerNotification(`${actionText} "${savedItem.display_name}" in inventory.`);
  };

  // Callback on successful Delete
  const handleDeleteSuccess = (deletedItem) => {
    loadData();
    triggerNotification(`Removed "${deletedItem.display_name}" from active inventory.`, 'info');
  };

  // Clear filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedLocation('All Locations');
    setSelectedStatus('All Statuses');
  };

  // Scroll catalogue carousel right
  const scrollCatalogueRight = () => {
    if (catalogueScrollRef.current) {
      catalogueScrollRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  // Derived counts for Overview Summary Cards
  const totalCount = inventoryList.length;
  const freshCount = useMemo(
    () => inventoryList.filter((item) => item.expiry_status === 'FRESH').length,
    [inventoryList]
  );
  const nearExpiryCount = useMemo(
    () => inventoryList.filter((item) => item.expiry_status === 'NEAR_EXPIRY').length,
    [inventoryList]
  );
  const expiredCount = useMemo(
    () => inventoryList.filter((item) => item.expiry_status === 'EXPIRED').length,
    [inventoryList]
  );

  // Filtered Inventory List
  const filteredInventory = useMemo(() => {
    return inventoryList.filter((item) => {
      // 1. Search Query filter (matches display_name, custom_name, catalogue.name, category)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const displayName = (item.display_name || '').toLowerCase();
        const customName = (item.custom_name || '').toLowerCase();
        const catName = (item.catalogue?.name || '').toLowerCase();
        const category = (item.catalogue?.category || '').toLowerCase();

        const matches =
          displayName.includes(query) ||
          customName.includes(query) ||
          catName.includes(query) ||
          category.includes(query);

        if (!matches) return false;
      }

      // 2. Storage Location filter
      if (selectedLocation !== 'All Locations') {
        if (item.storage_location.toLowerCase() !== selectedLocation.toLowerCase()) {
          return false;
        }
      }

      // 3. Expiry Status filter
      if (selectedStatus !== 'All Statuses') {
        if (item.expiry_status.toUpperCase() !== selectedStatus.toUpperCase()) {
          return false;
        }
      }

      return true;
    });
  }, [inventoryList, searchQuery, selectedLocation, selectedStatus]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedLocation !== 'All Locations' ||
    selectedStatus !== 'All Statuses';

  return (
    <div className="page-inventory">
      {/* =================================================================== */}
      {/* 1. Page Heading with Modern Button                                  */}
      {/* =================================================================== */}
      <div className="inventory-header-row">
        <div>
          <h2 className="inventory-main-title">Food Inventory</h2>
          <p className="inventory-subtitle">Manage your stored food, quantities and expiry dates.</p>
        </div>

        <button
          type="button"
          className="btn-add-food-primary"
          onClick={() => handleOpenAddModal()}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Food Item</span>
        </button>
      </div>

      {/* Floating Notification Banner */}
      {notification && (
        <div className={`notification-banner ${notification.type}`} role="status">
          <div className="notification-content">
            <span className="notification-icon">
              {notification.type === 'success' ? '✓' : 'ℹ'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            className="notification-close"
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && <LoadingState message="Loading your food inventory and safety guidelines..." />}
      {fetchError && !isLoading && (
        <ErrorState
          title="Could not load inventory"
          message={fetchError}
          onRetry={loadData}
        />
      )}

      {!isLoading && !fetchError && (
        <>
          {/* =================================================================== */}
          {/* 2. Compact Four-Card Summary Row                                    */}
          {/* =================================================================== */}
          <div className="inventory-summary-cards-grid">
            {/* Card 1: Total Items */}
            <div
              className="summary-card card-total"
              onClick={() => setSelectedStatus('All Statuses')}
              role="button"
              tabIndex={0}
              title="Show all items"
            >
              <div className="summary-card-icon icon-box-green">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div className="summary-card-body">
                <span className="summary-num">{totalCount}</span>
                <span className="summary-label">Total Items</span>
              </div>
              <span className="summary-arrow">›</span>
            </div>

            {/* Card 2: Fresh Items */}
            <div
              className="summary-card card-fresh"
              onClick={() => setSelectedStatus('FRESH')}
              role="button"
              tabIndex={0}
              title="Filter by Fresh items"
            >
              <div className="summary-card-icon icon-box-green">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                </svg>
              </div>
              <div className="summary-card-body">
                <span className="summary-num">{freshCount}</span>
                <span className="summary-label">Fresh Items</span>
              </div>
              <span className="summary-arrow">›</span>
            </div>

            {/* Card 3: Near Expiry */}
            <div
              className="summary-card card-near"
              onClick={() => setSelectedStatus('NEAR_EXPIRY')}
              role="button"
              tabIndex={0}
              title="Filter by Near Expiry items"
            >
              <div className="summary-card-icon icon-box-amber">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="summary-card-body">
                <span className="summary-num">{nearExpiryCount}</span>
                <span className="summary-label">Near Expiry</span>
              </div>
              <span className="summary-arrow">›</span>
            </div>

            {/* Card 4: Expired Items */}
            <div
              className="summary-card card-expired"
              onClick={() => setSelectedStatus('EXPIRED')}
              role="button"
              tabIndex={0}
              title="Filter by Expired items"
            >
              <div className="summary-card-icon icon-box-red">
                <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="summary-card-body">
                <span className="summary-num">{expiredCount}</span>
                <span className="summary-label">Expired Items</span>
              </div>
              <span className="summary-arrow">›</span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* 3. Food Safety Catalogue Section (Collapsible)                      */}
          {/* =================================================================== */}
          <div className="catalogue-panel-container">
            <div
              className="catalogue-panel-header"
              onClick={() => setShowCatalogue((prev) => !prev)}
              role="button"
              tabIndex={0}
              aria-expanded={showCatalogue}
            >
              <div className="catalogue-header-left">
                <div className="catalogue-book-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="catalogue-panel-title">Food Safety Catalogue</h3>
                  <p className="catalogue-panel-subtitle">
                    Browse {catalogueList.length} verified food presets with storage guidelines
                  </p>
                </div>
              </div>

              <div className="catalogue-chevron-toggle">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  style={{
                    transform: showCatalogue ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {showCatalogue && (
              <div className="catalogue-carousel-wrapper">
                <div className="catalogue-cards-carousel" ref={catalogueScrollRef}>
                  {catalogueList.map((cat) => {
                    const visual = getFoodVisual(cat.name, cat.category);
                    const categoryClass = getCategoryBadgeClass(cat.category);

                    return (
                      <div key={cat.id} className="modern-cat-card">
                        <div className="cat-card-body-row">
                          <div
                            className="cat-card-visual"
                            style={{ backgroundColor: visual.color }}
                            aria-hidden="true"
                          >
                            <span>{visual.emoji}</span>
                          </div>

                          <div className="cat-card-details">
                            <h4 className="cat-card-title">{cat.name}</h4>
                            <div className="cat-card-badge-row">
                              <span className={`cat-pill-badge ${categoryClass}`}>
                                {cat.category}
                              </span>
                            </div>

                            <div className="cat-temp-guideline">
                              <span className="temp-icon">🌡️</span>
                              <span>
                                {cat.max_temp_c !== null ? `≤ ${cat.max_temp_c.toFixed(1)}°C` : 'Cool & Dry'}
                              </span>
                            </div>

                            <p className="cat-brief-guidance">
                              {cat.storage_guidance.length > 55
                                ? `${cat.storage_guidance.slice(0, 52)}...`
                                : cat.storage_guidance}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-add-cat-preset"
                          onClick={() => handleOpenAddModal(cat.id)}
                          title={`Add ${cat.name} to your inventory`}
                        >
                          + Add to Inventory
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right scroll arrow button */}
                <button
                  type="button"
                  className="carousel-nav-btn right-btn"
                  onClick={scrollCatalogueRight}
                  aria-label="Scroll catalogue presets forward"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* =================================================================== */}
          {/* 4. Search and Filter Toolbar                                        */}
          {/* =================================================================== */}
          <div className="inventory-modern-toolbar">
            {/* Prominent Search Input */}
            <div className="toolbar-search-field">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#94A3B8" strokeWidth="2" fill="none">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search food items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="toolbar-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="toolbar-clear-x"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search input"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Storage Location Dropdown */}
            <div className="toolbar-select-container">
              <select
                id="filter_location"
                className="toolbar-select"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                aria-label="Filter by storage location"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiry Status Dropdown */}
            <div className="toolbar-select-container">
              <select
                id="filter_status"
                className="toolbar-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                aria-label="Filter by expiry status"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st === 'All Statuses' ? 'All Statuses' : st.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Action */}
            {hasActiveFilters && (
              <button
                type="button"
                className="toolbar-btn-clear"
                onClick={handleClearFilters}
                title="Reset all filters"
              >
                <span className="clear-icon">🔄</span>
                <span>Clear Filters</span>
              </button>
            )}

            {/* Matching Item Count Badge */}
            <div className="toolbar-count-badge">
              <span>{filteredInventory.length} items</span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* 5. Inventory Table Card ("Your Inventory")                          */}
          {/* =================================================================== */}
          <div className="inventory-table-container-card">
            <div className="table-card-header">
              <div className="table-card-title-group">
                <span className="table-card-icon" aria-hidden="true">📋</span>
                <h3 className="table-card-title">Your Inventory</h3>
              </div>
            </div>

            {inventoryList.length === 0 ? (
              /* Polished Total Empty State */
              <div className="empty-inventory-state-box">
                <div className="empty-state-illustration" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="56" height="56" stroke="#166534" strokeWidth="1.5" fill="none">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <line x1="3.27" y1="6.96" x2="12" y2="12.01" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                    <line x1="20.73" y1="6.96" x2="12" y2="12.01" />
                  </svg>
                </div>
                <h4 className="empty-state-headline">Your food inventory is currently empty</h4>
                <p className="empty-state-text">
                  Track your household food, groceries, dairy, meats, and produce to monitor safety limits and prevent food waste.
                </p>
                <button
                  type="button"
                  className="btn-add-food-primary"
                  onClick={() => handleOpenAddModal()}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add First Food Item</span>
                </button>
              </div>
            ) : filteredInventory.length === 0 ? (
              /* Filtered Empty State */
              <div className="empty-inventory-state-box">
                <h4 className="empty-state-headline">No food items match the current filters</h4>
                <p className="empty-state-text">
                  Try adjusting your search terms, location, or status filter to view other stored items.
                </p>
                <button
                  type="button"
                  className="btn-reset-filters"
                  onClick={handleClearFilters}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              /* Populated Modern Inventory Table */
              <div className="table-scroll-wrapper">
                <table className="modern-inventory-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }} aria-label="Expand row details" />
                      <th>FOOD ITEM</th>
                      <th>CATEGORY</th>
                      <th>LOCATION</th>
                      <th>QUANTITY</th>
                      <th>EXPIRY DATE</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => {
                      const isExpanded = expandedRowIds.has(item.id);
                      const visual = getFoodVisual(item.display_name, item.catalogue?.category);
                      const catBadgeClass = getCategoryBadgeClass(item.catalogue?.category);
                      const locInfo = getLocationInfo(item.storage_location);
                      const formattedQty = formatQuantity(item.quantity, item.unit);
                      const formattedExp = formatExpiryDate(item.expiry_date);
                      const countdownText = formatDaysRemaining(item.days_until_expiry);

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`table-item-row ${isExpanded ? 'row-expanded' : ''}`}>
                            {/* Expand Row Toggle */}
                            <td>
                              <button
                                type="button"
                                className="row-toggle-btn"
                                onClick={() => toggleRowExpansion(item.id)}
                                title={isExpanded ? 'Collapse safety details' : 'View safety guidance'}
                                aria-label="Toggle row details"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            </td>

                            {/* Food Item */}
                            <td>
                              <div className="table-food-item-cell">
                                <div
                                  className="table-food-avatar"
                                  style={{ backgroundColor: visual.color }}
                                  aria-hidden="true"
                                >
                                  <span>{visual.emoji}</span>
                                </div>
                                <div className="table-food-text">
                                  <span className="table-food-name">{item.display_name}</span>
                                  {item.custom_name && (
                                    <span className="table-food-base">
                                      Base: {item.catalogue?.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td>
                              <span className={`table-cat-badge ${catBadgeClass}`}>
                                {item.catalogue?.category || 'General'}
                              </span>
                            </td>

                            {/* Location */}
                            <td>
                              <span className={`table-location-pill ${locInfo.className}`}>
                                <span className="loc-pill-icon">{locInfo.icon}</span>
                                <span>{item.storage_location}</span>
                              </span>
                            </td>

                            {/* Quantity */}
                            <td>
                              <span className="table-qty-text">{formattedQty}</span>
                            </td>

                            {/* Expiry Date */}
                            <td>
                              <div className="table-expiry-cell">
                                <span className="table-exp-date">{formattedExp}</span>
                                <span className={`table-exp-countdown ${item.expiry_status.toLowerCase()}`}>
                                  {countdownText}
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td>
                              <span className={`table-status-pill ${item.expiry_status.toLowerCase()}`}>
                                <span className="status-dot-indicator">●</span>
                                <span>
                                  {item.expiry_status === 'NEAR_EXPIRY'
                                    ? 'Near Expiry'
                                    : item.expiry_status === 'EXPIRED'
                                      ? 'Expired'
                                      : 'Fresh'}
                                </span>
                              </span>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: 'right' }}>
                              <div className="table-actions-cell">
                                <button
                                  type="button"
                                  className="btn-table-action edit-btn"
                                  onClick={() => handleOpenEditModal(item)}
                                  title="Edit food item"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-table-action delete-btn"
                                  onClick={() => handleOpenDeleteModal(item)}
                                  title="Remove item from inventory"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Safety Guidance Details */}
                          {isExpanded && (
                            <tr className="table-expanded-guidance-row">
                              <td colSpan={8}>
                                <div className="guidance-expanded-panel">
                                  <div className="guidance-col">
                                    <span className="guidance-header-label">Storage Guidance:</span>
                                    <p className="guidance-body-text">
                                      {item.catalogue?.storage_guidance}
                                    </p>
                                  </div>

                                  <div className="guidance-col">
                                    <span className="guidance-header-label">Safety Benchmark:</span>
                                    <p className="guidance-benchmark-text">
                                      Storage Type: <strong>{item.catalogue?.storage_type}</strong>
                                    </p>
                                    <p className="guidance-temp-text">
                                      {item.catalogue?.max_temp_c !== null ? (
                                        <>Max Safe Temp: <strong>≤ {item.catalogue?.max_temp_c}°C</strong></>
                                      ) : (
                                        <>Storage Rule: <strong>Cool &amp; Dry Pantry (No numeric limit)</strong></>
                                      )}
                                    </p>
                                  </div>

                                  <div className="guidance-col">
                                    <span className="guidance-header-label">Official Reference:</span>
                                    {item.catalogue?.reference_url ? (
                                      <a
                                        href={item.catalogue.reference_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="guidance-link"
                                      >
                                        {item.catalogue.reference_title} ↗
                                      </a>
                                    ) : (
                                      <span className="guidance-body-text">{item.catalogue?.reference_title}</span>
                                    )}
                                    <p className="guidance-date-meta">
                                      Added on: {item.purchase_date}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add / Edit Inventory Item Modal */}
      <InventoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        catalogueList={catalogueList}
        itemToEdit={itemToEdit}
        preselectedCatalogueId={preselectedCatalogueId}
        onSuccess={handleSaveSuccess}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        itemToDelete={itemToDelete}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
