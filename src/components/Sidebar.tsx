import React, { useState, useRef } from 'react';
import { Note, Folder, Category, Bookmark, ReferenceFile } from '../types';
import { FolderTree } from './FolderTree';
import { CategoryTree } from './CategoryTree';
import {
  BookOpen,
  Plus,
  Bookmark as BookmarkIcon,
  FileText,
  Star,
  Globe,
  FileCode,
  Upload,
  Trash2,
  Film,
  Music,
  Image as ImageIcon,
  Presentation,
  ChevronDown,
  Network,
  GraduationCap,
  PenTool,
  PanelLeftClose
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
  onNewNote: (fileType?: 'docx' | 'md') => void;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onViewAllNotes: () => void;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<void>;
  onUpdateFolder?: (id: string, data: { name?: string; parent_id?: string | null }) => Promise<void>;
  onDeleteFolder?: (id: string) => Promise<void>;
  onCreateCategory: (data: { name: string; color?: string; parent_id?: string | null }) => Promise<void>;
  onUpdateCategory?: (id: string, data: { name?: string; color?: string; parent_id?: string | null }) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onSelectReference: (ref: ReferenceFile) => void;
  onUploadPdf: (file: File) => Promise<void>;
  onDeleteReference?: (id: string) => Promise<void>;
  onDeleteNote?: (id: string) => Promise<void>;
  onOpenGraph?: () => void;
  isGraphOpen?: boolean;
  onOpenStudies?: () => void;
  isStudiesOpen?: boolean;
  onOpenComposition?: () => void;
  isCompositionOpen?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  onUpdateFolder,
  onDeleteFolder,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onSelectReference,
  onUploadPdf,
  onDeleteReference,
  onDeleteNote,
  onOpenGraph,
  isGraphOpen,
  onOpenStudies,
  isStudiesOpen,
  onOpenComposition,
  isCompositionOpen,
  isCollapsed,
  onToggleCollapse
}) => {
  const safeReferences = Array.isArray(references) ? references : [];
  const safeBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeFolders = Array.isArray(folders) ? folders : [];
  const safeAllNotes = Array.isArray(allNotes) ? allNotes : [];
  const safeNotes = Array.isArray(notes) ? notes : [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNewNoteMenu, setShowNewNoteMenu] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await onUploadPdf(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Navegação Principal">
      <div className="sidebar-header">
        <div className="app-brand">
          <BookOpen className="brand-icon" />
          <span>Knowledge Dump</span>
          <span className="brand-badge">v1.4</span>
        </div>
        {onToggleCollapse && (
          <button
            className="icon-btn"
            onClick={onToggleCollapse}
            title="Recolher menu lateral"
            aria-label="Recolher menu lateral"
            style={{ width: 30, height: 30 }}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <div style={{ padding: '0 12px 12px 12px', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            className="sidebar-action-btn"
            style={{ flex: 1, margin: 0 }}
            onClick={() => onNewNote('docx')}
            aria-label="Criar nova nota em formato Word (DOCX)"
            title="Criar nova nota (Editor Word - DOCX)"
          >
            <Plus size={18} />
            <span>Nova Nota</span>
          </button>
          <button
            className="sidebar-action-btn"
            style={{ width: 34, padding: 0, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowNewNoteMenu(!showNewNoteMenu)}
            title="Escolher tipo de arquivo da nota"
            aria-label="Escolher formato da nota"
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {showNewNoteMenu && (
          <div className="new-note-dropdown">
            <button
              type="button"
              className="new-note-dropdown-item active"
              onClick={() => {
                onNewNote('docx');
                setShowNewNoteMenu(false);
              }}
            >
              <FileText size={16} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Documento Word (.docx)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Padrão • Editor Completo</div>
              </div>
            </button>
            <button
              type="button"
              className="new-note-dropdown-item"
              onClick={() => {
                onNewNote('md');
                setShowNewNoteMenu(false);
              }}
            >
              <FileCode size={16} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>Documento Markdown (.md)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Texto puro com sintaxe MD</div>
              </div>
            </button>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {/* All Notes */}
        <div>
          <button
            className={`nav-item ${!selectedCategoryId && !selectedFolderId && !activeNoteId && !isGraphOpen && !isStudiesOpen && !isCompositionOpen ? 'active' : ''}`}
            onClick={onViewAllNotes}
          >
            <span className="nav-item-content">
              <FileText className="nav-item-icon" />
              <span>Todas as Notas</span>
            </span>
            <span className="nav-badge">{safeAllNotes.length}</span>
          </button>
        </div>

        {/* Knowledge Graph (RF-32, RF-33) */}
        {onOpenGraph && (
          <div>
            <button
              className={`nav-item ${isGraphOpen ? 'active' : ''}`}
              onClick={onOpenGraph}
              title="Abrir Grafo Interativo de Conhecimento"
            >
              <span className="nav-item-content">
                <Network className="nav-item-icon" style={{ color: 'var(--primary-yellow-border)' }} />
                <span>Grafo de Conhecimento</span>
              </span>
              <span className="nav-badge">{safeAllNotes.length + safeReferences.length}</span>
            </button>
          </div>
        )}

        {/* Study Module (RF-22 to RF-26) */}
        {onOpenStudies && (
          <div>
            <button
              className={`nav-item ${isStudiesOpen ? 'active' : ''}`}
              onClick={onOpenStudies}
              title="Abrir Módulo de Estudos, Exercícios e Simulados"
            >
              <span className="nav-item-content">
                <GraduationCap className="nav-item-icon" style={{ color: 'var(--accent-green)' }} />
                <span>Estudos & Exercícios</span>
              </span>
            </button>
          </div>
        )}

        {/* Scientific Composition & Articles (RF-30 & RF-31) */}
        {onOpenComposition && (
          <div>
            <button
              className={`nav-item ${isCompositionOpen ? 'active' : ''}`}
              onClick={onOpenComposition}
              title="Abrir Ambiente de Redação Científica e Exportação"
            >
              <span className="nav-item-content">
                <PenTool className="nav-item-icon" style={{ color: 'var(--kd-accent-yellow, #eab308)' }} />
                <span>Redação Científica</span>
              </span>
            </button>
          </div>
        )}

        {/* Hierarchical Folders Tree (RF-04: Criação, Edição, Mover, Remoção) */}
        <div>
          <FolderTree
            folders={safeFolders}
            notes={safeAllNotes}
            references={safeReferences}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            onCreateFolder={onCreateFolder}
            onUpdateFolder={onUpdateFolder}
            onDeleteFolder={onDeleteFolder}
          />
        </div>

        {/* Hierarchical Categories Tree (Criação, Edição, Cores, Mover, Remoção) */}
        <div>
          <CategoryTree
            categories={safeCategories}
            notes={safeAllNotes}
            references={safeReferences}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={onSelectCategory}
            onCreateCategory={onCreateCategory}
            onUpdateCategory={onUpdateCategory}
            onDeleteCategory={onDeleteCategory}
          />
        </div>

        {/* References & Multi-Format Documents (RF-12, RF-14, RF-15, RF-16, RF-18) */}
        <div>
          <div className="nav-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Referências ({safeReferences.length})</span>
            <button
              type="button"
              className="folder-add-root-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Importar Arquivo (PDF, Word, Slides, Texto, Mídia)"
            >
              <Upload size={13} />
              <span>+ Arquivo</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx,.doc,.pptx,.ppt,.pps,.ppsx,.txt,.text,.md,.markdown,.tex,.latex,.html,.htm,.mp4,.webm,.mov,.mp3,.wav,.ogg,.png,.jpg,.jpeg,.svg,.webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {safeReferences.map((ref) => {
            const isActive = activeReferenceId === ref.id;
            const type = ref.file_type?.toLowerCase() || '';
            const path = ref.file_path?.toLowerCase() || '';

            const renderRefIcon = () => {
              if (type === 'pdf' || path.endsWith('.pdf')) {
                return <FileText size={14} className="nav-item-icon" style={{ color: '#ef4444' }} />;
              }
              if (type === 'pptx' || type === 'ppt' || /\.(pptx|ppt|pps|ppsx)$/i.test(path)) {
                return <Presentation size={14} className="nav-item-icon" style={{ color: '#ea580c' }} />;
              }
              if (type === 'md' || type === 'markdown' || /\.(md|markdown)$/i.test(path)) {
                return <FileText size={14} className="nav-item-icon" style={{ color: '#10b981' }} />;
              }
              if (type === 'txt' || type === 'text' || /\.(txt|text)$/i.test(path)) {
                return <FileText size={14} className="nav-item-icon" style={{ color: '#6366f1' }} />;
              }
              if (type === 'docx' || type === 'doc' || path.endsWith('.docx') || path.endsWith('.doc')) {
                return <FileText size={14} className="nav-item-icon" style={{ color: '#3b82f6' }} />;
              }
              if (type === 'tex' || type === 'latex' || path.endsWith('.tex')) {
                return <FileCode size={14} className="nav-item-icon" style={{ color: '#a855f7' }} />;
              }
              if (type === 'video' || /\.(mp4|webm|mov|mkv)$/i.test(path)) {
                return <Film size={14} className="nav-item-icon" style={{ color: '#eab308' }} />;
              }
              if (type === 'audio' || /\.(mp3|wav|ogg|m4a)$/i.test(path)) {
                return <Music size={14} className="nav-item-icon" style={{ color: '#06b6d4' }} />;
              }
              if (type === 'image' || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(path)) {
                return <ImageIcon size={14} className="nav-item-icon" style={{ color: '#22c55e' }} />;
              }
              return <FileText size={14} className="nav-item-icon text-accent" />;
            };

            return (
              <div key={ref.id} className="ref-nav-wrapper">
                <button
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectReference(ref)}
                  title={`${ref.title} (${ref.file_type.toUpperCase()})`}
                >
                  <span className="nav-item-content">
                    {renderRefIcon()}
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
                      onDeleteReference(ref.id);
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
        {safeBookmarks.length > 0 && (
          <div>
            <div className="nav-section-title">
              <span>Marcadores ({safeBookmarks.length})</span>
            </div>
            {safeBookmarks.map((bm) => (
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

        {/* Filtered Notes & Files in selected Folder / Category */}
        <div style={{ marginTop: 'auto' }}>
          {(() => {
            const folderOrCatRefs = safeReferences.filter((r) => {
              if (selectedFolderId && r.folder_id === selectedFolderId) return true;
              if (selectedCategoryId && r.category_id === selectedCategoryId) return true;
              return false;
            });
            const totalCount = notes.length + folderOrCatRefs.length;

            return (
              <>
                <div className="nav-section-title">
                  <span>
                    {selectedCategoryId
                      ? 'Itens na Categoria'
                      : selectedFolderId
                      ? 'Itens na Pasta'
                      : 'Anotações Rápidas'} ({totalCount})
                  </span>
                </div>

                {/* References inside this folder/category */}
                {folderOrCatRefs.map((ref) => {
                  const isActive = activeReferenceId === ref.id;
                  return (
                    <div key={ref.id} className="ref-nav-wrapper">
                      <button
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectReference(ref)}
                        title={`Arquivo: ${ref.title}`}
                        style={{ borderLeft: '2px solid var(--primary-yellow-border)' }}
                      >
                        <span className="nav-item-content">
                          <FileText size={14} className="nav-item-icon" style={{ color: '#ef4444' }} />
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
                            onDeleteReference(ref.id);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Notes inside this folder/category */}
                {notes.map((note) => {
                  const isActive = activeNoteId === note.id;
                  return (
                    <div key={note.id} className="ref-nav-wrapper">
                      <button
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
                          <span className="truncate">{note.title}</span>
                        </span>
                      </button>
                      {onDeleteNote && (
                        <button
                          type="button"
                          className="ref-delete-btn"
                          title="Excluir nota"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNote(note.id);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </nav>
    </aside>
  );
};
