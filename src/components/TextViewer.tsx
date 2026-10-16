import React, { useState, useEffect, useRef } from 'react';
import { ReferenceFile } from '../types';
import { api } from '../api';
import {
  FileText,
  Search,
  Quote,
  X,
  BookmarkCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Edit3,
  Eye,
  Columns,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface TextViewerProps {
  reference: ReferenceFile;
  initialLine?: number;
  highlightText?: string;
  onCite?: (citation: {
    quoteText: string;
    pageNumber: number;
    referenceId: string;
    referenceTitle: string;
    anchorData?: string;
  }) => void;
  onClose?: () => void;
}

type ViewMode = 'preview' | 'edit' | 'split';

export const TextViewer: React.FC<TextViewerProps> = ({
  reference,
  initialLine,
  highlightText,
  onCite,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const isMarkdown =
    reference.file_type === 'md' ||
    reference.file_type === 'markdown' ||
    /\.(md|markdown)$/i.test(reference.file_path);

  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [zoom, setZoom] = useState<number>(100);

  // Search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Citation
  const [selectedText, setSelectedText] = useState('');
  const [selectedLineNumber, setSelectedLineNumber] = useState<number | undefined>();
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number } | null>(null);
  const [copiedCite, setCopiedCite] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const linesContainerRef = useRef<HTMLDivElement | null>(null);

  const isDirty = content !== originalContent;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getReferenceContent(reference.id)
      .then((data) => {
        if (!isMounted) return;
        const textVal = typeof data.text === 'string' ? data.text : '';
        setContent(textVal);
        setOriginalContent(textVal);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Falha ao carregar conteúdo do arquivo');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reference.id]);

  // Deep-link auto-scroll to initialLine
  useEffect(() => {
    if (!loading && initialLine && linesContainerRef.current) {
      const lineEl = linesContainerRef.current.querySelector(`[data-line="${initialLine}"]`);
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lineEl.classList.add('p-deeplink-highlight');
        setTimeout(() => lineEl.classList.remove('p-deeplink-highlight'), 3000);
      }
    }
  }, [loading, initialLine, viewMode]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelectionBox(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setSelectionBox(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Identifica número da linha selecionada
    let node: Node | null = range.startContainer;
    let lineNum: number | undefined;
    while (node && node !== containerRef.current) {
      if (node instanceof HTMLElement && node.dataset.line) {
        lineNum = parseInt(node.dataset.line, 10);
        break;
      }
      node = node.parentNode;
    }

    setSelectedText(text);
    setSelectedLineNumber(lineNum);
    setSelectionBox({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 36
    });
  };

  const handleApplyCitation = () => {
    if (!selectedText || !onCite) return;
    const line = selectedLineNumber || 1;
    onCite({
      quoteText: selectedText,
      pageNumber: line,
      referenceId: reference.id,
      referenceTitle: reference.title,
      anchorData: `line=${line}`
    });

    setCopiedCite(true);
    setTimeout(() => {
      setCopiedCite(false);
      setSelectionBox(null);
      window.getSelection()?.removeAllRanges();
    }, 1200);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api.updateReferenceContent(reference.id, { text: content });
      setOriginalContent(content);
      setSaveStatus('Alterações salvas com sucesso no arquivo!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Erro ao salvar: ${err.message || 'Falha na requisição'}`);
    } finally {
      setSaving(false);
    }
  };

  const lines = content.split('\n');

  // Renderizador simples de Markdown nativo sem dependências externas
  const renderSimpleMarkdown = (mdText: string): string => {
    const rawLines = mdText.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeBuffer = '';

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          html += `<pre class="md-code-block" style="background:var(--bg-secondary);padding:12px;border-radius:6px;overflow-x:auto;"><code>${escapeHtml(codeBuffer)}</code></pre>`;
          codeBuffer = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeBuffer = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer += (codeBuffer ? '\n' : '') + line;
        continue;
      }

      if (/^#\s+(.+)$/.test(line)) {
        html += `<h1 data-line="${i + 1}" style="font-size:1.6rem;font-weight:700;margin:18px 0 10px;border-bottom:1px solid var(--border-color);padding-bottom:6px;">${formatInlineMd(RegExp.$1)}</h1>`;
      } else if (/^##\s+(.+)$/.test(line)) {
        html += `<h2 data-line="${i + 1}" style="font-size:1.3rem;font-weight:600;margin:16px 0 8px;">${formatInlineMd(RegExp.$1)}</h2>`;
      } else if (/^###\s+(.+)$/.test(line)) {
        html += `<h3 data-line="${i + 1}" style="font-size:1.1rem;font-weight:600;margin:12px 0 6px;">${formatInlineMd(RegExp.$1)}</h3>`;
      } else if (/^>\s+(.+)$/.test(line)) {
        html += `<blockquote data-line="${i + 1}" style="border-left:4px solid var(--accent-primary);padding:8px 14px;margin:8px 0;background:rgba(59,130,246,0.06);color:var(--text-secondary);">${formatInlineMd(RegExp.$1)}</blockquote>`;
      } else if (/^[-*+]\s+(.+)$/.test(line)) {
        html += `<li data-line="${i + 1}" style="margin-left:20px;list-style-type:disc;">${formatInlineMd(RegExp.$1)}</li>`;
      } else if (/^\d+\.\s+(.+)$/.test(line)) {
        html += `<li data-line="${i + 1}" style="margin-left:20px;list-style-type:decimal;">${formatInlineMd(RegExp.$1)}</li>`;
      } else if (!line.trim()) {
        html += '<div style="height:10px;"></div>';
      } else {
        html += `<p data-line="${i + 1}" style="margin:6px 0;line-height:1.7;">${formatInlineMd(line)}</p>`;
      }
    }

    if (inCodeBlock) {
      html += `<pre class="md-code-block" style="background:var(--bg-secondary);padding:12px;border-radius:6px;overflow-x:auto;"><code>${escapeHtml(codeBuffer)}</code></pre>`;
    }

    return html;
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const formatInlineMd = (text: string) => {
    return escapeHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:var(--bg-secondary);padding:2px 4px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>');
  };

  return (
    <div className="pdf-viewer-container" ref={containerRef} onMouseUp={handleMouseUp}>
      {/* Top Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <FileText size={16} className="text-accent" style={{ color: isMarkdown ? '#10b981' : '#6366f1' }} />
          <span className="pdf-title truncate" title={reference.title}>
            {reference.title}
          </span>
          <span
            className="badge"
            style={{
              fontSize: '0.68rem',
              backgroundColor: isMarkdown ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              color: isMarkdown ? '#10b981' : '#6366f1',
              border: `1px solid ${isMarkdown ? '#10b981' : '#6366f1'}`
            }}
          >
            {isMarkdown ? 'MARKDOWN' : 'TEXTO'}
          </span>
          {isDirty && (
            <span
              className="badge"
              style={{
                fontSize: '0.66rem',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid #f59e0b'
              }}
            >
              Não salvo
            </span>
          )}
        </div>

        <div className="pdf-toolbar-group">
          {/* View Mode Switches */}
          <div className="btn-group" style={{ display: 'flex', gap: 2 }}>
            <button
              className={`toolbar-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
              title="Visualização Formatada"
            >
              <Eye size={15} />
            </button>
            <button
              className={`toolbar-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
              title="Editor de Texto"
            >
              <Edit3 size={15} />
            </button>
            <button
              className={`toolbar-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Lado a Lado (Editor / Preview)"
            >
              <Columns size={15} />
            </button>
          </div>

          <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          {/* Salvar Botão */}
          <button
            className="toolbar-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px',
              backgroundColor: isDirty ? 'var(--accent-primary)' : 'transparent',
              color: isDirty ? '#ffffff' : 'inherit',
              borderRadius: 4
            }}
            onClick={handleSave}
            disabled={saving}
            title="Salvar alterações no arquivo"
          >
            <Save size={14} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </span>
          </button>

          <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          {/* Zoom controls */}
          <button
            className="toolbar-btn"
            onClick={() => setZoom((prev) => Math.max(70, prev - 15))}
            title="Diminuir Zoom"
            disabled={zoom <= 70}
          >
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: '0.8rem', minWidth: 38, textAlign: 'center' }}>
            {zoom}%
          </span>
          <button
            className="toolbar-btn"
            onClick={() => setZoom((prev) => Math.min(160, prev + 15))}
            title="Aumentar Zoom"
            disabled={zoom >= 160}
          >
            <ZoomIn size={15} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => setZoom(100)}
            title="Redefinir Zoom (100%)"
          >
            <RotateCcw size={14} />
          </button>

          {/* Search Toggle */}
          <button
            className={`toolbar-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen((prev) => !prev)}
            title="Buscar no Arquivo"
          >
            <Search size={15} />
          </button>

          {/* Close */}
          {onClose && (
            <button className="toolbar-btn close-btn" onClick={onClose} title="Fechar Visualizador">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Save Notification Banner */}
      {saveStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            backgroundColor: saveStatus.startsWith('Erro') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            borderBottom: `1px solid ${saveStatus.startsWith('Erro') ? '#ef4444' : '#10b981'}`,
            color: saveStatus.startsWith('Erro') ? '#ef4444' : '#10b981',
            fontSize: '0.8rem'
          }}
        >
          {saveStatus.startsWith('Erro') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Search Bar */}
      {isSearchOpen && (
        <div className="pdf-search-bar" style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar termo no arquivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.82rem', flex: 1 }}
            autoFocus
          />
          {searchQuery && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {lines.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase())).length} linha(s)
            </span>
          )}
          <button
            className="toolbar-btn"
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Floating Citation Tooltip */}
      {selectionBox && (
        <div
          className="pdf-citation-tooltip"
          style={{
            position: 'absolute',
            left: `${selectionBox.x}px`,
            top: `${selectionBox.y}px`,
            transform: 'translateX(-50%)',
            zIndex: 100
          }}
        >
          <button className="citation-btn" onClick={handleApplyCitation}>
            {copiedCite ? (
              <>
                <BookmarkCheck size={14} />
                <span>Citado na Nota!</span>
              </>
            ) : (
              <>
                <Quote size={14} />
                <span>Citar {selectedLineNumber ? `Linha ${selectedLineNumber}` : 'Texto'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="pdf-viewport" style={{ padding: '24px 32px', overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)' }}>
        {loading ? (
          <div className="empty-state">
            <p>Carregando conteúdo do arquivo...</p>
          </div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--accent-red)' }}>
            <p>{error}</p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 20,
              maxWidth: viewMode === 'split' ? 1200 : 820,
              margin: '0 auto',
              fontSize: `${zoom}%`
            }}
          >
            {/* Editor Textarea Mode */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>Editor ({lines.length} linhas, {content.length} caracteres)</span>
                  <span>{isDirty ? 'Modificado' : 'Sem alterações'}</span>
                </div>
                <textarea
                  className="form-textarea"
                  style={{
                    flex: 1,
                    minHeight: 520,
                    padding: '16px',
                    fontFamily: 'monospace',
                    fontSize: '0.88rem',
                    lineHeight: 1.6,
                    border: 'none',
                    outline: 'none',
                    resize: 'vertical',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite ou edite o texto do arquivo..."
                />
              </div>
            )}

            {/* Formatted Preview Mode */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div
                ref={linesContainerRef}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-primary)',
                  padding: '36px 44px',
                  borderRadius: 6,
                  boxShadow: '0 4px 18px rgba(0, 0, 0, 0.12)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  lineHeight: 1.65
                }}
              >
                {isMarkdown ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: renderSimpleMarkdown(content)
                    }}
                  />
                ) : (
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {lines.map((line, idx) => {
                      const lineNum = idx + 1;
                      const isMatch = searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase());
                      return (
                        <div
                          key={lineNum}
                          data-line={lineNum}
                          className={`tex-line ${isMatch ? 'docx-search-match' : ''}`}
                          style={{
                            display: 'flex',
                            gap: 12,
                            padding: '1px 4px',
                            borderRadius: 3
                          }}
                        >
                          <span
                            style={{
                              width: 32,
                              textAlign: 'right',
                              color: 'var(--text-muted)',
                              userSelect: 'none',
                              fontSize: '0.78rem'
                            }}
                          >
                            {lineNum}
                          </span>
                          <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {line || ' '}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
