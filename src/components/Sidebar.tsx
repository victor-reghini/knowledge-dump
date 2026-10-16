import React from 'react';
import { Note, Folder, Category, Bookmark } from '../types';
import {
  BookOpen,
  Plus,
  Folder as FolderIcon,
  Bookmark as BookmarkIcon,
  FileText,
  Star,
  Globe
} from 'lucide-react';

interface SidebarProps {
  notes: Note[];
  allNotes: Note[];
  folders: Folder[];
  categories: Category[];
  bookmarks: Bookmark[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onViewAllNotes: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  allNotes,
  folders,
  categories,
  bookmarks,
  activeNoteId,
  onSelectNote,
  onNewNote,
  selectedCategoryId,
  onSelectCategory,
  selectedFolderId,
  onSelectFolder,
  onViewAllNotes
}) => {
  return (
    <aside className="sidebar" aria-label="Navegação Principal">
      <div className="sidebar-header">
        <div className="app-brand">
          <BookOpen className="brand-icon" />
          <span>Knowledge Dump</span>
          <span className="brand-badge">v1.1</span>
        </div>
      </div>

      <button className="sidebar-action-btn" onClick={onNewNote} aria-label="Criar nova nota">
        <Plus size={18} />
        <span>Nova Nota</span>
      </button>

      <nav className="sidebar-nav">
        {/* All Notes */}
        <div>
          <button
            className={`nav-item ${!selectedCategoryId && !selectedFolderId && !activeNoteId ? 'active' : ''}`}
            onClick={onViewAllNotes}
          >
            <span className="nav-item-content">
              <FileText className="nav-item-icon" />
              <span>Todas as Notas</span>
            </span>
            <span className="nav-badge">{notes.length}</span>
          </button>
        </div>

        {/* Folders (RF-04: Clicking opens directory view) */}
        <div>
          <div className="nav-section-title">
            <span>Pastas</span>
          </div>
          {folders.map((folder) => {
            const count = allNotes.filter((n) => n.folder_id === folder.id).length;
            const isActive = selectedFolderId === folder.id;
            return (
              <button
                key={folder.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectFolder(isActive ? null : folder.id)}
              >
                <span className="nav-item-content">
                  <FolderIcon className="nav-item-icon" />
                  <span>{folder.name}</span>
                </span>
                <span className="nav-badge">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Categories (RF-04: Clicking opens directory view) */}
        <div>
          <div className="nav-section-title">
            <span>Categorias</span>
          </div>
          {categories.map((cat) => {
            const count = allNotes.filter((n) => n.category_id === cat.id).length;
            const isActive = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectCategory(isActive ? null : cat.id)}
              >
                <span className="nav-item-content">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: cat.color || '#eab308',
                      marginRight: 10
                    }}
                  />
                  <span>{cat.name}</span>
                </span>
                <span className="nav-badge">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Bookmarks */}
        {bookmarks.length > 0 && (
          <div>
            <div className="nav-section-title">
              <span>Marcadores ({bookmarks.length})</span>
            </div>
            {bookmarks.map((bm) => (
              <button
                key={bm.id}
                className="nav-item"
                onClick={() => bm.note_id && onSelectNote(bm.note_id)}
                title={bm.comment || bm.title}
              >
                <span className="nav-item-content">
                  <BookmarkIcon className="nav-item-icon" style={{ color: '#eab308' }} />
                  <span>{bm.title}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Filtered Notes List */}
        <div style={{ marginTop: 'auto' }}>
          <div className="nav-section-title">
            <span>
              {selectedCategoryId
                ? 'Notas na Categoria'
                : selectedFolderId
                ? 'Notas na Pasta'
                : 'Anotações Rápidas'} ({notes.length})
            </span>
          </div>
          {notes.map((note) => {
            const isActive = activeNoteId === note.id;
            return (
              <button
                key={note.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectNote(note.id)}
              >
                <span className="nav-item-content">
                  {note.is_favorite ? (
                    <Star size={14} className="nav-item-icon" style={{ color: '#eab308' }} />
                  ) : note.is_public ? (
                    <Globe size={14} className="nav-item-icon" style={{ color: 'var(--accent-green)' }} />
                  ) : (
                    <FileText size={14} className="nav-item-icon" />
                  )}
                  <span>{note.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
};
