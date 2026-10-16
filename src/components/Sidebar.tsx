import React, { useRef } from 'react';
import { Note, Folder, Category, Bookmark, ReferenceFile } from '../types';
import { FolderTree } from './FolderTree';
import {
  BookOpen,
  Plus,
  Bookmark as BookmarkIcon,
  FileText,
  Star,
  Globe,
  FileCode,
  Upload,
  Trash2
} from 'lucide-react';

interface SidebarProps {
  notes: Note[];
  allNotes: Note[];
  folders: Folder[];
  categories: Category[];
  bookmarks: Bookmark[];
  references: ReferenceFile[];
  activeNoteId: string | null;
  activeReferenceId?: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onViewAllNotes: () => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onSelectReference: (ref: ReferenceFile) => void;
  onUploadPdf: (file: File) => Promise<void>;
  onDeleteReference?: (id: string) => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  allNotes,
  folders,
  categories,
  bookmarks,
  references,
  activeNoteId,
  activeReferenceId,
  onSelectNote,
  onNewNote,
  selectedCategoryId,
  onSelectCategory,
  selectedFolderId,
  onSelectFolder,
  onViewAllNotes,
  onCreateFolder,
  onDeleteFolder,
  onSelectReference,
  onUploadPdf,
  onDeleteReference
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await onUploadPdf(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <aside className="sidebar" aria-label="Navegação Principal">
      <div className="sidebar-header">
        <div className="app-brand">
          <BookOpen className="brand-icon" />
          <span>Knowledge Dump</span>
          <span className="brand-badge">v1.4</span>
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
            <span className="nav-badge">{allNotes.length}</span>
          </button>
        </div>

        {/* Hierarchical Folders Tree (RF-04) */}
        <div>
          <FolderTree
            folders={folders}
            notes={allNotes}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            onCreateFolder={onCreateFolder}
            onDeleteFolder={onDeleteFolder}
          />
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

        {/* References & PDFs (RF-14, RF-19) */}
        <div>
          <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Referências & Papers ({references.length})</span>
            <button
              type="button"
              className="folder-add-root-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Importar Paper PDF"
            >
              <Upload size={13} />
              <span>PDF</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {references.map((ref) => {
            const isActive = activeReferenceId === ref.id;
            return (
              <div key={ref.id} className="ref-nav-wrapper">
                <button
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectReference(ref)}
                  title={ref.title}
                >
                  <span className="nav-item-content">
                    <FileCode size={14} className="nav-item-icon text-accent" />
                    <span className="truncate">{ref.title}</span>
                  </span>
                </button>
                {onDeleteReference && (
                  <button
                    type="button"
                    className="ref-delete-btn"
                    title="Excluir referência"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Deseja remover a referência "${ref.title}"?`)) {
                        onDeleteReference(ref.id);
                      }
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
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
