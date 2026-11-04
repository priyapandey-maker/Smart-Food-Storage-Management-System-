import React, { useState, useEffect, useMemo } from 'react';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import InventoryFormModal from '../components/InventoryFormModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { getCatalogue, getInventory } from '../services/api';

const LOCATIONS = ['All Locations', 'Pantry', 'Refrigerator', 'Freezer', 'Crisper Drawer', 'Root Cellar'];
const STATUSES = ['All Statuses', 'FRESH', 'NEAR_EXPIRY', 'EXPIRED'];

function formatDaysRemaining(days) {
  if (days > 1) {
    return `In ${days} days`;
  } else if (days === 1) {
    return 'Tomorrow (1 day)';
  } else if (days === 0) {
    return 'Expires today';
  } else if (days === -1) {
    return 'Expired 1 day ago';
  } else {
    return `Expired ${Math.abs(days)} days ago`;
  }
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

  // Catalogue section toggle (collapsible)
  const [showCatalogue, setShowCatalogue] = useState(false);

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
      <PageHeading
        title="Food Inventory"
        subtitle="Manage household food items, storage locations, quantities, and packaging expiry dates."
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenAddModal()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Add Food Item</span>
          </button>
        }
      />

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
          {/* Predefined Food Catalogue Reference Card (Collapsible) */}
          <Card
            title="Predefined Food Safety Catalogue"
            subtitle={`${catalogueList.length} verified categories with recommended temperatures & storage guidelines`}
            action={
              <button
                type="button"
                className="btn btn-outline-sm"
                onClick={() => setShowCatalogue((prev) => !prev)}
                aria-expanded={showCatalogue}
              >
                {showCatalogue ? 'Hide Catalogue ▲' : 'Browse Catalogue ▼'}
              </button>
            }
          >
            {showCatalogue ? (
              <div className="catalogue-grid">
                {catalogueList.map((cat) => (
                  <div key={cat.id} className="catalogue-card-item">
                    <div className="catalogue-card-top">
                      <div>
                        <h4 className="cat-item-name">{cat.name}</h4>
                        <span className="cat-item-category">{cat.category}</span>
                      </div>
                      <StatusBadge status={cat.storage_type} />
                    </div>

                    <p className="cat-item-guidance">{cat.storage_guidance}</p>

                    <div className="cat-item-meta">
                      <span>
                        Recommended: <strong>{cat.max_temp_c !== null ? `≤ ${cat.max_temp_c}°C` : 'Cool & Dry'}</strong>
                      </span>
                      <span>
                        Default: <strong>{cat.default_location}</strong>
                      </span>
                    </div>

                    <div className="cat-item-footer">
                      {cat.reference_url && (
                        <a
                          href={cat.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="reference-link"
                          title={cat.reference_title}
                        >
                          {cat.reference_title} &nearr;
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary-xs"
                        onClick={() => handleOpenAddModal(cat.id)}
                        title={`Add ${cat.name} to inventory`}
                      >
                        + Add to Inventory
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="catalogue-teaser">
                <p>
                  Explore verified guidelines for Dairy, Raw Poultry, Ground Beef, Seafood, Eggs, Produce, Frozen Foods, Leftovers, and Pantry Goods.
                </p>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowCatalogue(true)}
                >
                  View all 10 catalogue presets &nearr;
                </button>
              </div>
            )}
          </Card>

          {/* Search and Filters Bar */}
          <div className="inventory-filter-bar">
            {/* Search Input */}
            <div className="filter-search-box">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="#94A3B8" strokeWidth="2" fill="none">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search food by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="filter-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="filter-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search text"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Storage Location Filter */}
            <div className="filter-select-wrapper">
              <label htmlFor="filter_location" className="filter-label">Location:</label>
              <select
                id="filter_location"
                className="filter-select"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Expiry Status Filter */}
            <div className="filter-select-wrapper">
              <label htmlFor="filter_status" className="filter-label">Status:</label>
              <select
                id="filter_status"
                className="filter-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st === 'All Statuses' ? 'All Statuses' : st.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary-sm"
                onClick={handleClearFilters}
              >
                Clear Filters
              </button>
            )}

            {/* Counter Badge */}
            <div className="filter-counter">
              <span>{filteredInventory.length} {filteredInventory.length === 1 ? 'item' : 'items'}</span>
              {hasActiveFilters && <small> (filtered from {inventoryList.length})</small>}
            </div>
          </div>

          {/* Active Inventory List / Table View */}
          {inventoryList.length === 0 ? (
            /* Total Empty State */
            <Card>
              <div className="placeholder-box" style={{ padding: '3.5rem 2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🥗</div>
                <p className="primary" style={{ fontSize: '1.2rem' }}>Your food inventory is currently empty</p>
                <p className="secondary" style={{ maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
                  Track your groceries, dairy, meats, produce, and leftovers to monitor safety limits and prevent food waste.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenAddModal()}
                >
                  + Add Your First Food Item
                </button>
              </div>
            </Card>
          ) : filteredInventory.length === 0 ? (
            /* Filtered Empty State */
            <Card>
              <div className="placeholder-box" style={{ padding: '3rem 2rem' }}>
                <p className="primary">No food items match the current filters</p>
                <p className="secondary" style={{ marginBottom: '1.25rem' }}>
                  Try adjusting your search terms, location, or status filter.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary-sm"
                  onClick={handleClearFilters}
                >
                  Reset All Filters
                </button>
              </div>
            </Card>
          ) : (
            /* Populated Inventory Table */
            <Card>
              <div className="table-responsive-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }} aria-label="Expand row details" />
                      <th>Food Item</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Location</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => {
                      const isExpanded = expandedRowIds.has(item.id);
                      const hasCustomName = Boolean(item.custom_name && item.custom_name.trim());

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`inventory-row ${isExpanded ? 'expanded' : ''}`}>
                            {/* Expand Row Toggle */}
                            <td>
                              <button
                                type="button"
                                className="btn-row-toggle"
                                onClick={() => toggleRowExpansion(item.id)}
                                title={isExpanded ? 'Collapse details' : 'View safety guidance & details'}
                                aria-label="Toggle details"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            </td>

                            {/* Food Item Name */}
                            <td>
                              <div className="food-name-cell">
                                <span className="display-name">{item.display_name}</span>
                                {hasCustomName && (
                                  <span className="base-cat-name">
                                    Base: {item.catalogue?.name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Category */}
                            <td>
                              <span className="cat-badge">{item.catalogue?.category || 'General'}</span>
                            </td>

                            {/* Quantity & Unit */}
                            <td>
                              <span className="qty-cell">
                                {item.quantity} {item.unit}
                              </span>
                            </td>

                            {/* Storage Location */}
                            <td>
                              <span className="location-pill">
                                {item.storage_location}
                              </span>
                            </td>

                            {/* Expiry Date & Countdown */}
                            <td>
                              <div className="date-cell">
                                <span className="date-main">{item.expiry_date}</span>
                                <span className={`days-label ${item.expiry_status.toLowerCase()}`}>
                                  {formatDaysRemaining(item.days_until_expiry)}
                                </span>
                              </div>
                            </td>

                            {/* Expiry Status Badge */}
                            <td>
                              <StatusBadge status={item.expiry_status} />
                            </td>

                            {/* Action Buttons */}
                            <td style={{ textAlign: 'right' }}>
                              <div className="row-action-btns">
                                <button
                                  type="button"
                                  className="btn-action edit"
                                  onClick={() => handleOpenEditModal(item)}
                                  title="Edit food item"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn-action delete"
                                  onClick={() => handleOpenDeleteModal(item)}
                                  title="Remove item"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Safety Guidance Detail Row */}
                          {isExpanded && (
                            <tr className="inventory-detail-row">
                              <td colSpan={8}>
                                <div className="expanded-detail-box">
                                  <div className="detail-col">
                                    <span className="detail-label">Storage Guidance:</span>
                                    <p className="detail-guidance">
                                      {item.catalogue?.storage_guidance}
                                    </p>
                                  </div>

                                  <div className="detail-col">
                                    <span className="detail-label">Safety Benchmark:</span>
                                    <p>
                                      Storage Type: <StatusBadge status={item.catalogue?.storage_type} />
                                    </p>
                                    <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
                                      {item.catalogue?.max_temp_c !== null ? (
                                        <>Max Safe Temp: <strong>{item.catalogue?.max_temp_c}&deg;C</strong></>
                                      ) : (
                                        <>Storage rule: <strong>Cool &amp; Dry Pantry (No numeric limit)</strong></>
                                      )}
                                    </p>
                                  </div>

                                  <div className="detail-col">
                                    <span className="detail-label">Official Reference:</span>
                                    {item.catalogue?.reference_url ? (
                                      <a
                                        href={item.catalogue.reference_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="reference-link"
                                      >
                                        {item.catalogue.reference_title} &nearr;
                                      </a>
                                    ) : (
                                      <span>{item.catalogue?.reference_title}</span>
                                    )}
                                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                                      Purchased: {item.purchase_date}
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
            </Card>
          )}
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
