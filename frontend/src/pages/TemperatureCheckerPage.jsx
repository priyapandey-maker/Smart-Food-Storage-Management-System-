import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getInventory, checkTemperature, simulateTemperature } from '../services/api';

/**
 * Format Celsius to Fahrenheit for US standard benchmarks.
 */
function toFahrenheit(celsius) {
  if (celsius === null || celsius === undefined || isNaN(celsius)) return null;
  return ((Number(celsius) * 9) / 5 + 32).toFixed(1);
}

/**
 * Formats temperature string with Celsius and Fahrenheit standard benchmark.
 */
function formatTempWithFahrenheit(celsius) {
  if (celsius === null || celsius === undefined) return null;
  const c = Number(celsius);
  let f;
  if (Math.abs(c - 4.0) < 0.05) {
    f = '40';
  } else if (Math.abs(c - (-18.0)) < 0.05) {
    f = '0';
  } else {
    f = ((c * 9) / 5 + 32).toFixed(1);
  }
  return `${c.toFixed(1)}°C (${f}°F)`;
}

/**
 * Food visual representation based on food item and category.
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
  if (lower.includes('rice') || lower.includes('pasta') || lower.includes('bread'))
    return { emoji: '🍞', color: '#FEF9C3' };
  if (lower.includes('leftover') || lower.includes('cooked')) return { emoji: '🍲', color: '#FEF3C7' };
  return { emoji: '📦', color: '#F1F5F9' };
}

export default function TemperatureCheckerPage() {
  // Inventory state
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState(null);

  // Selected item state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Check & Simulation state
  const [manualTemp, setManualTemp] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [evalResult, setEvalResult] = useState(null);

  // Close custom dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch active inventory items on mount
  const loadInventoryItems = async () => {
    setIsLoadingItems(true);
    setItemsError(null);
    try {
      const items = await getInventory();
      setInventoryList(items || []);

      // If user had a selection that still exists, keep it; otherwise default to first item if available
      if (items && items.length > 0) {
        if (!selectedItemId || !items.some((it) => it.id === Number(selectedItemId))) {
          setSelectedItemId(String(items[0].id));
        }
      } else {
        setSelectedItemId('');
        setEvalResult(null);
      }
    } catch (err) {
      setItemsError(err.message || 'Failed to load active inventory items.');
    } finally {
      setIsLoadingItems(false);
    }
  };

  useEffect(() => {
    loadInventoryItems();
  }, []);

  // Selected item object derived from state
  const selectedItem = inventoryList.find((it) => it.id === Number(selectedItemId)) || null;

  // Handler: Change selected inventory item
  const handleSelectFood = (id) => {
    setSelectedItemId(String(id));
    setIsDropdownOpen(false);
    // Clear prior evaluation result and manual input on item change
    setEvalResult(null);
    setEvalError(null);
    setManualTemp('');
  };

  // Handler: Submit manual temperature check
  const handleManualCheck = async (e) => {
    e.preventDefault();
    if (!selectedItem) {
      setEvalError('Please select a food inventory item first.');
      return;
    }

    const trimmed = String(manualTemp).trim();
    if (!trimmed) {
      setEvalError('Please enter a recorded temperature in °C.');
      return;
    }

    const tempVal = parseFloat(trimmed);
    if (isNaN(tempVal)) {
      setEvalError('Recorded temperature must be a valid numerical value.');
      return;
    }

    if (tempVal < -50.0 || tempVal > 60.0) {
      setEvalError('Temperature must be between -50.0°C and 60.0°C for household storage evaluation.');
      return;
    }

    setIsEvaluating(true);
    setEvalError(null);

    try {
      const result = await checkTemperature({
        inventory_id: selectedItem.id,
        recorded_temp_c: tempVal,
      });
      setEvalResult(result);

      // Update local item's latest_temp_check for instant feedback
      setInventoryList((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? {
              ...it,
              latest_temp_check: {
                id: result.id,
                recorded_temp_c: result.recorded_temp_c,
                status: result.status,
                message: result.message,
                is_simulated: result.is_simulated,
                checked_at: result.checked_at,
              },
            }
            : it
        )
      );
    } catch (err) {
      setEvalError(err.message || 'Temperature evaluation failed. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handler: Run demo simulation (safe, warning, random)
  const handleSimulate = async (mode) => {
    if (!selectedItem) {
      setEvalError('Please select a food inventory item first.');
      return;
    }

    setIsEvaluating(true);
    setEvalError(null);

    try {
      const result = await simulateTemperature({
        inventory_id: selectedItem.id,
        mode,
      });
      setEvalResult(result);

      // Update local item's latest_temp_check for instant feedback
      setInventoryList((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? {
              ...it,
              latest_temp_check: {
                id: result.id,
                recorded_temp_c: result.recorded_temp_c,
                status: result.status,
                message: result.message,
                is_simulated: result.is_simulated,
                checked_at: result.checked_at,
              },
            }
            : it
        )
      );
    } catch (err) {
      setEvalError(err.message || `Simulation mode "${mode}" failed.`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Render loading state
  if (isLoadingItems) {
    return (
      <div className="page-checker">
        <div className="checker-page-heading">
          <h2>Temperature Checker</h2>
          <p>Check temperatures, evaluate food safety, and follow official guidelines.</p>
        </div>
        <LoadingState message="Loading active inventory items..." />
      </div>
    );
  }

  // Render error loading inventory
  if (itemsError) {
    return (
      <div className="page-checker">
        <div className="checker-page-heading">
          <h2>Temperature Checker</h2>
          <p>Check temperatures, evaluate food safety, and follow official guidelines.</p>
        </div>
        <ErrorState
          title="Unable to load inventory"
          message={itemsError}
          onRetry={loadInventoryItems}
        />
      </div>
    );
  }

  const selectedVisual = selectedItem
    ? getFoodVisual(selectedItem.display_name, selectedItem.catalogue?.category)
    : { emoji: '📦', color: '#F1F5F9' };

  return (
    <div className="page-checker">
      {/* =================================================================== */}
      {/* 1. Page Heading                                                     */}
      {/* =================================================================== */}
      <div className="checker-page-heading">
        <h2>Temperature Checker</h2>
        <p>Check temperatures, evaluate food safety, and follow official guidelines.</p>
      </div>

      {/* When no inventory items exist */}
      {inventoryList.length === 0 ? (
        <div className="checker-empty-card">
          <div className="checker-empty-content">
            <span className="empty-icon-lg">🧊</span>
            <h3>No Active Food Inventory Items</h3>
            <p>
              Temperature evaluation requires at least one active item in your inventory. Add food items to your inventory to start evaluating storage conditions.
            </p>
            <Link to="/inventory" className="btn-add-food-primary" style={{ textDecoration: 'none' }}>
              + Go to Food Inventory
            </Link>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* 2. Two-Column Layout                                                */
        /* =================================================================== */
        <div className="checker-two-column-layout">
          {/* ================================================================= */}
          {/* Left Column: Temperature Check Tools                              */}
          {/* ================================================================= */}
          <div className="checker-column-tools">
            <div className="checker-card-container">
              {/* Forest Green Header Bar */}
              <div className="checker-card-header-bar">
                <span className="header-bar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                  </svg>
                </span>
                <h3 className="header-bar-title">Temperature Check Tools</h3>
              </div>

              <div className="checker-card-body">
                {/* Step 1: Select Food Item */}
                <div className="tool-step-section">
                  <div className="step-title-row">
                    <span className="step-number-badge">1</span>
                    <label className="step-label">Select Food Item</label>
                  </div>

                  {/* Custom Styled Food Item Selector */}
                  <div className="food-selector-wrapper" ref={dropdownRef}>
                    <div
                      className={`food-selector-selected-box ${isDropdownOpen ? 'open' : ''}`}
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                      role="button"
                      tabIndex={0}
                      aria-haspopup="listbox"
                      aria-expanded={isDropdownOpen}
                    >
                      <div
                        className="food-selector-avatar"
                        style={{ backgroundColor: selectedVisual.color }}
                        aria-hidden="true"
                      >
                        <span>{selectedVisual.emoji}</span>
                      </div>
                      <div className="food-selector-text">
                        <span className="food-selector-name">
                          {selectedItem ? selectedItem.display_name : 'Select a food item...'}
                        </span>
                        <span className="food-selector-sub">
                          {selectedItem ? (
                            <>
                              {selectedItem.catalogue?.category || 'General'} •{' '}
                              {selectedItem.catalogue?.max_temp_c !== null && selectedItem.catalogue?.max_temp_c !== undefined
                                ? `Max ${formatTempWithFahrenheit(selectedItem.catalogue?.max_temp_c)}`
                                : 'Ambient (Cool & Dry)'}
                            </>
                          ) : (
                            'Choose an active item from your inventory'
                          )}
                        </span>
                      </div>
                      <span className="food-selector-chevron" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          fill="none"
                          style={{
                            transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s ease',
                          }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </div>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="food-selector-dropdown-menu" role="listbox">
                        {inventoryList.map((item) => {
                          const vis = getFoodVisual(item.display_name, item.catalogue?.category);
                          const isSelected = item.id === Number(selectedItemId);

                          return (
                            <div
                              key={item.id}
                              className={`dropdown-item-option ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleSelectFood(item.id)}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div
                                className="dropdown-option-avatar"
                                style={{ backgroundColor: vis.color }}
                                aria-hidden="true"
                              >
                                <span>{vis.emoji}</span>
                              </div>
                              <div className="dropdown-option-text">
                                <span className="option-name">{item.display_name}</span>
                                <span className="option-meta">
                                  {item.storage_location} •{' '}
                                  {item.catalogue?.max_temp_c !== null && item.catalogue?.max_temp_c !== undefined
                                    ? `Max ≤ ${item.catalogue.max_temp_c}°C`
                                    : 'Ambient'}
                                </span>
                              </div>
                              {isSelected && <span className="option-check">✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Manual Temperature Check */}
                <div className="tool-step-section">
                  <div className="step-title-row">
                    <span className="step-number-badge">2</span>
                    <label htmlFor="manual-temp-input" className="step-label">
                      Manual Temperature Check
                    </label>
                  </div>

                  <form onSubmit={handleManualCheck} className="manual-temp-form-row">
                    <div className="manual-temp-input-group">
                      <input
                        id="manual-temp-input"
                        type="number"
                        step="0.1"
                        className="manual-temp-input"
                        placeholder="Enter temperature..."
                        value={manualTemp}
                        onChange={(e) => {
                          setManualTemp(e.target.value);
                          if (evalError) setEvalError(null);
                        }}
                        disabled={!selectedItem || isEvaluating}
                      />
                      <span className="manual-temp-unit">°C</span>
                    </div>

                    <button
                      type="submit"
                      className="btn-check-temp-submit"
                      disabled={!selectedItem || !manualTemp.trim() || isEvaluating}
                    >
                      {isEvaluating ? (
                        <span>Checking...</span>
                      ) : (
                        <>
                          <span className="btn-icon-check">✓</span>
                          <span>Check Temperature</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Step 3: Demonstration Simulator */}
                <div className="tool-step-section">
                  <div className="step-title-row">
                    <span className="step-number-badge">3</span>
                    <label className="step-label">Demonstration Simulator</label>
                  </div>

                  <div className="simulation-buttons-three-row">
                    {/* Safe button */}
                    <button
                      type="button"
                      className="btn-sim-pill btn-sim-safe"
                      onClick={() => handleSimulate('safe')}
                      disabled={!selectedItem || isEvaluating}
                      title="Simulate compliant temperature within target limit"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      <span>Safe</span>
                    </button>

                    {/* Warning button */}
                    <button
                      type="button"
                      className="btn-sim-pill btn-sim-warning"
                      onClick={() => handleSimulate('warning')}
                      disabled={!selectedItem || isEvaluating}
                      title="Simulate breach reading above maximum limit"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Warning</span>
                    </button>

                    {/* Random button */}
                    <button
                      type="button"
                      className="btn-sim-pill btn-sim-random"
                      onClick={() => handleSimulate('random')}
                      disabled={!selectedItem || isEvaluating}
                      title="Simulate unbiased randomized reading"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
                        <polyline points="16 3 21 3 21 8" />
                        <line x1="4" y1="20" x2="21" y2="3" />
                        <polyline points="21 16 21 21 16 21" />
                        <line x1="15" y1="15" x2="21" y2="21" />
                        <line x1="4" y1="4" x2="9" y2="9" />
                      </svg>
                      <span>Random</span>
                    </button>
                  </div>
                </div>

                {/* Food Safety Reminder Callout Box */}
                <div className="food-safety-reminder-box">
                  <div className="reminder-icon-circle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </div>
                  <div className="reminder-content">
                    <strong className="reminder-title">Food Safety Reminder</strong>
                    <p className="reminder-text">
                      Keep perishable foods at or below 4°C (40°F) in the refrigerator and at or below -18°C (0°F) in the freezer.
                    </p>
                    <a
                      href="https://www.foodsafety.gov/keep-food-safe/4-steps-to-food-safety"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reminder-link"
                    >
                      Learn more: FoodSafety.gov ↗
                    </a>
                  </div>
                </div>

                {/* Error Callout */}
                {evalError && (
                  <div className="checker-error-box" role="alert">
                    <span>⚠️ {evalError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* Right Column: Temperature Evaluation Result                       */}
          {/* ================================================================= */}
          <div className="checker-column-result">
            <div className="checker-card-container">
              {/* Forest Green Header Bar */}
              <div className="checker-card-header-bar">
                <span className="header-bar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <h3 className="header-bar-title">Temperature Evaluation Result</h3>
              </div>

              <div className="checker-card-body">
                {evalResult ? (
                  /* Live Evaluation Result Display */
                  <div className="eval-result-live-content">
                    {/* Top Result Banner: Giant Temp & Status Badge */}
                    <div className="eval-temp-display-row">
                      <div className="eval-temp-left">
                        <div
                          className={`thermometer-icon-large ${evalResult.status === 'WITHIN_LIMIT'
                              ? 'icon-green'
                              : evalResult.status === 'ABOVE_LIMIT'
                                ? 'icon-red'
                                : 'icon-slate'
                            }`}
                          aria-hidden="true"
                        >
                          <svg viewBox="0 0 24 24" width="52" height="52" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                            <circle cx="11.5" cy="16.5" r="2.2" fill="currentColor" />
                            <line x1="11.5" y1="9" x2="11.5" y2="14.3" stroke="currentColor" strokeWidth="2.4" />
                          </svg>
                        </div>

                        <div className="eval-temp-number-block">
                          <span className="temp-large-val">
                            {evalResult.recorded_temp_c.toFixed(1)}°C
                          </span>
                          <span className="temp-large-sub">
                            ({toFahrenheit(evalResult.recorded_temp_c)}°F)
                          </span>
                        </div>
                      </div>

                      <div className="eval-temp-right">
                        <div
                          className={`result-status-pill ${evalResult.status === 'WITHIN_LIMIT'
                              ? 'pill-safe'
                              : evalResult.status === 'ABOVE_LIMIT'
                                ? 'pill-danger'
                                : 'pill-neutral'
                            }`}
                        >
                          <span className="status-symbol">
                            {evalResult.status === 'WITHIN_LIMIT' ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : evalResult.status === 'ABOVE_LIMIT' ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                                <polygon points="10.29 3.86 1.82 18 18.76 18 13.71 3.86 10.29 3.86" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            )}
                          </span>
                          <span>
                            {evalResult.status === 'WITHIN_LIMIT'
                              ? 'WITHIN LIMIT'
                              : evalResult.status === 'ABOVE_LIMIT'
                                ? 'ABOVE LIMIT'
                                : 'NO LIMIT'}
                          </span>
                        </div>

                        <span className="result-max-recommendation">
                          {evalResult.max_temp_c !== null && evalResult.max_temp_c !== undefined ? (
                            <>Recommended Max: {formatTempWithFahrenheit(evalResult.max_temp_c)}</>
                          ) : (
                            'Recommended: Ambient (Cool & Dry)'
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Food Safety Status Box */}
                    <div
                      className={`food-safety-status-box ${evalResult.status === 'WITHIN_LIMIT'
                          ? 'box-safe'
                          : evalResult.status === 'ABOVE_LIMIT'
                            ? 'box-danger'
                            : 'box-neutral'
                        }`}
                    >
                      <div className="status-box-header">
                        <span className="status-box-icon" aria-hidden="true">
                          {evalResult.status === 'WITHIN_LIMIT' ? (
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                              <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" clipRule="evenodd" />
                            </svg>
                          ) : evalResult.status === 'ABOVE_LIMIT' ? (
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                              <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                              <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                        <strong>Food Safety Status</strong>
                      </div>
                      <p className="status-box-message">{evalResult.message}</p>
                    </div>

                    {/* Storage Guidance Section */}
                    <div className="guidance-detail-container">
                      <div className="guidance-left-text">
                        <div className="guidance-title-row">
                          <span className="guidance-book-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                          </span>
                          <strong>Storage Guidance</strong>
                        </div>
                        <p className="guidance-desc-text">
                          {evalResult.storage_guidance ||
                            'Keep food stored properly according to official cold storage charts.'}
                        </p>
                        {evalResult.reference_title && (
                          <div className="guidance-citation-row">
                            <span>Source: </span>
                            {evalResult.reference_url ? (
                              <a
                                href={evalResult.reference_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="guidance-citation-link"
                              >
                                {evalResult.reference_title} ↗
                              </a>
                            ) : (
                              <span>{evalResult.reference_title}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Food Illustration */}
                      <div
                        className="guidance-right-visual"
                        style={{ backgroundColor: selectedVisual.color }}
                        aria-hidden="true"
                      >
                        <span>{selectedVisual.emoji}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Instructive Empty Evaluation State */
                  <div className="eval-awaiting-state-box">
                    <div className="awaiting-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="48" height="48" stroke="#166534" strokeWidth="1.5" fill="none">
                        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                      </svg>
                    </div>
                    <h4>Ready for Temperature Evaluation</h4>
                    <p>
                      {selectedItem ? (
                        <>
                          Target limit for <strong>{selectedItem.display_name}</strong>:{' '}
                          {selectedItem.catalogue?.max_temp_c !== null && selectedItem.catalogue?.max_temp_c !== undefined
                            ? `≤ ${formatTempWithFahrenheit(selectedItem.catalogue.max_temp_c)}`
                            : 'Cool & Dry (Ambient)'}
                          .<br />
                          Enter a physical thermometer probe reading on the left or click one of the simulator buttons to evaluate.
                        </>
                      ) : (
                        'Select an active food item from your inventory on the left to begin evaluating storage temperatures.'
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. Household Storage Safety Standards (Bottom 4 Cards)             */}
      {/* =================================================================== */}
      <div className="standards-card-outer">
        <div className="standards-card-title-row">
          <div className="standards-title-group">
            <span className="standards-shield-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </span>
            <h3 className="standards-title">Household Storage Safety Standards</h3>
          </div>
        </div>

        <div className="standards-four-grid">
          {/* Card 1: Refrigerator */}
          <div className="standard-benchmark-card">
            <div className="benchmark-icon-box text-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="5" y1="10" x2="19" y2="10" />
                <line x1="9" y1="6" x2="9" y2="8" />
                <line x1="9" y1="14" x2="9" y2="16" />
              </svg>
            </div>
            <div className="benchmark-text-body">
              <h4>Refrigerator</h4>
              <p className="benchmark-temp">≤ 4.0°C (40°F)</p>
              <p className="benchmark-desc">Keep cold foods at or below 4°C.</p>
            </div>
          </div>

          {/* Card 2: Freezer */}
          <div className="standard-benchmark-card">
            <div className="benchmark-icon-box text-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
              </svg>
            </div>
            <div className="benchmark-text-body">
              <h4>Freezer</h4>
              <p className="benchmark-temp">≤ -18.0°C (0°F)</p>
              <p className="benchmark-desc">Keep frozen foods at or below -18°C.</p>
            </div>
          </div>

          {/* Card 3: Pantry */}
          <div className="standard-benchmark-card">
            <div className="benchmark-icon-box text-orange" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="benchmark-text-body">
              <h4>Pantry</h4>
              <p className="benchmark-temp">Cool &amp; Dry</p>
              <p className="benchmark-desc">Store in a cool, dry place.</p>
            </div>
          </div>

          {/* Card 4: 2-Hour Danger Zone */}
          <div className="standard-benchmark-card danger-zone-highlight-card">
            <div className="benchmark-icon-box text-amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="benchmark-text-body">
              <h4>2-Hour Danger Zone</h4>
              <p className="benchmark-temp text-dark">4.4°C – 60°C (40°F – 140°F)</p>
              <p className="benchmark-desc">
                Do not leave perishable foods in this range for &gt; 2 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
