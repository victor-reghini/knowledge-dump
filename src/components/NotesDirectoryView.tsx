import React, { useState } from 'react';
import { Note, Folder, Category, DirectoryViewLayout } from '../types';
import {
  LayoutGrid,
  List,
  Plus,
  Folder as FolderIcon,
  Tag as TagIcon,
  Globe,
  Star,
  FileText,
  Calendar,
  Share2
} from 'lucide-react';

interface NotesDirectoryViewProps {
  title: string;
  notes: Note[];
  currentFolder?: Folder | null;
  currentCategory?: Category | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onOpenShareModal: (note: Note) => void;
}

export const NotesDirectoryView: React.FC<NotesDirectoryViewProps> = ({
  title,
  notes,
  currentFolder,
  currentCategory,
  onSelectNote,
  onNewNote,
  onOpenShareModal
}) => {
  const [layout, setLayout] = useState<DirectoryViewLayout>('grid');
  const [filterText, setFilterText] = useState('');

  const filteredNotes = notes.filter((n) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  return (
    <div className="directory-view-container" role="region" aria-label="Navegação do Diretório">
      {/* Directory Header */}
      <div className="directory-header">
        <div className="directory-title-area">
          <h2>
            {currentCategory ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: currentCategory.color || '#eab308',
                  display: 'inline-block'
                }}
              />
            ) : currentFolder ? (
              <FolderIcon size={24} style={{ color: 'var(--primary-yellow-border)' }} />
            ) : (
              <FileText size={24} style={{ color: 'var(--primary-yellow-border)' }} />
            )}
            <span>{title}</span>
          </h2>
          <div className="directory-meta">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'nota disponível' : 'notas disponíveis'}
          </div>
        </div>

        <div className="directory-controls">
          <input
            type="text"
            placeholder="Filtrar notas..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              outline: 'none',
              width: 180
            }}
          />

          <div className="view-toggle-group">
            <button
              className={`view-toggle-btn ${layout === 'grid' ? 'active' : ''}`}
              onClick={() => setLayout('grid')}
              title="Visão em Grade (Cards)"
              aria-label="Visão em Grade"
            >
              <LayoutGrid size={16} />
              <span>Grade</span>
            </button>
            <button
              className={`view-toggle-btn ${layout === 'list' ? 'active' : ''}`}
              onClick={() => setLayout('list')}
              title="Visão em Lista"
              aria-label="Visão em Lista"
            >
              <List size={16} />
              <span>Lista</span>
            </button>
          </div>

          <button className="sidebar-action-btn" style={{ margin: 0, padding: '7px 14px' }} onClick={onNewNote}>
            <Plus size={16} />
            <span>Nova Nota</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredNotes.length === 0 && (
        <div className="empty-state">
          <FileText size={42} style={{ opacity: 0.3 }} />
          <h3>Nenhuma nota encontrada aqui</h3>
          <p>Crie uma nova nota para armazenar conhecimento neste agrupamento.</p>
          <button className="sidebar-action-btn" onClick={onNewNote}>
            <Plus size={16} />
            <span>Criar Nota</span>
          </button>
        </div>
      )}

      {/* Grid Layout (Cards) */}
      {layout === 'grid' && filteredNotes.length > 0 && (
        <div className="notes-grid">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="note-card"
              onClick={() => onSelectNote(note.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectNote(note.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="note-card-title">{note.title}</span>
                {note.is_public ? (
                  <span className="public-badge" title="Disponível publicamente">
                    <Globe size={11} />
                    <span>Pública</span>
                  </span>
                ) : null}
              </div>

              <p className="note-card-snippet">
                {note.content.replace(/[#*`_\[\]]/g, '').slice(0, 150) || 'Sem conteúdo adicional...'}
              </p>

              <div className="note-card-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {note.tags && note.tags.length > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--accent-blue)' }}>
                      <TagIcon size={12} />
                      #{note.tags[0]}
                    </span>
                  )}
                  {note.is_favorite ? <Star size={12} style={{ color: '#eab308' }} /> : null}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    title="Compartilhar Nota"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenShareModal(note);
                    }}
                  >
                    <Share2 size={13} />
                  </button>
                  <span>{new Date(note.updated_at || note.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List Layout (Rows) */}
      {layout === 'list' && filteredNotes.length > 0 && (
        <div className="notes-list">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="note-list-row"
              onClick={() => onSelectNote(note.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelectNote(note.id)}
            >
              <div className="note-list-left">
                {note.is_favorite ? (
                  <Star size={16} style={{ color: '#eab308', flexShrink: 0 }} />
                ) : (
                  <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <span className="note-list-title">{note.title}</span>

                {note.category_name && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 10,
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {note.category_name}
                  </span>
                )}

                {note.is_public ? (
                  <span className="public-badge">
                    <Globe size={11} />
                    <span>Pública</span>
                  </span>
                ) : null}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {note.tags && note.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {note.tags.slice(0, 2).map((t) => (
                      <span key={t} style={{ fontSize: '0.72rem', color: 'var(--accent-blue)' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  className="icon-btn"
                  style={{ width: 28, height: 28 }}
                  title="Compartilhar Nota"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenShareModal(note);
                  }}
                >
                  <Share2 size={14} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <Calendar size={13} />
                  <span>{new Date(note.updated_at || note.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
