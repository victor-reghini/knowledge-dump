import React, { useState } from 'react';
import { Note, Folder, Category, DirectoryViewLayout, ReferenceFile } from '../types';
import {
  LayoutGrid,
  List,
  Plus,
  Folder as FolderIcon,
  Tag as TagIcon,
  Globe,
  Star,
  FileText,
  FileCode,
  Film,
  Music,
  Image as ImageIcon,
  Presentation,
  Calendar,
  Share2,
  FolderInput,
  FolderOpen,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  Trash2
} from 'lucide-react';

interface NotesDirectoryViewProps {
  title: string;
  notes: Note[];
  references?: ReferenceFile[];
  folders?: Folder[];
  categories?: Category[];
  currentFolder?: Folder | null;
  currentCategory?: Category | null;
  onSelectNote: (id: string) => void;
  onSelectReference?: (ref: ReferenceFile) => void;
  onUpdateReference?: (id: string, data: Partial<ReferenceFile>) => Promise<void>;
  onNewNote: (fileType?: 'docx' | 'md') => void;
  onOpenShareModal: (note: Note) => void;
  onDeleteNote?: (id: string) => Promise<void>;
  onDeleteReference?: (id: string) => Promise<void>;
}

export const NotesDirectoryView: React.FC<NotesDirectoryViewProps> = ({
  title,
  notes,
  references = [],
  folders = [],
  categories = [],
  currentFolder,
  currentCategory,
  onSelectNote,
  onSelectReference,
  onUpdateReference,
  onNewNote,
  onOpenShareModal,
  onDeleteNote,
  onDeleteReference
}) => {
  const [layout, setLayout] = useState<DirectoryViewLayout>('grid');
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'notes' | 'references'>('all');
  const [showNewNoteMenu, setShowNewNoteMenu] = useState(false);

  // Organizing modal state for a reference file
  const [organizingRef, setOrganizingRef] = useState<ReferenceFile | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);

  const filteredNotes = notes.filter((n) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const filteredReferences = references.filter((r) => {
    if (currentFolder && r.folder_id !== currentFolder.id) return false;
    if (currentCategory && r.category_id !== currentCategory.id) return false;
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      (r.authors && r.authors.toLowerCase().includes(q)) ||
      r.file_type.toLowerCase().includes(q)
    );
  });

  const totalItems = filteredNotes.length + filteredReferences.length;

  const handleStartOrganize = (ref: ReferenceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrganizingRef(ref);
    setTargetFolderId(ref.folder_id || null);
    setTargetCategoryId(ref.category_id || null);
  };

  const handleConfirmOrganize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizingRef || !onUpdateReference) return;
    await onUpdateReference(organizingRef.id, {
      folder_id: targetFolderId,
      category_id: targetCategoryId
    });
    setOrganizingRef(null);
  };

  const renderFileIcon = (fileType: string, filePath?: string) => {
    const type = fileType?.toLowerCase() || '';
    const path = filePath?.toLowerCase() || '';
    if (type === 'pdf' || path.endsWith('.pdf')) {
      return <FileText size={18} style={{ color: '#ef4444' }} />;
    }
    if (type === 'pptx' || type === 'ppt' || /\.(pptx|ppt|pps|ppsx)$/i.test(path)) {
      return <Presentation size={18} style={{ color: '#ea580c' }} />;
    }
    if (type === 'md' || type === 'markdown' || /\.(md|markdown)$/i.test(path)) {
      return <FileText size={18} style={{ color: '#10b981' }} />;
    }
    if (type === 'txt' || type === 'text' || /\.(txt|text)$/i.test(path)) {
      return <FileText size={18} style={{ color: '#6366f1' }} />;
    }
    if (type === 'docx' || type === 'doc' || path.endsWith('.docx') || path.endsWith('.doc')) {
      return <FileText size={18} style={{ color: '#3b82f6' }} />;
    }
    if (type === 'tex' || type === 'latex' || path.endsWith('.tex')) {
      return <FileCode size={18} style={{ color: '#a855f7' }} />;
    }
    if (type === 'video' || /\.(mp4|webm|mov|mkv)$/i.test(path)) {
      return <Film size={18} style={{ color: '#eab308' }} />;
    }
    if (type === 'audio' || /\.(mp3|wav|ogg|m4a)$/i.test(path)) {
      return <Music size={18} style={{ color: '#06b6d4' }} />;
    }
    if (type === 'image' || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(path)) {
      return <ImageIcon size={18} style={{ color: '#22c55e' }} />;
    }
    return <FileText size={18} className="text-accent" />;
  };

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
            {filteredNotes.length} {filteredNotes.length === 1 ? 'nota' : 'notas'}
            {filteredReferences.length > 0 &&
              ` • ${filteredReferences.length} ${filteredReferences.length === 1 ? 'arquivo' : 'arquivos'}`}
          </div>
        </div>

        <div className="directory-controls">
          <input
            type="text"
            placeholder="Filtrar nesta pasta..."
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

          <div style={{ position: 'relative', display: 'flex', gap: 2 }}>
            <button
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '7px 14px' }}
              onClick={() => onNewNote('docx')}
              title="Nova Nota no formato Word (DOCX)"
            >
              <Plus size={16} />
              <span>Nova Nota</span>
            </button>
            <button
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '7px 8px' }}
              onClick={() => setShowNewNoteMenu(!showNewNoteMenu)}
              title="Escolher tipo de arquivo"
            >
              <ChevronDown size={14} />
            </button>

            {showNewNoteMenu && (
              <div className="new-note-dropdown" style={{ right: 0, left: 'auto', top: '100%', marginTop: 4 }}>
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
        </div>
      </div>

      {/* Filter Tabs (Todos, Notas, Arquivos) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>
        <button
          className={`toolbar-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)' }}
        >
          <span>Todos ({totalItems})</span>
        </button>
        <button
          className={`toolbar-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
          style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)' }}
        >
          <FileText size={14} />
          <span>Notas ({filteredNotes.length})</span>
        </button>
        <button
          className={`toolbar-btn ${activeTab === 'references' ? 'active' : ''}`}
          onClick={() => setActiveTab('references')}
          style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)' }}
        >
          <FolderOpen size={14} />
          <span>Arquivos ({filteredReferences.length})</span>
        </button>
      </div>

      {/* Empty State */}
      {totalItems === 0 && (
        <div className="empty-state">
          <FileText size={42} style={{ opacity: 0.3 }} />
          <h3>Nenhum item encontrado nesta pasta</h3>
          <p>Crie uma nova nota ou associe arquivos de referência a este agrupamento.</p>
          <button className="sidebar-action-btn" onClick={onNewNote}>
            <Plus size={16} />
            <span>Criar Nota</span>
          </button>
        </div>
      )}

      {/* Grid Layout (Cards) */}
      {layout === 'grid' && totalItems > 0 && (
        <div className="notes-grid">
          {/* Reference File Cards (PDFs, DOCX, LaTeX, Vídeos, etc.) */}
          {(activeTab === 'all' || activeTab === 'references') &&
            filteredReferences.map((ref) => {
              const cat = categories.find((c) => c.id === ref.category_id);
              const fld = folders.find((f) => f.id === ref.folder_id);
              return (
                <div
                  key={ref.id}
                  className="note-card"
                  style={{ borderLeft: '3px solid var(--primary-yellow-border)' }}
                  onClick={() => onSelectReference && onSelectReference(ref)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectReference && onSelectReference(ref)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      {renderFileIcon(ref.file_type, ref.file_path)}
                      <span className="note-card-title" title={ref.title}>
                        {ref.title}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {ref.file_type}
                    </span>
                  </div>

                  <p className="note-card-snippet">
                    {ref.authors ? `Autores: ${ref.authors}` : 'Documento de referência catalogado no acervo.'}
                    {ref.year ? ` • Ano: ${ref.year}` : ''}
                  </p>

                  <div className="note-card-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {cat && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor: `${cat.color || '#eab308'}22`,
                            color: cat.color || '#eab308'
                          }}
                        >
                          <TagIcon size={10} />
                          {cat.name}
                        </span>
                      )}
                      {fld && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <FolderIcon size={10} />
                          {fld.name}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {onUpdateReference && (
                        <button
                          className="icon-btn"
                          style={{ width: 26, height: 26 }}
                          title="Mover para pasta / categorizar arquivo"
                          onClick={(e) => handleStartOrganize(ref, e)}
                        >
                          <FolderInput size={13} />
                        </button>
                      )}
                      {onDeleteReference && (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 26, height: 26, color: 'var(--wikilink-orphan)' }}
                          title="Excluir arquivo de referência"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDeleteReference(ref.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <span title="Abrir no leitor de documentos">
                        <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* Note Cards */}
          {(activeTab === 'all' || activeTab === 'notes') &&
            filteredNotes.map((note) => (
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
                    {onDeleteNote && (
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 26, height: 26, color: 'var(--wikilink-orphan)' }}
                        title="Excluir Nota"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteNote(note.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <span>{new Date(note.updated_at || note.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* List Layout (Rows) */}
      {layout === 'list' && totalItems > 0 && (
        <div className="notes-list">
          {/* Reference Rows */}
          {(activeTab === 'all' || activeTab === 'references') &&
            filteredReferences.map((ref) => {
              const cat = categories.find((c) => c.id === ref.category_id);
              const fld = folders.find((f) => f.id === ref.folder_id);
              return (
                <div
                  key={ref.id}
                  className="note-list-row"
                  style={{ borderLeft: '3px solid var(--primary-yellow-border)' }}
                  onClick={() => onSelectReference && onSelectReference(ref)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectReference && onSelectReference(ref)}
                >
                  <div className="note-list-left">
                    {renderFileIcon(ref.file_type, ref.file_path)}
                    <span className="note-list-title">{ref.title}</span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        borderRadius: 4,
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {ref.file_type}
                    </span>
                    {fld && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        📁 {fld.name}
                      </span>
                    )}
                    {cat && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: `${cat.color || '#eab308'}22`,
                          color: cat.color || '#eab308'
                        }}
                      >
                        ● {cat.name}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {ref.authors && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {ref.authors} {ref.year ? `(${ref.year})` : ''}
                      </span>
                    )}

                    {onUpdateReference && (
                      <button
                        className="icon-btn"
                        style={{ width: 28, height: 28 }}
                        title="Organizar arquivo em pasta / categoria"
                        onClick={(e) => handleStartOrganize(ref, e)}
                      >
                        <FolderInput size={14} />
                      </button>
                    )}

                    {onDeleteReference && (
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 28, height: 28, color: 'var(--wikilink-orphan)' }}
                        title="Excluir arquivo de referência"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteReference(ref.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    <span title="Abrir referência">
                      <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                    </span>
                  </div>
                </div>
              );
            })}

          {/* Note Rows */}
          {(activeTab === 'all' || activeTab === 'notes') &&
            filteredNotes.map((note) => (
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

                  {onDeleteNote && (
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 28, height: 28, color: 'var(--wikilink-orphan)' }}
                      title="Excluir Nota"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Calendar size={13} />
                    <span>{new Date(note.updated_at || note.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal / Dialog de Organização de Arquivo em Pastas e Categorias */}
      {organizingRef && (
        <div
          className="modal-backdrop"
          onClick={() => setOrganizingRef(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 24px',
              maxWidth: 440,
              width: '90%',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderInput size={18} style={{ color: 'var(--primary-yellow-border)' }} />
                <span>Organizar Arquivo</span>
              </h3>
              <button
                className="icon-btn"
                onClick={() => setOrganizingRef(null)}
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Defina a pasta e a categoria para o arquivo <strong>{organizingRef.title}</strong>:
            </p>

            <form onSubmit={handleConfirmOrganize}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                  Pasta de Destino:
                </label>
                <select
                  value={targetFolderId || ''}
                  onChange={(e) => setTargetFolderId(e.target.value ? e.target.value : null)}
                  className="tree-parent-select"
                  style={{ width: '100%', padding: '8px 10px' }}
                >
                  <option value="">(Sem pasta - Raiz do Acervo)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                  Categoria Temática:
                </label>
                <select
                  value={targetCategoryId || ''}
                  onChange={(e) => setTargetCategoryId(e.target.value ? e.target.value : null)}
                  className="tree-parent-select"
                  style={{ width: '100%', padding: '8px 10px' }}
                >
                  <option value="">(Sem categoria)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      ● {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="toolbar-btn"
                  onClick={() => setOrganizingRef(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="sidebar-action-btn"
                  style={{ margin: 0, padding: '6px 16px' }}
                >
                  <Check size={14} />
                  <span>Salvar Organização</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
