import React, { useState, useEffect, useRef } from 'react';
import { SearchResult } from '../types';
import { api } from '../api';
import { Search, X, FileText } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (noteId: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResult
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data);
      } catch (err) {
        console.error('Falha na busca:', err);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Busca Global FTS5"
    >
      <div className="modal-content">
        <div className="search-input-wrapper">
          <Search size={20} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            className="modal-search-input"
            placeholder="Pesquisar em todas as notas e referências (SQLite FTS5)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {query && (
            <button
              className="icon-btn"
              onClick={() => setQuery('')}
              style={{ width: 28, height: 28 }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="search-results-list">
          {loading && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Pesquisando no índice FTS5...
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Nenhum resultado encontrado para "<strong>{query}</strong>".
            </div>
          )}

          {!loading &&
            results.map((res) => (
              <div
                key={res.id}
                className="search-result-item"
                onClick={() => {
                  onSelectResult(res.id);
                  onClose();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <FileText size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span className="search-result-title">{res.title}</span>
                  {res.category_name && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.72rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      {res.category_name}
                    </span>
                  )}
                </div>
                <div
                  className="search-result-snippet"
                  dangerouslySetInnerHTML={{ __html: res.snippet || '' }}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
