'use client';
import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  loading?: boolean;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
  confirmClass?: string;
}

export default function ConfirmDialog({
  open, onClose, onConfirm,
  title = 'Confirm Action',
  message,
  loading = false,
  confirmLabel = 'Delete',
  confirmLoadingLabel,
  confirmClass = 'btn-danger',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
        <button onClick={onConfirm} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${confirmClass}`} disabled={loading}>
          {loading && (
            <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          )}
          {loading ? (confirmLoadingLabel ?? 'Processing...') : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
