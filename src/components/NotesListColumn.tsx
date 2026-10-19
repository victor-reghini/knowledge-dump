import React, { useState, useMemo } from 'react';
import { Note, Folder, Category } from '../types';
import { Search, Plus, Trash2, Star, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';

interface NotesListColumnProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: (fileType?: 'docx' | 'md') => void;
  onDeleteNote?: (id: string) => void;
  title?: string;
  currentFolder?: Folder | null;
  currentCategory?: Category | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenDirectoryView?: () => void;
}

// Format relative or compact date (Ontem, Hoje, dd/mm/yy) matching Apple Notes
export function formatAppleNotesDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ontem';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Strip HTML tags and Markdown tokens for card preview
export function getCleanSnippet(content?: string, title?: string): string {
  if (!content) return 'Nenhum texto adicional';
  const clean = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_`~>[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If content starts with the title, remove it from the preview
  if (title && clean.toLowerCase().startsWith(title.toLowerCase())) {
    const remaining = clean.slice(title.length).trim();
    return remaining || 'Sem texto adicional';
  }
  return clean || 'Sem texto adicional';
}

export const NotesListColumn: React.FC<NotesListColumnProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onDeleteNote,
  title,
  currentFolder,
  currentCategory,
  isCollapsed,
  onToggleCollapse,
  onOpenDirectoryView
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || (n.content && n.content.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  const displayTitle = currentCategory?.name || currentFolder?.name || title || 'Notas';

  if (isCollapsed) {
    return (
      <div className="notes-column-collapsed">
        <button
          className="notes-column-toggle-btn"
          onClick={onToggleCollapse}
          title="Expandir lista de notas"
          aria-label="Expandir lista de notas"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="notes-list-column" role="region" aria-label="Lista de Notas">
      {/* Search Bar - Apple Notes style */}
      <div className="notes-column-search-container">
        <div className="apple-search-bar">
          <Search size={15} className="apple-search-icon" />
          <input
            type="text"
            className="apple-search-input"
            placeholder="Buscar todas as notas"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="apple-search-clear"
              onClick={() => setSearchQuery('')}
              title="Limpar busca"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Header with Title, Count and Quick New Note */}
      <div className="notes-column-header">
        <div className="notes-column-header-info">
          <span className="notes-column-title truncate">{displayTitle}</span>
          <span className="notes-column-count">{filteredNotes.length} notas</span>
        </div>

        <div className="notes-column-header-actions">
          {onOpenDirectoryView && (
            <button
              type="button"
              className="notes-column-action-btn"
              onClick={onOpenDirectoryView}
              title="Alternar para visualização em grade do diretório"
            >
              <LayoutGrid size={15} />
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="notes-column-action-btn primary"
              onClick={() => onNewNote('docx')}
              title="Criar nova nota"
            >
              <Plus size={16} />
            </button>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              className="notes-column-action-btn"
              onClick={onToggleCollapse}
              title="Recolher lista de notas"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Notes Cards List */}
      <div className="notes-cards-scroll">
        {filteredNotes.length === 0 ? (
          <div className="notes-empty-state">
            <p className="empty-title">Nenhuma nota encontrada</p>
            <p className="empty-subtitle">
              {searchQuery ? 'Tente outro termo de busca' : 'Crie sua primeira nota clicando no botão +'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                className="apple-new-note-btn"
                onClick={() => onNewNote('docx')}
              >
                <Plus size={15} />
                <span>Nova Nota</span>
              </button>
            )}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isSelected = activeNoteId === note.id;
            const dateText = formatAppleNotesDate(note.updated_at || note.created_at);
            const snippetText = getCleanSnippet(note.content, note.title);

            return (
              <div
                key={note.id}
                className={`apple-note-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectNote(note.id)}
              >
                <div className="apple-note-card-main">
                  <div className="apple-note-card-title-row">
                    <span className="apple-note-card-title truncate">
                      {note.title || 'Sem Título'}
                    </span>
                    {note.is_favorite && (
                      <Star size={12} className="apple-note-star" style={{ color: '#eab308' }} />
                    )}
                  </div>

                  <div className="apple-note-card-meta-row">
                    <span className="apple-note-card-date">{dateText}</span>
                    <span className="apple-note-card-snippet truncate">{snippetText}</span>
                  </div>
                </div>

                {onDeleteNote && (
                  <button
                    type="button"
                    className="apple-note-card-delete"
                    title="Excluir nota"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(note.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
