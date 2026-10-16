import React, { useState, useEffect, useRef } from 'react';
import { Note, Category, Folder } from '../types';
import {
  Eye,
  Edit3,
  Bookmark as BookmarkIcon,
  Tag as TagIcon,
  Link as LinkIcon,
  Trash2,
  Save,
  Check,
  Share2,
  Globe,
  Star
} from 'lucide-react';

interface NoteEditorProps {
  note: Note;
  categories: Category[];
  folders: Folder[];
  allNotes: Note[];
  onSave: (id: string, updates: Partial<Note>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNavigateToNoteTitle: (title: string) => void;
  onAddBookmark: (noteId: string, title: string, comment?: string) => Promise<void>;
  onOpenShare: (note: Note) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  categories,
  folders,
  allNotes,
  onSave,
  onDelete,
  onNavigateToNoteTitle,
  onAddBookmark,
  onOpenShare
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [categoryId, setCategoryId] = useState<string | null>(note.category_id);
  const [folderId, setFolderId] = useState<string | null>(note.folder_id);
  const [isSaved, setIsSaved] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [bookmarkComment, setBookmarkComment] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategoryId(note.category_id);
    setFolderId(note.folder_id);
    setIsSaved(true);
  }, [note]);

  useEffect(() => {
    if (viewMode === 'edit' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(380, textareaRef.current.scrollHeight)}px`;
    }
  }, [content, viewMode]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsSaved(false);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(380, e.target.scrollHeight)}px`;
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsSaved(false);
  };

  const triggerSave = async () => {
    await onSave(note.id, {
      title,
      content,
      category_id: categoryId,
      folder_id: folderId
    });
    setIsSaved(true);
  };

  const handleCreateBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmarkTitle.trim()) return;
    await onAddBookmark(note.id, bookmarkTitle.trim(), bookmarkComment.trim() || undefined);
    setBookmarkTitle('');
    setBookmarkComment('');
    setShowBookmarkPrompt(false);
  };

  // Inline renderer for Wikilinks [[Title]] and bold **text**
  const renderInlineContent = (text: string) => {
    const wikiParts = text.split(/(\[\[[^\]]+\]\])/g);

    return wikiParts.map((wikiPart, wIdx) => {
      const match = wikiPart.match(/^\[\[([^\]#]+)(?:#([^\]]+))?\]\]$/);
      if (match) {
        const targetTitle = match[1].trim();
        const targetAnchor = match[2]?.trim();
        const exists = allNotes.some((n) => n.title.toLowerCase() === targetTitle.toLowerCase());

        return (
          <span
            key={`w-${wIdx}`}
            className={`wikilink ${!exists ? 'orphan' : ''}`}
            onClick={() => onNavigateToNoteTitle(targetTitle)}
            title={
              exists
                ? `Wikilink para "${targetTitle}"${targetAnchor ? ` (Âncora: #${targetAnchor})` : ''}`
                : `Nota "${targetTitle}" ainda não existe. Clique para criar (Link Órfão estilo Wikipédia)`
            }
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onNavigateToNoteTitle(targetTitle);
            }}
          >
            <LinkIcon size={12} style={{ marginRight: 4, display: 'inline' }} />
            {targetTitle}
            {targetAnchor && <small> #{targetAnchor}</small>}
          </span>
        );
      }

      // Handle bold **text**
      const boldParts = wikiPart.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((boldPart, bIdx) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return <strong key={`b-${wIdx}-${bIdx}`}>{boldPart.slice(2, -2)}</strong>;
        }
        return boldPart;
      });
    });
  };

  // Render hypertext Markdown with lists, headings, and clean block flow
  const renderHypertextPreview = (text: string) => {
    const rawLines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];

    const flushList = (key: string) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`ul-${key}`} style={{ paddingLeft: 24, margin: '8px 0 16px 0' }}>
            {listBuffer}
          </ul>
        );
        listBuffer = [];
      }
    };

    rawLines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Unordered list item (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = line.replace(/^\s*[-*]\s+/, '');
        listBuffer.push(
          <li key={`li-${idx}`} style={{ marginBottom: 6, lineHeight: 1.6 }}>
            {renderInlineContent(itemText)}
          </li>
        );
        return;
      }

      // Non-list line flushes list
      flushList(`flush-${idx}`);

      if (trimmed === '') {
        elements.push(<div key={`empty-${idx}`} style={{ height: 12 }} />);
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${idx}`} style={{ fontSize: '1.9rem', margin: '22px 0 12px 0', fontWeight: 800 }}>
            {renderInlineContent(trimmed.slice(2))}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`h2-${idx}`} style={{ fontSize: '1.4rem', margin: '18px 0 10px 0', fontWeight: 700 }}>
            {renderInlineContent(trimmed.slice(3))}
          </h2>
        );
      } else if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${idx}`} style={{ fontSize: '1.15rem', margin: '14px 0 8px 0', fontWeight: 600 }}>
            {renderInlineContent(trimmed.slice(4))}
          </h3>
        );
      } else {
        elements.push(
          <p key={`p-${idx}`} style={{ marginBottom: 12, lineHeight: 1.7 }}>
            {renderInlineContent(line)}
          </p>
        );
      }
    });

    flushList('final');
    return elements;
  };

  return (
    <main className="editor-pane" role="main">
      {/* Meta Bar */}
      <div className="note-meta-bar">
        <select
          value={categoryId || ''}
          onChange={(e) => {
            setCategoryId(e.target.value || null);
            setIsSaved(false);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}
        >
          <option value="">Sem Categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={folderId || ''}
          onChange={(e) => {
            setFolderId(e.target.value || null);
            setIsSaved(false);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}
        >
          <option value="">Raiz (Sem Pasta)</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        {note.tags && note.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6 }}>
            {note.tags.map((t) => (
              <span key={t} className="category-tag">
                <TagIcon size={12} />
                #{t}
              </span>
            ))}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="toolbar-btn"
            onClick={triggerSave}
            disabled={isSaved}
            style={{ color: isSaved ? 'var(--text-muted)' : 'var(--accent-primary)' }}
          >
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            <span>{isSaved ? 'Salvo' : 'Salvar'}</span>
          </button>
          <button
            className="toolbar-btn"
            onClick={() => onDelete(note.id)}
            style={{ color: 'var(--wikilink-orphan)' }}
            title="Excluir Nota"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Note Title */}
      <input
        type="text"
        className="note-title-input"
        value={title}
        onChange={handleTitleChange}
        placeholder="Título da Anotação..."
      />

      {/* Toolbar */}
      <div className="note-toolbar">
        <button
          className={`toolbar-btn ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => setViewMode('preview')}
        >
          <Eye size={15} />
          <span>Leitura Hipertextual</span>
        </button>
        <button
          className={`toolbar-btn ${viewMode === 'edit' ? 'active' : ''}`}
          onClick={() => setViewMode('edit')}
        >
          <Edit3 size={15} />
          <span>Editar Texto</span>
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

        <button
          className="toolbar-btn"
          onClick={() => setShowBookmarkPrompt(!showBookmarkPrompt)}
          title="Adicionar Marcador / Marca-Página nesta nota"
        >
          <BookmarkIcon size={15} style={{ color: '#eab308' }} />
          <span>Criar Marcador</span>
        </button>

        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

        <button
          className="btn-blue"
          onClick={() => onOpenShare(note)}
          title="Configurar compartilhamento público e rede de notas"
        >
          <Share2 size={14} />
          <span>Compartilhar</span>
        </button>

        {note.is_public ? (
          <span className="public-badge" style={{ marginLeft: 6 }}>
            <Globe size={11} />
            <span>Pública</span>
          </span>
        ) : null}
      </div>

      {/* Bookmark Form */}
      {showBookmarkPrompt && (
        <form
          onSubmit={handleCreateBookmark}
          style={{
            padding: 14,
            marginBottom: 20,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookmarkIcon size={14} className="bookmark-gold" />
            <span>Novo Marca-Página / Marcador Contextual</span>
          </div>
          <input
            type="text"
            placeholder="Título do marcador (ex: 'Definição Central')..."
            value={bookmarkTitle}
            onChange={(e) => setBookmarkTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              marginBottom: 8,
              fontSize: '0.9rem'
            }}
            required
          />
          <input
            type="text"
            placeholder="Comentário ou anotação contextual (opcional)..."
            value={bookmarkComment}
            onChange={(e) => setBookmarkComment(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              marginBottom: 10,
              fontSize: '0.85rem'
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="toolbar-btn"
              onClick={() => setShowBookmarkPrompt(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Salvar Marcador
            </button>
          </div>
        </form>
      )}

      {/* Bookmarks on this note */}
      {note.bookmarks && note.bookmarks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {note.bookmarks.map((bm) => (
            <div key={bm.id} className="bookmark-item">
              <BookmarkIcon size={16} className="bookmark-gold" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{bm.title}</div>
                {bm.comment && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {bm.comment}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content Editor / Preview */}
      {viewMode === 'edit' ? (
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={content}
          onChange={handleContentChange}
          placeholder="Escreva sua anotação... Use [[Nome da Nota]] para conectar hiperlinks estilo Wikipédia ou [[Nota#Âncora]]."
        />
      ) : (
        <div className="note-preview-container">{renderHypertextPreview(content)}</div>
      )}

      {/* Backlinks (RF-10) */}
      <section className="backlinks-section" aria-label="Notas que citam esta nota">
        <h4 className="backlinks-title">
          Backlinks ({note.backlinks?.length || 0}) — Notas que citam este documento
        </h4>
        {note.backlinks && note.backlinks.length > 0 ? (
          <div>
            {note.backlinks.map((bl) => (
              <div
                key={bl.id}
                className="backlink-card"
                onClick={() => onNavigateToNoteTitle(bl.title)}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--wikilink-color)' }}>
                  [[{bl.title}]]
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Nenhuma outra nota cita este documento ainda. Adicione <code style={{ color: 'var(--wikilink-color)' }}>[[{note.title}]]</code> em outro texto para criar a relação bidirecional.
          </p>
        )}
      </section>
    </main>
  );
};
