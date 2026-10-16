import React, { useState } from 'react';
import { Note } from '../types';
import { api } from '../api';
import { X, Globe, Copy, Check, BookOpen, Network } from 'lucide-react';

interface ShareModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (noteId: string, updates: Partial<Note>) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  note,
  isOpen,
  onClose,
  onUpdated
}) => {
  if (!isOpen || !note) return null;

  const [isPublic, setIsPublic] = useState(!!note.is_public);
  const [includeSources, setIncludeSources] = useState(!!note.share_include_sources);
  const [includeRelated, setIncludeRelated] = useState(!!note.share_include_related);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const publicUrl = note.share_token
    ? `${window.location.origin}/#/shared/${note.share_token}`
    : `${window.location.origin}/#/shared/token-gerado-ao-salvar`;

  const handleSaveShare = async () => {
    setSaving(true);
    try {
      const res = await api.shareNote(note.id, {
        is_public: isPublic,
        share_include_sources: includeSources,
        share_include_related: includeRelated
      });
      onUpdated(note.id, {
        is_public: res.is_public,
        share_token: res.share_token,
        share_include_sources: res.share_include_sources,
        share_include_related: res.share_include_related
      });
      if (!isPublic) {
        onClose();
      }
    } catch (err) {
      console.error('Erro ao atualizar compartilhamento:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!note.share_token) return;
    const url = `${window.location.origin}/#/shared/${note.share_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Compartilhar Nota"
    >
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={18} style={{ color: 'var(--accent-green)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Compartilhar Conhecimento</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Documento Selecionado:</span>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: 2 }}>{note.title}</div>
          </div>

          {/* Toggle Public */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Disponibilizar como Pública</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Permite que qualquer pessoa com o link visualize esta nota sem necessidade de login.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--primary-yellow-border)', cursor: 'pointer' }}
            />
          </div>

          {/* Share Options */}
          {isPublic && (
            <div style={{ padding: '0 4px', marginBottom: 20 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Opções de Compartilhamento em Rede
              </div>

              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeSources}
                  onChange={(e) => setIncludeSources(e.target.checked)}
                  style={{ marginTop: 3, accentColor: 'var(--accent-blue)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} style={{ color: 'var(--accent-blue)' }} />
                    <span>Compartilhar também fontes e referências citadas</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Disponibiliza os metadados dos papers, livros e arquivos anexos originais citados na nota.
                  </span>
                </div>
              </label>

              <label className="form-checkbox-row">
                <input
                  type="checkbox"
                  checked={includeRelated}
                  onChange={(e) => setIncludeRelated(e.target.checked)}
                  style={{ marginTop: 3, accentColor: 'var(--accent-blue)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Network size={14} style={{ color: 'var(--accent-blue)' }} />
                    <span>Compartilhar notas relacionadas (Wikilinks)</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Permite que o leitor navegue também pelos conceitos e notas interligadas a este tema.
                  </span>
                </div>
              </label>

              {/* Share link box */}
              {note.share_token && (
                <div style={{ marginTop: 14 }}>
                  <div className="form-label">Link Público de Acesso:</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className="form-input"
                      style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                    />
                    <button className="btn-blue" onClick={handleCopyLink} title="Copiar link público">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button className="toolbar-btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '8px 18px' }}
              onClick={handleSaveShare}
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
