import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { Note, Category, Folder } from '../types';
import { TiptapEditor } from './TiptapEditor';
import { WikilinkPreviewPopover } from './WikilinkPreviewPopover';
import { slugify } from '../utils/slugify';
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
  Sigma,
  Anchor as AnchorIcon,
  Layers,
  Plus,
  X,
  Columns2,
  Quote,
  FileCode
} from 'lucide-react';

interface NoteEditorProps {
  note: Note;
  categories: Category[];
  folders: Folder[];
  allNotes: Note[];
  onSave: (id: string, updates: Partial<Note>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNavigateToNoteTitle: (title: string, anchor?: string) => void;
  onAddBookmark: (noteId: string, title: string, comment?: string) => Promise<void>;
  onOpenShare: (note: Note) => void;
  onOpenPdfDeepLink?: (referenceId: string, pageNumber: number, highlightText?: string, anchorData?: string) => void;
  onToggleSplitView?: () => void;
  isSplitViewOpen?: boolean;
  onDeleteCitation?: (id: string) => Promise<void>;
}

interface HoveredWikilink {
  title: string;
  anchor?: string;
  targetNote?: Note;
  position: { x: number; y: number };
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
  onOpenShare,
  onOpenPdfDeepLink,
  onToggleSplitView,
  isSplitViewOpen,
  onDeleteCitation
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [categoryId, setCategoryId] = useState<string | null>(note.category_id);
  const [folderId, setFolderId] = useState<string | null>(note.folder_id);
  const [isSaved, setIsSaved] = useState(true);
  const [viewMode, setViewMode] = useState<'preview' | 'tiptap' | 'markdown'>('preview');

  // Modal / prompt dialog states
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [bookmarkComment, setBookmarkComment] = useState('');

  const [showWikilinkPrompt, setShowWikilinkPrompt] = useState(false);
  const [wikilinkTarget, setWikilinkTarget] = useState('');
  const [wikilinkAnchor, setWikilinkAnchor] = useState('');

  const [showMathPrompt, setShowMathPrompt] = useState(false);
  const [mathFormula, setMathFormula] = useState('\\sigma(z) = \\frac{1}{1 + e^{-z}}');
  const [isBlockMath, setIsBlockMath] = useState(true);

  const [showAnchorPrompt, setShowAnchorPrompt] = useState(false);
  const [anchorName, setAnchorName] = useState('');

