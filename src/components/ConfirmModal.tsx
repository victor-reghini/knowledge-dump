import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemTitle,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: isDestructive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDestructive ? 'var(--accent-red)' : 'var(--wikilink-orphan)'
              }}
            >
              {isDestructive ? <Trash2 size={16} /> : <AlertTriangle size={16} />}
            </div>
            <h3 id="confirm-modal-title" style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {message}
          </p>
          {itemTitle && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                wordBreak: 'break-word'
              }}
            >
              {itemTitle}
            </div>
          )}
          <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Esta ação é permanente e removerá o item do seu acervo.
          </p>
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10
          }}
        >
          <button
            type="button"
            className="toolbar-btn"
            style={{ padding: '7px 14px', fontSize: '0.85rem', fontWeight: 500 }}
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-red"
            style={{
              padding: '7px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
            onClick={onConfirm}
            disabled={isLoading}
            autoFocus
          >
            <Trash2 size={14} />
            <span>{isLoading ? 'Excluindo...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
