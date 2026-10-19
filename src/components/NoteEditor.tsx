import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { Note, Category, Folder } from '../types';
import { api } from '../api';
import { TiptapEditor } from './TiptapEditor';
import { WikilinkPreviewPopover } from './WikilinkPreviewPopover';
import { slugify } from '../utils/slugify';
import {
  Bookmark as BookmarkIcon,
  Link as LinkIcon,
  Trash2,
  Save,
  Check,
  Share2,
  Sigma,
  Anchor as AnchorIcon,
  X,
  Columns2,
  Quote,
  FileCode,
  FileText,
  Star
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
  const [viewMode, setViewMode] = useState<'tiptap' | 'preview' | 'markdown'>(
    note.file_type === 'md' ? 'markdown' : 'tiptap'
  );

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
  const [isPaginatedMode, setIsPaginatedMode] = useState<boolean>(true);
  const [showReferencesDrawer, setShowReferencesDrawer] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setCategoryId(note.category_id);
    setFolderId(note.folder_id);
    setIsSaved(true);
    if (note.file_type === 'md') {
      setViewMode('markdown');
    } else {
      setViewMode('tiptap');
    }
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
    setShowReferencesDrawer(true);
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
    if (!text) return null;
    // Clean any residual HTML inline tags
    const normalized = String(text)
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<code>(.*?)<\/code>/gi, '`$1`');

    // 1. Math formulas ($...$)
    const mathParts = normalized.split(/(\$[^$\n]+\$)/g);

    return mathParts.map((mathPart, mIdx) => {
      if (!mathPart) return null;
      if (mathPart.startsWith('$') && mathPart.endsWith('$') && mathPart.length > 2) {
        const mathExpr = mathPart.slice(1, -1);
        return <React.Fragment key={`m-${mIdx}`}>{renderKaTeX(mathExpr, false)}</React.Fragment>;
      }

      // 2. Wikilinks ([[...]])
      const wikiParts = (mathPart || '').split(/(\[\[[^\]]+\]\])/g);

      return wikiParts.map((wikiPart, wIdx) => {
        if (!wikiPart) return null;
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
        const boldParts = (wikiPart || '').split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((boldPart, bIdx) => {
          if (!boldPart) return null;
          if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
            return <strong key={`b-${mIdx}-${wIdx}-${bIdx}`}>{boldPart.slice(2, -2)}</strong>;
          }

          // 4. Inline code (`...`)
          const codeParts = (boldPart || '').split(/(`[^`]+`)/g);
          return codeParts.map((codePart, cIdx) => {
            if (!codePart) return null;
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
            const linkParts = (codePart || '').split(/(\[[^\]]+\]\([^)]+\))/g);
            return linkParts.map((linkPart, lIdx) => {
              if (!linkPart) return null;
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
    if (!text) return null;
    // Normalize any block HTML tags into standard line structures
    const cleanText = String(text)
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
      } else if (trimmed === '---' || trimmed.includes('data-type="page-break"') || trimmed.includes('docs-page-break')) {
        elements.push(
          <div key={`pagebreak-${idx}`} className="docs-page-break" data-type="page-break">
            <div className="docs-page-break-gap">
              <span className="docs-page-break-label">Página</span>
            </div>
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
    <main
      className="editor-pane"
      role="main"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        minHeight: 0,
        position: 'relative'
      }}
    >
      {/* 1. Google Docs Document Header & Apple Notes Quick Actions */}
      <div className="docs-doc-header">
        <div className="docs-doc-header-left">
          <FileText size={32} className="docs-doc-icon" />
          <div className="docs-doc-info">
            <div className="docs-doc-title-row">
              <input
                type="text"
                className="docs-doc-title-input"
                value={title}
                onChange={handleTitleChange}
                placeholder="Documento Sem Título"
              />
              <div className="docs-doc-meta-chips">
                <button
                  type="button"
                  className="docs-doc-chip-btn"
                  onClick={async () => {
                    const newFav = !note.is_favorite;
                    await onSave(note.id, { is_favorite: newFav });
                  }}
                  title={note.is_favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos (Estrela)'}
                >
                  <Star
                    size={16}
                    style={{ color: note.is_favorite ? '#eab308' : 'var(--text-muted)' }}
                    fill={note.is_favorite ? '#eab308' : 'none'}
                  />
                </button>

                {/* Move folder picker */}
                <select
                  value={folderId || ''}
                  onChange={(e) => {
                    setFolderId(e.target.value || null);
                    setIsSaved(false);
                  }}
                  className="docs-tool-select"
                  title="Mover para pasta"
                  style={{ fontSize: '0.75rem', padding: '1px 6px' }}
                >
                  <option value="">📁 Raiz</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>

                <div className="docs-doc-cloud-status" title="Status de sincronização">
                  <Check size={13} style={{ color: 'var(--accent-green)' }} />
                  <span>{isSaved ? 'Salvo no Drive' : 'Salvando...'}</span>
                </div>

                {/* Ver Referências Toggle Button (Header) */}
                <button
                  type="button"
                  className={`docs-doc-chip-btn ${showReferencesDrawer ? 'is-active' : ''}`}
                  onClick={() => setShowReferencesDrawer((prev) => !prev)}
                  title="Exibir ou ocultar citações e referências bibliográficas desta nota"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    backgroundColor: showReferencesDrawer ? 'rgba(37, 99, 235, 0.12)' : undefined,
                    color: showReferencesDrawer ? '#2563eb' : undefined,
                    borderColor: showReferencesDrawer ? '#2563eb' : undefined
                  }}
                >
                  <Quote size={12} />
                  <span>
                    Ver Referências
                    {((note.citations?.length || 0) + (note.bookmarks?.length || 0)) > 0
                      ? ` (${(note.citations?.length || 0) + (note.bookmarks?.length || 0)})`
                      : ''}
                  </span>
                </button>
              </div>
            </div>

            {/* Menu Bar: Arquivo, Editar, Ver, Inserir, Formatar, Ferramentas, Ajuda */}
            <div className="docs-menu-bar">
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => window.open(api.getNoteExportUrl(note.id, 'docx'), '_blank')}
                title="Arquivo: Exportar Word, PDF ou Salvar"
              >
                Arquivo
              </button>
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => setViewMode(viewMode === 'tiptap' ? 'markdown' : 'tiptap')}
                title="Editar / Alternar Visual"
              >
                Editar
              </button>
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => setIsPaginatedMode((prev) => !prev)}
                title={`Ver: Alternar entre modo Com Páginas (A4) e Sem Páginas (Contínuo). Atualmente: ${isPaginatedMode ? 'Com Páginas' : 'Sem Páginas'}`}
              >
                Ver: {isPaginatedMode ? 'Com Páginas' : 'Sem Páginas'}
              </button>
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => setShowWikilinkPrompt(true)}
                title="Inserir Wikilink, Imagem, KaTeX"
              >
                Inserir
              </button>
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => setShowMathPrompt(true)}
                title="Formatar / Equações"
              >
                Formatar
              </button>
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => setShowBookmarkPrompt(true)}
                title="Marcadores e Ferramentas"
              >
                Ferramentas
              </button>
              <button
                type="button"
                className="docs-menu-item"
                onClick={() => window.open(api.getNoteExportUrl(note.id, 'docx'), '_blank')}
                title="Ajuda e Documentação"
              >
                Ajuda
              </button>
            </div>
          </div>
        </div>

        {/* Apple Notes Top Right Action Bar: Yellow Trash, Aa, Checklist, Table, Share */}
        <div className="apple-quick-actions">
          <button
            type="button"
            className="apple-quick-action-btn delete-yellow"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(note.id);
            }}
            title="Excluir Nota"
          >
            <Trash2 size={17} />
          </button>

          <button
            type="button"
            className={`apple-quick-action-btn ${viewMode !== 'tiptap' ? 'active' : ''}`}
            onClick={() => setViewMode((prev) => (prev === 'tiptap' ? 'markdown' : 'tiptap'))}
            title="Formatação Aa (Visual / Markdown)"
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e5a93c' }}>Aa</span>
          </button>

          <button
            type="button"
            className="apple-quick-action-btn"
            onClick={() => setShowBookmarkPrompt(true)}
            title="Adicionar Marcador / Marca-Página"
          >
            <BookmarkIcon size={16} style={{ color: '#eab308' }} />
          </button>

          {onToggleSplitView && (
            <button
              type="button"
              className={`apple-quick-action-btn ${isSplitViewOpen ? 'active' : ''}`}
              onClick={onToggleSplitView}
              title={isSplitViewOpen ? 'Fechar Split-View' : 'Dividir Tela com PDF / Outra Nota'}
            >
              <Columns2 size={16} />
            </button>
          )}

          <button
            type="button"
            className="apple-quick-action-btn"
            onClick={() => onOpenShare(note)}
            title="Compartilhar Nota"
          >
            <Share2 size={16} />
          </button>

          <button
            type="button"
            className="apple-quick-action-btn"
            onClick={triggerSave}
            disabled={isSaved}
            title={isSaved ? 'Alterações salvas' : 'Salvar Nota'}
            style={{ color: isSaved ? 'var(--text-muted)' : 'var(--accent-primary)' }}
          >
            {isSaved ? <Check size={16} /> : <Save size={16} />}
          </button>
        </div>
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


      {/* Editor Body & References Drawer */}
      <div className="editor-body-wrapper" style={{ flex: 1, minHeight: 0, width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {viewMode === 'tiptap' ? (
          <TiptapEditor
            content={content}
            onChange={handleContentChange}
            onInsertWikilink={() => setShowWikilinkPrompt(true)}
            onInsertMath={() => setShowMathPrompt(true)}
            onInsertAnchor={() => setShowAnchorPrompt(true)}
            noteTitle={title}
            noteId={note.id}
            isPaginatedMode={isPaginatedMode}
            onTogglePaginatedMode={() => setIsPaginatedMode((prev) => !prev)}
            onExportDocx={() => {
              window.open(api.getNoteExportUrl(note.id, 'docx'), '_blank');
            }}
            onExportMarkdown={() => {
              window.open(api.getNoteExportUrl(note.id, 'md'), '_blank');
            }}
            onExportPdf={() => {
              window.print();
            }}
          />
        ) : viewMode === 'markdown' ? (
          <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '24px 32px' }}>
            <textarea
              ref={textareaRef}
              className="note-textarea"
              style={{ width: '100%', minHeight: '100%', border: 'none', outline: 'none', background: 'transparent', resize: 'none', fontFamily: 'monospace', fontSize: '0.95rem' }}
              value={content}
              onChange={(e) => {
                handleContentChange(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.max(380, e.target.scrollHeight)}px`;
              }}
              placeholder="Escreva sua anotação... Use [[Nome da Nota]] para conectar hiperlinks estilo Wikipédia ou [[Nota#Âncora]]. Use $formula$ para KaTeX."
            />
          </div>
        ) : (
          <main className="docs-desk-area" style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
            <div
              className={`docs-page-canvas printable-document note-preview-container ${!isPaginatedMode ? 'is-pageless' : ''}`}
              style={{ margin: '24px auto', maxWidth: 816, minHeight: 900 }}
            >
              {renderHypertextPreview(content)}
            </div>
          </main>
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

        {/* References & Citations Slide-over Drawer (Oculto por padrão, aberto via "Ver Referências") */}
        {showReferencesDrawer && (
          <aside className="docs-references-side-drawer" aria-label="Citações e referências extraídas de papers">
            <div className="docs-references-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Quote size={15} style={{ color: 'var(--primary-yellow-border)' }} />
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>
                  Referências & Marcadores ({((note.citations?.length || 0) + (note.bookmarks?.length || 0))})
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {onToggleSplitView && (
                  <button
                    type="button"
                    className="toolbar-btn"
                    onClick={onToggleSplitView}
                    style={{ fontSize: '0.74rem', padding: '3px 8px', height: 26 }}
                    title="Abrir ou fechar split-view do PDF"
                  >
                    <Columns2 size={12} />
                    <span>{isSplitViewOpen ? 'Fechar Split' : 'Ver PDF'}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowReferencesDrawer(false)}
                  title="Fechar painel de referências"
                  style={{ padding: 4 }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="docs-references-drawer-body">
              {/* Citations List */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.04em' }}>
                  Citações de Papers ({note.citations?.length || 0})
                </div>

                {note.citations && note.citations.length > 0 ? (
                  <div className="citations-list">
                    {note.citations.map((cite) => (
                      <div key={cite.id} className="citation-card">
                        <blockquote className="citation-quote">
                          <Quote size={13} className="citation-quote-icon" />
                          <span>"{cite.quote_text}"</span>
                        </blockquote>
                        <div className="citation-meta">
                          <span className="citation-source">
                            <FileCode size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                            <strong>{cite.source_title || 'Documento de Referência'}</strong>
                            {cite.authors ? ` — ${cite.authors}` : ''}
                            {cite.year ? ` (${cite.year})` : ''}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
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
                                <AnchorIcon size={11} />
                                <span>Pág. {cite.page_number} (Deep-Link)</span>
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
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, padding: 12, backgroundColor: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    Nenhum trecho de PDF citado nesta anotação. Abra um paper no Visualizador PDF ao lado, selecione qualquer trecho de texto e clique em <em>"Citar na Anotação"</em> para gerar um deep-link instantâneo.
                  </p>
                )}
              </div>

              {/* Bookmarks on this note (Oculto na página principal, acessível aqui no painel) */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.04em' }}>
                  Marcadores Contextuais ({note.bookmarks?.length || 0})
                </div>
                {note.bookmarks && note.bookmarks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {note.bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="bookmark-item"
                        style={{
                          padding: '8px 12px',
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8
                        }}
                      >
                        <BookmarkIcon size={15} className="bookmark-gold" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{bm.title}</div>
                          {bm.comment && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {bm.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, padding: 12, backgroundColor: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    Nenhum marcador adicionado. Use o botão de marcador no topo para salvar pontos-chave.
                  </p>
                )}
              </div>

              {/* Backlinks */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.04em' }}>
                  Backlinks ({note.backlinks?.length || 0}) — Notas que Citam Este Documento
                </div>
                {note.backlinks && note.backlinks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {note.backlinks.map((bl) => (
                      <div
                        key={bl.id}
                        className="backlink-card"
                        style={{ padding: '8px 12px' }}
                        onClick={() => onNavigateToNoteTitle(bl.title)}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--wikilink-color)' }}>
                          [[{bl.title}]]
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, padding: 12, backgroundColor: 'var(--bg-tertiary)', borderRadius: 6 }}>
                    Nenhuma outra nota cita este documento ainda. Adicione <code style={{ color: 'var(--wikilink-color)' }}>[[{note.title}]]</code> em outro texto para criar a relação bidirecional.
                  </p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* 3. Rodapé sutil com contadores e botão "Ver Referências" */}
      <footer className="docs-doc-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>{title || 'Documento sem título'}</span>
          <span>•</span>
          <span>{content.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length} palavras</span>
          <span>•</span>
          <span>{content.replace(/<[^>]*>/g, '').length} caracteres</span>
        </div>

        <button
          type="button"
          className={`docs-footer-ref-btn ${showReferencesDrawer ? 'is-active' : ''}`}
          onClick={() => setShowReferencesDrawer(!showReferencesDrawer)}
          title="Exibir ou ocultar citações, marcadores e referências desta nota"
        >
          <Quote size={12} />
          <span>
            Ver Referências
            {((note.citations?.length || 0) + (note.bookmarks?.length || 0)) > 0
              ? ` (${(note.citations?.length || 0) + (note.bookmarks?.length || 0)})`
              : ''}
          </span>
        </button>
      </footer>
    </main>
  );
};