  const [hoveredLink, setHoveredLink] = useState<HoveredWikilink | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategoryId(note.category_id);
    setFolderId(note.folder_id);
    setIsSaved(true);
  }, [note]);

  useEffect(() => {
    if (viewMode === 'markdown' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(380, textareaRef.current.scrollHeight)}px`;
    }
  }, [content, viewMode]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsSaved(false);
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

  // Insertion handlers
  const handleInsertWikilinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wikilinkTarget.trim()) return;
    const anchorPart = wikilinkAnchor.trim() ? `#${slugify(wikilinkAnchor.trim())}` : '';
    const snippet = `[[${wikilinkTarget.trim()}${anchorPart}]]`;
    handleContentChange(content + (content.endsWith('\n') ? '' : '\n\n') + snippet);
    setWikilinkTarget('');
    setWikilinkAnchor('');
    setShowWikilinkPrompt(false);
  };

  const handleInsertMathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mathFormula.trim()) return;
    const snippet = isBlockMath
      ? `\n\n$$\n${mathFormula.trim()}\n$$\n\n`
      : ` $${mathFormula.trim()}$ `;
    handleContentChange(content + snippet);
    setShowMathPrompt(false);
  };

  const handleInsertAnchorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorName.trim()) return;
    const snippet = `\n\n## ${anchorName.trim()} {#${slugify(anchorName.trim())}}\n\n`;
    handleContentChange(content + snippet);
    setAnchorName('');
    setShowAnchorPrompt(false);
  };

  // Safe KaTeX renderer
  const renderKaTeX = (math: string, displayMode: boolean) => {
    try {
      const html = katex.renderToString(math.trim(), {
        throwOnError: false,
        displayMode
      });
      return (
        <span
          className={displayMode ? 'katex-block-wrapper' : 'katex-inline'}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch {
      return <code className="katex-error">${math}$</code>;
    }
  };

  // Render inline tokens: Math ($...$), Wikilinks ([[...]]), Bold (**...**), Code (`...`)
  const renderInlineContent = (text: string) => {
    // Clean any residual HTML inline tags
    const normalized = text
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`');

    // 1. Math formulas ($...$)
    const mathParts = normalized.split(/(\$[^$\n]+\$)/g);

    return mathParts.map((mathPart, mIdx) => {
      if (mathPart.startsWith('$') && mathPart.endsWith('$') && mathPart.length > 2) {
        const mathExpr = mathPart.slice(1, -1);
        return <React.Fragment key={`m-${mIdx}`}>{renderKaTeX(mathExpr, false)}</React.Fragment>;
      }

      // 2. Wikilinks ([[...]])
      const wikiParts = mathPart.split(/(\[\[[^\]]+\]\])/g);

      return wikiParts.map((wikiPart, wIdx) => {
        const match = wikiPart.match(/^\[\[([^\]#]+)(?:#([^\]]+))?\]\]$/);
        if (match) {
          const targetTitle = match[1].trim();
          const targetAnchor = match[2]?.trim();
          const targetNote = allNotes.find(
            (n) => n.title.toLowerCase() === targetTitle.toLowerCase()
          );
          const exists = Boolean(targetNote);

          return (
            <span
              key={`w-${mIdx}-${wIdx}`}
              className={`wikilink ${!exists ? 'orphan' : ''}`}
              onClick={() => onNavigateToNoteTitle(targetTitle, targetAnchor)}
              onMouseEnter={(e) => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredLink({
                  title: targetTitle,
                  anchor: targetAnchor,
                  targetNote,
                  position: { x: rect.left, y: rect.bottom }
                });
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = window.setTimeout(() => {
                  setHoveredLink(null);
                }, 300);
              }}
              title={
                exists
                  ? `Wikilink para "${targetTitle}"${targetAnchor ? ` (Âncora: #${targetAnchor})` : ''}`
                  : `Nota "${targetTitle}" ainda não existe. Clique para criar com 1 clique (Link Órfão estilo Wikipédia)`
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onNavigateToNoteTitle(targetTitle, targetAnchor);
              }}
            >
              <LinkIcon size={12} style={{ marginRight: 4, display: 'inline' }} />
              {targetTitle}
              {targetAnchor && <small> #{targetAnchor}</small>}
            </span>
          );
        }

        // 3. Bold (**...**)
        const boldParts = wikiPart.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((boldPart, bIdx) => {
          if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
            return <strong key={`b-${mIdx}-${wIdx}-${bIdx}`}>{boldPart.slice(2, -2)}</strong>;
          }

          // 4. Inline code (`...`)
          const codeParts = boldPart.split(/(`[^`]+`)/g);
          return codeParts.map((codePart, cIdx) => {
            if (codePart.startsWith('`') && codePart.endsWith('`')) {
              return (
                <code
                  key={`c-${mIdx}-${wIdx}-${bIdx}-${cIdx}`}
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: '0.88em',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {codePart.slice(1, -1)}
                </code>
              );
            }

            // 5. Markdown links [text](url) including pdf:// deep links (RF-19)
            const linkParts = codePart.split(/(\[[^\]]+\]\([^)]+\))/g);
            return linkParts.map((linkPart, lIdx) => {
              const linkMatch = linkPart.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
              if (linkMatch) {
                const linkText = linkMatch[1];
                const linkUrl = linkMatch[2];

                const isDeepLink = /^(pdf|docx|tex|media|pptx|ppt|txt|md):\/\//.test(linkUrl);
                if (isDeepLink) {
                  const protocol = linkUrl.split('://')[0];
                  const clean = linkUrl.replace(/^(pdf|docx|tex|media|pptx|ppt|txt|md):\/\//, '');
                  const [refIdAndQuery] = clean.split('#');
                  const [refId, queryStr] = refIdAndQuery.split('?');
                  const params = new URLSearchParams(queryStr || '');

                  let pillLabel = 'Ref';
                  let posNumber = 1;
                  let anchorData: string | undefined;

                  if (protocol === 'pdf') {
                    posNumber = parseInt(params.get('page') || '1', 10);
                    pillLabel = `Pág. ${posNumber}`;
                    anchorData = `p=${posNumber}`;
                  } else if (protocol === 'docx') {
                    posNumber = parseInt(params.get('p') || '1', 10);
                    pillLabel = `Parágrafo ${posNumber}`;
                    anchorData = `p=${posNumber}`;
                  } else if (protocol === 'pptx' || protocol === 'ppt') {
                    posNumber = parseInt(params.get('slide') || '1', 10);
                    pillLabel = `Slide ${posNumber}`;
                    anchorData = `slide=${posNumber}`;
                  } else if (protocol === 'tex' || protocol === 'txt' || protocol === 'md') {
                    posNumber = parseInt(params.get('line') || '1', 10);
                    pillLabel = `Linha ${posNumber}`;
                    anchorData = `line=${posNumber}`;
                  } else if (protocol === 'media') {
                    const secs = parseInt(params.get('t') || '0', 10);
                    const m = Math.floor(secs / 60);
                    const s = Math.floor(secs % 60);
                    pillLabel = `⏱️ ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                    posNumber = secs;
                    anchorData = `t=${secs}`;
                  }

                  const highlightText = params.get('highlight') || undefined;

                  return (
                    <span
                      key={`link-${mIdx}-${wIdx}-${bIdx}-${cIdx}-${lIdx}`}
                      className="pdf-citation-link-badge"
                      onClick={() => onOpenPdfDeepLink && onOpenPdfDeepLink(refId, isNaN(posNumber) ? 1 : posNumber, highlightText, anchorData)}
                      title={`Abrir ${protocol.toUpperCase()} original (${pillLabel})`}
                      role="button"
                      tabIndex={0}
                    >
                      <Quote size={12} className="pdf-cite-icon" />
                      <span>{linkText}</span>
                      <small className="pdf-page-pill">{pillLabel}</small>
                    </span>
                  );
                }

                if (linkUrl.startsWith('#')) {
                  return (
                    <a key={`link-${mIdx}-${wIdx}-${bIdx}-${cIdx}-${lIdx}`} href={linkUrl} className="anchor-link">
                      {linkText}
                    </a>
                  );
                }

                return (
                  <a
                    key={`link-${mIdx}-${wIdx}-${bIdx}-${cIdx}-${lIdx}`}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    {linkText}
                  </a>
                );
              }

              return linkPart;
            });
          });
        });
      });
    });
  };

  // Render hypertext Markdown with headings, KaTeX math blocks, and lists
  const renderHypertextPreview = (text: string) => {
    // Normalize any block HTML tags into standard line structures
    const cleanText = text
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<\/?ul[^>]*>/gi, '')
      .replace(/<\/?ol[^>]*>/gi, '');

    const rawLines = cleanText.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];
    let inMathBlock = false;
    let mathBlockBuffer: string[] = [];

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

    for (let idx = 0; idx < rawLines.length; idx++) {
      const line = rawLines[idx];
      const trimmed = line.trim();

      // Check math block start/end ($$)
      if (trimmed === '$$') {
        flushList(`flush-math-${idx}`);
        if (!inMathBlock) {
          inMathBlock = true;
          mathBlockBuffer = [];
        } else {
          inMathBlock = false;
          elements.push(
            <div key={`mathblock-${idx}`} className="katex-block-wrapper">
              {renderKaTeX(mathBlockBuffer.join('\n'), true)}
            </div>
          );
          mathBlockBuffer = [];
        }
        continue;
      }

      if (inMathBlock) {
        mathBlockBuffer.push(line);
        continue;
      }

      // Single line block math $$ formula $$
      if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length >= 4) {
        flushList(`flush-singlemath-${idx}`);
        const mathExpr = trimmed.slice(2, -2);
        elements.push(
          <div key={`mathblock-${idx}`} className="katex-block-wrapper">
            {renderKaTeX(mathExpr, true)}
          </div>
        );
        continue;
      }

      // Unordered list item (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = line.replace(/^\s*[-*]\s+/, '');
        listBuffer.push(
          <li key={`li-${idx}`} style={{ marginBottom: 6, lineHeight: 1.6 }}>
            {renderInlineContent(itemText)}
          </li>
        );
        continue;
      }

      // Non-list line flushes list
      flushList(`flush-${idx}`);

      if (trimmed === '') {
        elements.push(<div key={`empty-${idx}`} style={{ height: 12 }} />);
      } else if (trimmed.startsWith('# ')) {
        let headingText = trimmed.slice(2);
        const anchorMatch = headingText.match(/\s*\{#([^}]+)\}\s*$/);
        const anchorId = anchorMatch ? anchorMatch[1] : slugify(headingText);
        if (anchorMatch) headingText = headingText.replace(/\s*\{#([^}]+)\}\s*$/, '');

        elements.push(
          <div key={`h1-${idx}`} id={anchorId} className="heading-anchor-container">
            <h1 style={{ fontSize: '1.9rem', margin: '22px 0 12px 0', fontWeight: 800 }}>
              {renderInlineContent(headingText)}
            </h1>
            <a href={`#${anchorId}`} className="heading-anchor-link" title={`Âncora: #${anchorId}`}>
              <AnchorIcon size={16} />
            </a>
          </div>
        );
      } else if (trimmed.startsWith('## ')) {
        let headingText = trimmed.slice(3);
        const anchorMatch = headingText.match(/\s*\{#([^}]+)\}\s*$/);
        const anchorId = anchorMatch ? anchorMatch[1] : slugify(headingText);
        if (anchorMatch) headingText = headingText.replace(/\s*\{#([^}]+)\}\s*$/, '');

        elements.push(
          <div key={`h2-${idx}`} id={anchorId} className="heading-anchor-container">
            <h2 style={{ fontSize: '1.4rem', margin: '18px 0 10px 0', fontWeight: 700 }}>
              {renderInlineContent(headingText)}
            </h2>
            <a href={`#${anchorId}`} className="heading-anchor-link" title={`Âncora: #${anchorId}`}>
              <AnchorIcon size={15} />
            </a>
          </div>
        );
      } else if (trimmed.startsWith('### ')) {
        let headingText = trimmed.slice(4);
        const anchorMatch = headingText.match(/\s*\{#([^}]+)\}\s*$/);
        const anchorId = anchorMatch ? anchorMatch[1] : slugify(headingText);
        if (anchorMatch) headingText = headingText.replace(/\s*\{#([^}]+)\}\s*$/, '');

        elements.push(
          <div key={`h3-${idx}`} id={anchorId} className="heading-anchor-container">
            <h3 style={{ fontSize: '1.15rem', margin: '14px 0 8px 0', fontWeight: 600 }}>
              {renderInlineContent(headingText)}
            </h3>
            <a href={`#${anchorId}`} className="heading-anchor-link" title={`Âncora: #${anchorId}`}>
              <AnchorIcon size={14} />
            </a>
          </div>
        );
      } else if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`quote-${idx}`}
            style={{
              borderLeft: '3px solid var(--primary-yellow-border)',
              paddingLeft: 14,
              margin: '14px 0',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}
          >
            {renderInlineContent(trimmed.slice(2))}
          </blockquote>
        );
      } else {
        elements.push(
          <p key={`p-${idx}`} style={{ marginBottom: 12, lineHeight: 1.7 }}>
            {renderInlineContent(line)}
          </p>
        );
      }
    }

    // Flush any pending math block or list
    if (inMathBlock && mathBlockBuffer.length > 0) {
      elements.push(
        <div key="mathblock-final" className="katex-block-wrapper">
          {renderKaTeX(mathBlockBuffer.join('\n'), true)}
        </div>
      );
    }
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
          type="button"
          className={`toolbar-btn ${viewMode === 'preview' ? 'active' : ''}`}
          onClick={() => setViewMode('preview')}
          title="Modo Leitura & Fórmulas"
          aria-label="Modo Leitura & Fórmulas"
        >
          <Eye size={16} />
        </button>

        <button
          type="button"
          className={`toolbar-btn ${viewMode === 'tiptap' ? 'active' : ''}`}
          onClick={() => setViewMode('tiptap')}
          title="Editor Visual Formatado (WYSIWYG Tiptap)"
          aria-label="Editor Visual Tiptap"
        >
          <Layers size={16} />
        </button>

        <button
          type="button"
          className={`toolbar-btn ${viewMode === 'markdown' ? 'active' : ''}`}
          onClick={() => setViewMode('markdown')}
          title="Editor Markdown Bruto"
          aria-label="Editor Markdown Bruto"
        >
          <Edit3 size={16} />
        </button>

        <div className="toolbar-divider" />

        {/* Action buttons */}
        <button
          type="button"
          className={`toolbar-btn ${showWikilinkPrompt ? 'active' : ''}`}
          onClick={() => {
            setShowWikilinkPrompt(!showWikilinkPrompt);
            setShowMathPrompt(false);
            setShowAnchorPrompt(false);
            setShowBookmarkPrompt(false);
          }}
          title="Inserir Wikilink [[Nome da Nota]]"
          aria-label="Inserir Wikilink"
        >
          <LinkIcon size={16} />
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showMathPrompt ? 'active' : ''}`}
          onClick={() => {
            setShowMathPrompt(!showMathPrompt);
            setShowWikilinkPrompt(false);
            setShowAnchorPrompt(false);
            setShowBookmarkPrompt(false);
          }}
          title="Inserir Fórmula Matemática KaTeX ($$E=mc^2$$)"
          aria-label="Inserir Fórmula KaTeX"
        >
          <Sigma size={16} />
        </button>

        <button
          type="button"
          className={`toolbar-btn ${showAnchorPrompt ? 'active' : ''}`}
          onClick={() => {
            setShowAnchorPrompt(!showAnchorPrompt);
            setShowWikilinkPrompt(false);
            setShowMathPrompt(false);
            setShowBookmarkPrompt(false);
          }}
          title="Inserir Âncora Contextual {#secao}"
          aria-label="Inserir Âncora Contextual"
        >
          <AnchorIcon size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className={`toolbar-btn ${showBookmarkPrompt ? 'active' : ''}`}
          onClick={() => {
            setShowBookmarkPrompt(!showBookmarkPrompt);
            setShowWikilinkPrompt(false);
            setShowMathPrompt(false);
            setShowAnchorPrompt(false);
          }}
          title="Adicionar Marcador / Marca-Página nesta nota"
          aria-label="Adicionar Marcador"
        >
          <BookmarkIcon size={16} style={{ color: '#eab308' }} />
        </button>

        <div className="toolbar-divider" />

        {onToggleSplitView && (
          <button
            type="button"
            className={`toolbar-btn ${isSplitViewOpen ? 'active' : ''}`}
            onClick={onToggleSplitView}
            title={isSplitViewOpen ? 'Fechar Split-View' : 'Dividir Tela com Referências (Split-View)'}
            aria-label="Dividir Tela (Split-View)"
          >
            <Columns2 size={16} />
          </button>
        )}

        <button
          type="button"
          className="toolbar-btn"
          onClick={() => onOpenShare(note)}
          title="Configurar compartilhamento público"
          aria-label="Compartilhar Nota"
        >
          <Share2 size={16} />
        </button>

        {note.is_public ? (
          <span className="public-badge" style={{ marginLeft: 2 }} title="Esta nota está pública">
            <Globe size={11} />
            <span>Pública</span>
          </span>
        ) : null}
      </div>

      {/* Inline Quick Insert: Wikilink Prompt (RF-07, RF-08, RF-09) */}
      {showWikilinkPrompt && (
        <form
          onSubmit={handleInsertWikilinkSubmit}
          style={{
            padding: 14,
            marginBottom: 20,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--wikilink-color)' }}>
              <LinkIcon size={14} />
              <span>Inserir Hiperlink Bidirecional ([[Wikilink]])</span>
            </div>
            <button
              type="button"
              onClick={() => setShowWikilinkPrompt(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Nome da Nota (ex: 'Perceptron' ou novo conceito)..."
              value={wikilinkTarget}
              onChange={(e) => setWikilinkTarget(e.target.value)}
              list="existing-notes-list"
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                fontSize: '0.88rem'
              }}
              required
            />
            <datalist id="existing-notes-list">
              {allNotes.map((n) => (
                <option key={n.id} value={n.title} />
              ))}
            </datalist>

            <input
              type="text"
              placeholder="Âncora Opcional (ex: 'Fundamentos')..."
              value={wikilinkAnchor}
              onChange={(e) => setWikilinkAnchor(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                fontSize: '0.88rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Se a nota não existir, será gerado um link órfão vermelho estilo Wikipédia com criação sob demanda.
            </span>
            <button
              type="submit"
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Inserir Wikilink
            </button>
          </div>
        </form>
      )}

      {/* Inline Quick Insert: KaTeX Math Formula Prompt (RF-06) */}
      {showMathPrompt && (
        <form
          onSubmit={handleInsertMathSubmit}
          style={{
            padding: 14,
            marginBottom: 20,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)' }}>
              <Sigma size={15} />
              <span>Inserir Fórmula Matemática LaTeX / KaTeX</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMathPrompt(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          <input
            type="text"
            placeholder="Expressão LaTeX (ex: \\sigma(z) = \\frac{1}{1 + e^{-z}})..."
            value={mathFormula}
            onChange={(e) => setMathFormula(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              marginBottom: 8,
              fontSize: '0.9rem',
              fontFamily: 'var(--font-mono)'
            }}
            required
          />

          {/* Quick template buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Exemplos:</span>
            {[
              { label: 'Sigmoide', expr: '\\sigma(z) = \\frac{1}{1 + e^{-z}}' },
              { label: 'Relatividade', expr: 'E = mc^2' },
              { label: 'Soma Gaussiana', expr: '\\sum_{i=1}^n i = \\frac{n(n+1)}{2}' },
              { label: 'Integral', expr: '\\int_{-\\infty}^\\infty e^{-x^2} dx = \\sqrt{\\pi}' }
            ].map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => setMathFormula(tmpl.expr)}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {tmpl.label}
              </button>
            ))}
          </div>

          {/* Live Preview */}
          <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>Prévia da renderização KaTeX:</div>
            {renderKaTeX(mathFormula || 'E = mc^2', isBlockMath)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isBlockMath}
                onChange={(e) => setIsBlockMath(e.target.checked)}
              />
              <span>Fórmula em bloco destacado ($$...$$)</span>
            </label>
            <button
              type="submit"
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Inserir Fórmula
            </button>
          </div>
        </form>
      )}

      {/* Inline Quick Insert: Anchor Prompt (RF-08) */}
      {showAnchorPrompt && (
        <form
          onSubmit={handleInsertAnchorSubmit}
          style={{
            padding: 14,
            marginBottom: 20,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 8
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-blue)' }}>
              <AnchorIcon size={14} />
              <span>Inserir Âncora de Seção (RF-08)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAnchorPrompt(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          </div>

          <input
            type="text"
            placeholder="Nome da Seção / Âncora (ex: 'Definição Formal')..."
            value={anchorName}
            onChange={(e) => setAnchorName(e.target.value)}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Gera um cabeçalho com ID rastreável para links bidirecionais [[Nota#{slugify(anchorName || 'secao')}]].
            </span>
            <button
              type="submit"
              className="sidebar-action-btn"
              style={{ margin: 0, padding: '6px 14px', fontSize: '0.85rem' }}
            >
              Criar Âncora
            </button>
          </div>
        </form>
      )}

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
            <span>Novo Marca-Página / Marcador Contextual (RF-05)</span>
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

      {/* Editor Body */}
      {viewMode === 'tiptap' ? (
        <TiptapEditor
          content={content}
          onChange={handleContentChange}
          onInsertWikilink={() => setShowWikilinkPrompt(true)}
          onInsertMath={() => setShowMathPrompt(true)}
          onInsertAnchor={() => setShowAnchorPrompt(true)}
        />
      ) : viewMode === 'markdown' ? (
        <textarea
          ref={textareaRef}
          className="note-textarea"
          value={content}
          onChange={(e) => {
            handleContentChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.max(380, e.target.scrollHeight)}px`;
          }}
          placeholder="Escreva sua anotação... Use [[Nome da Nota]] para conectar hiperlinks estilo Wikipédia ou [[Nota#Âncora]]. Use $formula$ para KaTeX."
        />
      ) : (
        <div className="note-preview-container">{renderHypertextPreview(content)}</div>
      )}

      {/* Floating Hover Popover for Wikilinks (RF-11) */}
      {hoveredLink && (
        <WikilinkPreviewPopover
          title={hoveredLink.title}
          anchor={hoveredLink.anchor}
          targetNote={hoveredLink.targetNote}
          categories={categories}
          position={hoveredLink.position}
          onClose={() => setHoveredLink(null)}
          onNavigate={() => {
            onNavigateToNoteTitle(hoveredLink.title, hoveredLink.anchor);
            setHoveredLink(null);
          }}
        />
      )}

      {/* Citations & Sources (RF-19, Cenário 2 BDD) */}
      <section className="citations-section" aria-label="Citações e referências extraídas de papers">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 className="backlinks-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Quote size={15} className="text-accent" />
            <span>Citações & Referências Bibliográficas ({note.citations?.length || 0})</span>
          </h4>
          {onToggleSplitView && (
            <button
              type="button"
              className="toolbar-btn"
              onClick={onToggleSplitView}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            >
              <Columns2 size={13} />
              <span>{isSplitViewOpen ? 'Fechar Split-View' : 'Abrir Visualizador PDF'}</span>
            </button>
          )}
        </div>

        {note.citations && note.citations.length > 0 ? (
          <div className="citations-list">
            {note.citations.map((cite) => (
              <div key={cite.id} className="citation-card">
                <blockquote className="citation-quote">
                  <Quote size={14} className="citation-quote-icon" />
                  <span>"{cite.quote_text}"</span>
                </blockquote>
                <div className="citation-meta">
                  <span className="citation-source">
                    <FileCode size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    <strong>{cite.source_title || 'Documento de Referência'}</strong>
                    {cite.authors ? ` — ${cite.authors}` : ''}
                    {cite.year ? ` (${cite.year})` : ''}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {cite.page_number && (
                      <button
                        type="button"
                        className="citation-deeplink-btn"
                        onClick={() =>
                          onOpenPdfDeepLink &&
                          cite.reference_id &&
                          onOpenPdfDeepLink(cite.reference_id, cite.page_number!, cite.quote_text)
                        }
                        title={`Ir diretamente para a página ${cite.page_number} no PDF integrado`}
                      >
                        <AnchorIcon size={12} />
                        <span>Página {cite.page_number} (Deep-Link)</span>
                      </button>
                    )}
                    {onDeleteCitation && (
                      <button
                        type="button"
                        className="ref-delete-btn"
                        onClick={() => onDeleteCitation(cite.id)}
                        title="Remover citação"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Nenhum trecho de PDF citado nesta anotação. Abra um paper no Visualizador PDF ao lado, selecione qualquer trecho de texto e clique em <em>"Citar na Anotação"</em> para gerar um deep-link instantâneo.
          </p>
        )}
      </section>

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
