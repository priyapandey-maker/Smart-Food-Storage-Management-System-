import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import { createInventoryItem, updateInventoryItem } from '../services/api';

const UNITS = ['kg', 'g', 'liters', 'pieces', 'packets'];
const LOCATIONS = ['Pantry', 'Refrigerator', 'Freezer', 'Crisper Drawer', 'Root Cellar'];

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function InventoryFormModal({
  isOpen,
  onClose,
  catalogueList = [],
  itemToEdit = null,
  preselectedCatalogueId = null,
  onSuccess,
}) {
  const isEditing = Boolean(itemToEdit);

  const [catalogueId, setCatalogueId] = useState('');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pieces');
  const [purchaseDate, setPurchaseDate] = useState(getTodayString());
  const [expiryDate, setExpiryDate] = useState('');
  const [storageLocation, setStorageLocation] = useState('Refrigerator');

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form state when modal opens
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsSubmitting(false);
      return;
    }

    if (itemToEdit) {
      setCatalogueId(String(itemToEdit.catalogue_id));
      setCustomName(itemToEdit.custom_name || '');
      setQuantity(String(itemToEdit.quantity));
      setUnit(itemToEdit.unit || 'pieces');
      setPurchaseDate(itemToEdit.purchase_date);
      setExpiryDate(itemToEdit.expiry_date || '');
      setStorageLocation(itemToEdit.storage_location || 'Refrigerator');
    } else {
      // Adding new item
      const initialCatId = preselectedCatalogueId ? String(preselectedCatalogueId) : (catalogueList[0]?.id ? String(catalogueList[0].id) : '');
      setCatalogueId(initialCatId);
      setCustomName('');
      setQuantity('');
      setUnit('pieces');
      setPurchaseDate(getTodayString());
      setExpiryDate(''); // Leave blank initially as required

      // Default location from catalogue item
      const matchingCat = catalogueList.find((c) => String(c.id) === String(initialCatId));
      if (matchingCat) {
        setStorageLocation(matchingCat.default_location);
      } else {
        setStorageLocation('Refrigerator');
      }
    }
    setError(null);
  }, [isOpen, itemToEdit, preselectedCatalogueId, catalogueList]);

  // Selected catalogue item reference
  const selectedCatalogue = catalogueList.find((c) => String(c.id) === String(catalogueId));

  // When catalogue item changes in Add mode, smart auto-fill default location
  const handleCatalogueChange = (e) => {
    const newId = e.target.value;
    setCatalogueId(newId);
    const cat = catalogueList.find((c) => String(c.id) === String(newId));
    if (cat && cat.default_location) {
      setStorageLocation(cat.default_location);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (!catalogueId && !isEditing) {
      setError('Please select a food catalogue item.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Quantity must be a positive number greater than 0.');
      return;
    }

    if (!purchaseDate) {
      setError('Purchase / addition date is required.');
      return;
    }

    if (!expiryDate) {
      setError('Expiry date is required. Please check product packaging.');
      return;
    }

    if (expiryDate < purchaseDate) {
      setError('Expiry date cannot be earlier than the purchase date.');
      return;
    }

    if (!storageLocation) {
      setError('Storage location is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const payload = {
          custom_name: customName.trim() || null,
          quantity: numQty,
          unit,
          storage_location: storageLocation,
          purchase_date: purchaseDate,
          expiry_date: expiryDate,
        };
        const updated = await updateInventoryItem(itemToEdit.id, payload);
        onSuccess(updated, 'updated');
      } else {
        const payload = {
          catalogue_id: parseInt(catalogueId, 10),
          custom_name: customName.trim() || null,
          quantity: numQty,
          unit,
          storage_location: storageLocation,
          purchase_date: purchaseDate,
          expiry_date: expiryDate,
        };
        const created = await createInventoryItem(payload);
        onSuccess(created, 'added');
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save inventory item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Inventory Item: ${itemToEdit.display_name}` : 'Add Food to Inventory'}
      maxWidth="600px"
    >
      <form onSubmit={handleSubmit} className="inventory-form">
        {error && (
          <div className="form-alert-error" role="alert">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Catalogue Food Selection */}
        <div className="form-group">
          <label htmlFor="catalogue_id">
            Catalogue Food Type <span className="required-star">*</span>
          </label>
          {isEditing ? (
            <div className="read-only-field">
              <strong>{itemToEdit.catalogue?.name}</strong> &bull; {itemToEdit.catalogue?.category}
            </div>
          ) : (
            <select
              id="catalogue_id"
              className="form-control"
              value={catalogueId}
              onChange={handleCatalogueChange}
              required
              disabled={isSubmitting}
            >
              <option value="" disabled>-- Select Food from Catalogue --</option>
              {catalogueList.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.category} &bull; {cat.storage_type})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Smart Safety Guidance Box */}
        {selectedCatalogue && (
          <div className="catalogue-info-card">
            <div className="catalogue-info-header">
              <span className="info-title">
                {selectedCatalogue.name} &bull; {selectedCatalogue.category}
              </span>
              <StatusBadge status={selectedCatalogue.storage_type} />
            </div>
            <p className="info-guidance">
              {selectedCatalogue.storage_guidance}
            </p>
            <div className="info-threshold">
              {selectedCatalogue.max_temp_c !== null ? (
                <span>Recommended Max Temp: <strong>{selectedCatalogue.max_temp_c}&deg;C</strong></span>
              ) : (
                <span>Recommended: <strong>Cool &amp; Dry Pantry Storage (No numeric limit)</strong></span>
              )}
              {selectedCatalogue.reference_url && (
                <a
                  href={selectedCatalogue.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="reference-link"
                >
                  Source: {selectedCatalogue.reference_title} &nearr;
                </a>
              )}
            </div>
          </div>
        )}

        {/* Custom Display Name (Optional) */}
        <div className="form-group">
          <label htmlFor="custom_name">
            Custom Item Name <span className="optional-tag">(Optional)</span>
          </label>
          <input
            id="custom_name"
            type="text"
            className="form-control"
            placeholder={selectedCatalogue ? `e.g. Organic ${selectedCatalogue.name}` : 'e.g. Organic Whole Milk'}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            disabled={isSubmitting}
          />
          <small className="form-hint">
            Overrides standard food name in lists and alerts (e.g. &ldquo;Leftover Chicken Stew&rdquo;).
          </small>
        </div>

        {/* Quantity and Unit Row */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="quantity">
              Quantity <span className="required-star">*</span>
            </label>
            <input
              id="quantity"
              type="number"
              step="any"
              min="0.01"
              className="form-control"
              placeholder="e.g. 1.5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group flex-1">
            <label htmlFor="unit">
              Unit <span className="required-star">*</span>
            </label>
            <select
              id="unit"
              className="form-control"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              disabled={isSubmitting}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Storage Location */}
        <div className="form-group">
          <label htmlFor="storage_location">
            Storage Location <span className="required-star">*</span>
          </label>
          <select
            id="storage_location"
            className="form-control"
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value)}
            required
            disabled={isSubmitting}
          >
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          <small className="form-hint">
            Auto-selected from food safety recommendations. You may adjust to your household location.
          </small>
        </div>

        {/* Purchase Date & Expiry Date Row */}
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="purchase_date">
              Purchase / Added Date <span className="required-star">*</span>
            </label>
            <input
              id="purchase_date"
              type="date"
              className="form-control"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group flex-1">
            <label htmlFor="expiry_date">
              Package Expiry Date <span className="required-star">*</span>
            </label>
            <input
              id="expiry_date"
              type="date"
              className="form-control"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>
        <small className="form-hint" style={{ marginTop: '-0.5rem', marginBottom: '1rem', display: 'block' }}>
          Please input the exact Best Before / Use By date printed on the packaging.
        </small>

        {/* Action Buttons */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (isEditing ? 'Saving Changes...' : 'Adding Item...') : (isEditing ? 'Save Changes' : 'Add to Inventory')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
