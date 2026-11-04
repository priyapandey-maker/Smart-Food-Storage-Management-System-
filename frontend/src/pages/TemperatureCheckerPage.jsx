import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { getInventory, checkTemperature, simulateTemperature } from '../services/api';

/**
 * Format ISO datetime string to user-friendly local date & time.
 */
function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function TemperatureCheckerPage() {
  // Inventory state
  const [inventoryList, setInventoryList] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState(null);

  // Selected item state
  const [selectedItemId, setSelectedItemId] = useState('');

  // Check & Simulation state
  const [manualTemp, setManualTemp] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalError, setEvalError] = useState(null);
  const [evalResult, setEvalResult] = useState(null);

  // Fetch active inventory items on mount
  const loadInventoryItems = async () => {
    setIsLoadingItems(true);
    setItemsError(null);
    try {
      const items = await getInventory();
      setInventoryList(items || []);
      // If user had a selection that still exists, keep it; otherwise reset
      if (selectedItemId && !items.some((it) => it.id === Number(selectedItemId))) {
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
  const handleItemSelect = (e) => {
    const newId = e.target.value;
    setSelectedItemId(newId);
    // Crucial rule: clear prior evaluation result, validation errors, and input
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

  // Handler: Run demo simulation
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

  // Clear current evaluation result
  const handleClearResult = () => {
    setEvalResult(null);
    setEvalError(null);
    setManualTemp('');
  };

  // Render loading state
  if (isLoadingItems) {
    return (
      <div className="page-checker">
        <PageHeading
          title="Temperature Checker"
          subtitle="Compare manual probe readings and automated simulations against official FoodSafety.gov & USDA guidelines."
        />
        <LoadingState message="Loading active inventory items..." />
      </div>
    );
  }

  // Render error loading inventory
  if (itemsError) {
    return (
      <div className="page-checker">
        <PageHeading
          title="Temperature Checker"
          subtitle="Compare manual probe readings and automated simulations against official FoodSafety.gov & USDA guidelines."
        />
        <ErrorState
          title="Unable to load inventory"
          message={itemsError}
          onRetry={loadInventoryItems}
        />
      </div>
    );
  }

  return (
    <div className="page-checker">
      <PageHeading
        title="Temperature Checker"
        subtitle="Compare physical probe readings and demonstration test simulations against verified household food-safety limits."
      />

      {/* Empty State when no items exist */}
      {inventoryList.length === 0 ? (
        <Card className="empty-checker-card">
          <div className="placeholder-box" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🧊</span>
            <p className="primary" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              No Active Food Inventory Items
            </p>
            <p className="secondary" style={{ maxWidth: '480px', margin: '0 auto 1.5rem' }}>
              Temperature evaluation requires at least one active item in your inventory. Add food items to your inventory to start evaluating storage conditions.
            </p>
            <Link to="/inventory" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              ➕ Go to Food Inventory
            </Link>
          </div>
        </Card>
      ) : (
        <div className="checker-layout">
          {/* ================================================================= */}
          {/* Left Column: Selection, Manual Input & Simulation Controls        */}
          {/* ================================================================= */}
          <div className="checker-col-controls">
            {/* 1. Item Selection Card */}
            <Card title="1. Select Food Item" subtitle="Choose an active item from your inventory">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="inventory-item-select" className="form-label">
                  Food Item to Evaluate <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                </label>
                <select
                  id="inventory-item-select"
                  className="form-control"
                  value={selectedItemId}
                  onChange={handleItemSelect}
                  disabled={isEvaluating}
                >
                  <option value="">-- Choose an active food item --</option>
                  {inventoryList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name} ({item.storage_location} • {item.catalogue?.storage_type || 'STANDARD'})
                    </option>
                  ))}
                </select>
                <small className="form-hint" style={{ marginTop: '0.45rem', display: 'block' }}>
                  Switching items automatically clears prior test results.
                </small>
              </div>
            </Card>

            {/* 2. Manual Temperature Check Form */}
            <Card
              title="2. Manual Temperature Check"
              subtitle="Enter physical probe or thermometer reading in degrees Celsius"
              className={!selectedItem ? 'card-disabled-subtle' : ''}
            >
              <form onSubmit={handleManualCheck}>
                <div className="form-group">
                  <label htmlFor="manual-temp-input" className="form-label">
                    Recorded Temperature (&deg;C) <span style={{ color: 'var(--status-danger-text)' }}>*</span>
                  </label>
                  <div className="temp-input-wrapper">
                    <input
                      id="manual-temp-input"
                      type="number"
                      step="0.1"
                      className="form-control temp-input"
                      placeholder={
                        selectedItem
                          ? selectedItem.catalogue?.storage_type === 'FROZEN'
                            ? 'e.g. -19.5'
                            : 'e.g. 3.2'
                          : 'Select an item first'
                      }
                      value={manualTemp}
                      onChange={(e) => {
                        setManualTemp(e.target.value);
                        if (evalError) setEvalError(null);
                      }}
                      disabled={!selectedItem || isEvaluating}
                    />
                    <span className="temp-unit-addon">&deg;C</span>
                  </div>
                  {selectedItem && (
                    <small className="form-hint" style={{ marginTop: '0.45rem', display: 'block' }}>
                      Target Limit:{' '}
                      <strong>
                        {selectedItem.catalogue?.storage_type === 'REFRIGERATED' && '≤ 4.0°C (Refrigerated)'}
                        {selectedItem.catalogue?.storage_type === 'FROZEN' && '≤ -18.0°C (Frozen)'}
                        {selectedItem.catalogue?.storage_type === 'AMBIENT' && 'Ambient (Cool & Dry — No numerical limit)'}
                      </strong>
                    </small>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={!selectedItem || !manualTemp.trim() || isEvaluating}
                >
                  {isEvaluating ? (
                    <>
                      <span className="btn-spinner" /> Evaluating Reading...
                    </>
                  ) : (
                    '🌡️ Check Temperature'
                  )}
                </button>
              </form>
            </Card>

            {/* 3. Demo Temperature Simulator Card */}
            <Card
              title="3. Demonstration Simulator"
              subtitle="Generate realistic readings to test alert workflows during reviews"
              className={!selectedItem ? 'card-disabled-subtle' : ''}
            >
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                Simulate point-in-time temperatures calibrated to verified household storage benchmarks:
              </p>

              <div className="simulator-button-grid">
                <button
                  type="button"
                  className="btn-simulate btn-simulate-safe"
                  onClick={() => handleSimulate('safe')}
                  disabled={!selectedItem || isEvaluating}
                  title="Simulate compliant temperature within target limit"
                >
                  <span className="sim-icon">🛡️</span>
                  <div className="sim-text">
                    <strong>Simulate Safe Reading</strong>
                    <small>
                      {selectedItem?.catalogue?.storage_type === 'FROZEN'
                        ? '-24°C to -19°C (Safe Frozen)'
                        : selectedItem?.catalogue?.storage_type === 'AMBIENT'
                        ? '16°C to 22°C (Dry Pantry)'
                        : '0.5°C to 3.8°C (Safe Chilled)'}
                    </small>
                  </div>
                </button>

                <button
                  type="button"
                  className="btn-simulate btn-simulate-warn"
                  onClick={() => handleSimulate('warning')}
                  disabled={!selectedItem || isEvaluating}
                  title="Simulate breach reading above maximum limit"
                >
                  <span className="sim-icon">⚠️</span>
                  <div className="sim-text">
                    <strong>Simulate Warning Reading</strong>
                    <small>
                      {selectedItem?.catalogue?.storage_type === 'FROZEN'
                        ? '-17°C to -8°C (Frozen Breach)'
                        : selectedItem?.catalogue?.storage_type === 'AMBIENT'
                        ? '26°C to 34°C (Warm Storage)'
                        : '4.5°C to 11.5°C (Chilled Breach)'}
                    </small>
                  </div>
                </button>

                <button
                  type="button"
                  className="btn-simulate btn-simulate-random"
                  onClick={() => handleSimulate('random')}
                  disabled={!selectedItem || isEvaluating}
                  title="Simulate unbiased randomized reading"
                >
                  <span className="sim-icon">🎲</span>
                  <div className="sim-text">
                    <strong>Simulate Random Reading</strong>
                    <small>Dynamic randomized presentation test</small>
                  </div>
                </button>
              </div>
            </Card>

            {/* Error Callout */}
            {evalError && (
              <div className="checker-error-callout">
                <span style={{ fontSize: '1.25rem' }}>❌</span>
                <div style={{ flex: 1 }}>
                  <strong>Evaluation Error</strong>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>{evalError}</p>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setEvalError(null)}
                  title="Dismiss error"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* Right Column: Item Context Guidelines & Evaluation Result Card    */}
          {/* ================================================================= */}
          <div className="checker-col-results">
            {/* If no item selected yet */}
            {!selectedItem ? (
              <Card title="Target Guidelines & Results" subtitle="Awaiting item selection">
                <div className="placeholder-box" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>👈</span>
                  <p className="primary">Select an active item on the left</p>
                  <p className="secondary" style={{ maxWidth: '380px', margin: '0 auto' }}>
                    Choose any inventory item to view verified storage limits, preservation guidelines, and run temperature checks.
                  </p>
                </div>
              </Card>
            ) : (
              <>
                {/* Selected Item Guidelines Context Card */}
                <Card
                  title={selectedItem.display_name}
                  subtitle={`${selectedItem.catalogue?.category || 'General'} • Added ${selectedItem.purchase_date}`}
                  action={<StatusBadge status={selectedItem.catalogue?.storage_type} />}
                >
                  <div className="selected-item-meta-grid">
                    <div className="meta-box">
                      <span className="meta-label">Storage Location</span>
                      <strong className="meta-val">{selectedItem.storage_location}</strong>
                    </div>

                    <div className="meta-box">
                      <span className="meta-label">Maximum Threshold</span>
                      <strong className="meta-val">
                        {selectedItem.catalogue?.max_temp_c !== null && selectedItem.catalogue?.max_temp_c !== undefined
                          ? `≤ ${selectedItem.catalogue.max_temp_c.toFixed(1)}°C`
                          : 'No numerical limit'}
                      </strong>
                    </div>

                    <div className="meta-box">
                      <span className="meta-label">Inventory Quantity</span>
                      <strong className="meta-val">
                        {selectedItem.quantity} {selectedItem.unit}
                      </strong>
                    </div>

                    <div className="meta-box">
                      <span className="meta-label">Expiry Status</span>
                      <div style={{ marginTop: '0.2rem' }}>
                        <StatusBadge status={selectedItem.expiry_status} />
                      </div>
                    </div>
                  </div>

                  {/* Storage guidance callout */}
                  <div className="storage-guidance-callout">
                    <span className="guidance-icon">💡</span>
                    <div className="guidance-text">
                      <strong>Storage Guidance</strong>
                      <p>{selectedItem.catalogue?.storage_guidance || 'Store properly according to food safety guidelines.'}</p>
                    </div>
                  </div>

                  {/* Authority reference citation */}
                  {selectedItem.catalogue?.reference_title && (
                    <div className="item-authority-citation">
                      <span style={{ fontSize: '0.9rem' }}>📚 Authority Reference: </span>
                      {selectedItem.catalogue?.reference_url ? (
                        <a
                          href={selectedItem.catalogue.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="citation-link"
                        >
                          {selectedItem.catalogue.reference_title} ↗
                        </a>
                      ) : (
                        <span>{selectedItem.catalogue.reference_title}</span>
                      )}
                    </div>
                  )}

                  {/* Latest recorded check preview */}
                  {selectedItem.latest_temp_check && !evalResult && (
                    <div className="previous-check-box">
                      <div className="prev-check-header">
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          Latest Recorded Reading
                        </span>
                        <StatusBadge status={selectedItem.latest_temp_check.status} />
                      </div>
                      <div className="prev-check-body">
                        <span className="prev-temp">
                          {selectedItem.latest_temp_check.recorded_temp_c.toFixed(1)}&deg;C
                        </span>
                        <span className="prev-time">
                          Checked: {formatDateTime(selectedItem.latest_temp_check.checked_at)}
                          {selectedItem.latest_temp_check.is_simulated && ' • [Demo Simulation]'}
                        </span>
                      </div>
                      <p className="prev-msg">{selectedItem.latest_temp_check.message}</p>
                    </div>
                  )}
                </Card>

                {/* Authoritative Evaluation Result Card */}
                {evalResult && (
                  <div className={`eval-result-card eval-status-${evalResult.status.toLowerCase()}`}>
                    <div className="eval-result-header">
                      <div className="eval-status-pill-group">
                        <StatusBadge
                          status={evalResult.status}
                          label={
                            evalResult.status === 'WITHIN_LIMIT'
                              ? 'Within Recommended Limit'
                              : evalResult.status === 'ABOVE_LIMIT'
                              ? 'Above Recommended Maximum'
                              : 'No Numerical Limit (Ambient)'
                          }
                        />
                        {evalResult.is_simulated && (
                          <span className="eval-simulated-pill">Demo Simulation</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-clear-result"
                        onClick={handleClearResult}
                        title="Clear evaluation result"
                      >
                        ✕ Clear
                      </button>
                    </div>

                    <div className="eval-hero-section">
                      <div className="eval-temp-hero">
                        <span className="eval-temp-number">
                          {evalResult.recorded_temp_c.toFixed(1)}&deg;C
                        </span>
                        <span className="eval-temp-label">Recorded Temperature</span>
                      </div>

                      <div className="eval-threshold-summary">
                        <div className="threshold-row">
                          <span className="th-label">Storage Classification:</span>
                          <span className="th-val">{evalResult.storage_type}</span>
                        </div>
                        <div className="threshold-row">
                          <span className="th-label">Preservation Ceiling:</span>
                          <span className="th-val">
                            {evalResult.max_temp_c !== null && evalResult.max_temp_c !== undefined
                              ? `≤ ${evalResult.max_temp_c.toFixed(1)}°C`
                              : 'None (Ambient)'}
                          </span>
                        </div>
                        <div className="threshold-row">
                          <span className="th-label">Evaluation Timestamp:</span>
                          <span className="th-val">{formatDateTime(evalResult.checked_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Authoritative Backend Evaluation Message */}
                    <div className="eval-message-callout">
                      <span className="callout-symbol">
                        {evalResult.status === 'WITHIN_LIMIT'
                          ? '✓'
                          : evalResult.status === 'ABOVE_LIMIT'
                          ? '⚠️'
                          : 'ℹ️'}
                      </span>
                      <div className="callout-content">
                        <strong>Official Evaluation Finding</strong>
                        <p>{evalResult.message}</p>
                      </div>
                    </div>

                    {/* Authoritative Actionable Guidance */}
                    <div className="eval-actionable-guidance">
                      {evalResult.status === 'ABOVE_LIMIT' && (
                        <div className="guidance-breach-alert">
                          <strong>⚠️ Food Safety Warning:</strong>
                          <p>
                            Storage temperature exceeds the recommended limit. Bacterial multiplication (e.g. <em>Salmonella</em>, <em>Listeria</em>) accelerates rapidly above 4.0&deg;C. Inspect door gaskets, verify cooling thermostat settings, and inspect food texture and odor before consumption.
                          </p>
                        </div>
                      )}

                      {evalResult.status === 'WITHIN_LIMIT' && (
                        <div className="guidance-safe-note">
                          <strong>✓ Temperature Compliance Confirmed:</strong>
                          <p>
                            Recorded temperature is within the recommended maximum temperature limit. The cooling environment effectively suppresses bacterial proliferation according to published FoodSafety.gov benchmarks.
                          </p>
                        </div>
                      )}

                      {evalResult.status === 'NO_LIMIT' && (
                        <div className="guidance-ambient-note">
                          <strong>ℹ️ Ambient Storage Condition:</strong>
                          <p>
                            Pantry goods do not require active refrigeration. Maintain a cool, dry, and sealed environment to prevent moisture condensation and insect infestation.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Verified Reference Citation */}
                    {evalResult.reference_title && (
                      <div className="eval-reference-footer">
                        <span>Verified Standard: </span>
                        {evalResult.reference_url ? (
                          <a
                            href={evalResult.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="citation-link"
                          >
                            {evalResult.reference_title} ↗
                          </a>
                        ) : (
                          <span>{evalResult.reference_title}</span>
                        )}
                      </div>
                    )}

                    {/* Disclaimer box */}
                    <div className="eval-disclaimer-box">
                      <strong>Food Safety Disclaimer:</strong> This evaluation represents a single point-in-time check against verified household storage benchmarks. Point-in-time temperature readings do not guarantee food safety if items were previously temperature-abused or have exceeded their safe expiration date. Always inspect freshness before eating.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* Permanent Household Temperature Benchmarks Reference Card           */}
      {/* =================================================================== */}
      <Card
        title="Verified Household Temperature Benchmarks"
        subtitle="Official temperature thresholds based on FoodSafety.gov & USDA FSIS standards"
      >
        <div className="benchmark-list">
          <div className="benchmark-card">
            <div className="benchmark-header">
              <span className="benchmark-icon">❄️</span>
              <div>
                <strong>Refrigerator Threshold: &le; 4.0&deg;C (40.0&deg;F)</strong>
                <span className="benchmark-tag tag-refrig">Chilled Storage</span>
              </div>
            </div>
            <p className="benchmark-desc">
              Keeps food safely cold to prevent rapid pathogen multiplication in fresh meats, dairy, poultry, and cooked leftovers. Any reading &gt; 4.0&deg;C constitutes a temperature breach.
            </p>
          </div>

          <div className="benchmark-card">
            <div className="benchmark-header">
              <span className="benchmark-icon">🧊</span>
              <div>
                <strong>Freezer Threshold: &le; -18.0&deg;C (0.0&deg;F)</strong>
                <span className="benchmark-tag tag-frozen">Frozen Storage</span>
              </div>
            </div>
            <p className="benchmark-desc">
              Halts microbial activity completely, preventing bacterial multiplication and maintaining nutritional quality for long-term household preservation.
            </p>
          </div>

          <div className="benchmark-card">
            <div className="benchmark-header">
              <span className="benchmark-icon">🍞</span>
              <div>
                <strong>Pantry / Dry Storage: Cool &amp; Dry</strong>
                <span className="benchmark-tag tag-ambient">Ambient Storage</span>
              </div>
            </div>
            <p className="benchmark-desc">
              No universal numerical ceiling. Requires airtight containers in a cool, well-ventilated, pest-resistant environment protected from direct sunlight and humidity.
            </p>
          </div>
        </div>

        <div className="danger-zone-callout">
          <strong>⚠️ The "Danger Zone" Rule (4.0&deg;C to 60.0&deg;C / 40&deg;F to 140&deg;F):</strong>
          <p>
            Perishable food left in the danger zone for more than 2 hours (or 1 hour in ambient temperatures above 32&deg;C/90&deg;F) should be discarded, as harmful bacteria can double every 20 minutes.
          </p>
        </div>
      </Card>
    </div>
  );
}
