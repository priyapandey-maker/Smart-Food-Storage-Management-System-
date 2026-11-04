import React, { useState } from 'react';
import Modal from './Modal';
import { deleteInventoryItem } from '../services/api';

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  itemToDelete,
  onSuccess,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!itemToDelete) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteInventoryItem(itemToDelete.id);
      onSuccess(itemToDelete);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to remove inventory item.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Food Item"
      maxWidth="480px"
    >
      <div className="delete-confirm-content">
        {error && (
          <div className="form-alert-error" role="alert" style={{ marginBottom: '1rem' }}>
            <span>{error}</span>
          </div>
        )}

        <div className="delete-icon-wrapper" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" stroke="#DC2626" strokeWidth="2" fill="none">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>

        <p className="delete-confirm-prompt">
          Are you sure you want to remove <strong>&ldquo;{itemToDelete.display_name}&rdquo;</strong> from your active food inventory?
        </p>

        <p className="delete-confirm-note">
          This item will be soft-deleted. It will no longer trigger expiry alerts, but all historical temperature records will be safely preserved for future audits.
        </p>

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing...' : 'Confirm Remove'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
