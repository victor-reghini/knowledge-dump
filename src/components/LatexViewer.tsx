import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import { ReferenceFile } from '../types';
import { api } from '../api';
import {
  Code,
  Eye,
  Columns,
  Search,
  Quote,
  X,
  BookmarkCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface LatexViewerProps {
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

type ViewMode = 'rendered' | 'source' | 'split';

export const LatexViewer: React.FC<LatexViewerProps> = ({
  reference,
  initialLine,
  highlightText,
  onCite,
  onClose
}) => {
  const [sourceCode, setSourceCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [sourceTab, setSourceTab] = useState<'editor' | 'lines'>('editor');
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
  const sourceRef = useRef<HTMLDivElement | null>(null);

  const isDirty = sourceCode !== originalCode;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getReferenceContent(reference.id)
      .then((data) => {
        if (!isMounted) return;
        const code = data.text || '';
        setSourceCode(code);
        setOriginalCode(code);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Falha ao carregar arquivo LaTeX');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reference.id]);

  // Deep-link scroll to initial line
  useEffect(() => {
    if (!loading && initialLine && sourceRef.current) {
      const lineEl = sourceRef.current.querySelector(`[data-line="${initialLine}"]`);
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

    // Identifica número da linha se estiver na visão fonte
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
    const lineVal = selectedLineNumber || 1;
    onCite({
      quoteText: selectedText,
      pageNumber: lineVal,
      referenceId: reference.id,
      referenceTitle: reference.title,
      anchorData: `line=${lineVal}`
    });

    setCopiedCite(true);
    setTimeout(() => {
      setCopiedCite(false);
      setSelectionBox(null);
      window.getSelection()?.removeAllRanges();
    }, 1200);
  };

  // Safe KaTeX renderer helper
  const renderMath = (math: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode,
        throwOnError: false
      });
    } catch {
      return `<code class="katex-error">${math}</code>`;
    }
  };

  // Parser simples de LaTeX para HTML rico com KaTeX
  const parseLatexToHtml = (tex: string): string => {
    let html = tex;

    // Remove comentários TeX (% ...)
    html = html.replace(/^[ \t]*%.*$/gm, '');

    // Extrai Metadados
    const titleMatch = html.match(/\\title\{([^}]+)\}/);
    const authorMatch = html.match(/\\author\{([^}]+)\}/);
    const dateMatch = html.match(/\\date\{([^}]+)\}/);

    const docTitle = titleMatch ? titleMatch[1] : '';
    const docAuthor = authorMatch ? authorMatch[1].replace(/\\and/g, ', ') : '';
    const docDate = dateMatch ? dateMatch[1] : '';

    // Remove preâmbulo \documentclass ... \begin{document}
    const docBodyMatch = html.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    let body = docBodyMatch ? docBodyMatch[1] : html;

    // Substitui \maketitle pelo cabeçalho estilizado
    let headerHtml = '';
    if (docTitle) {
      headerHtml = `
        <div class="latex-header" style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid var(--border-color); padding-bottom: 20px;">
          <h1 style="font-size: 1.65rem; margin-bottom: 8px;">${docTitle}</h1>
          ${docAuthor ? `<div style="font-size: 0.95rem; color: var(--text-muted); font-weight: 500;">${docAuthor}</div>` : ''}
          ${docDate ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${docDate}</div>` : ''}
        </div>
      `;
    }
    body = body.replace(/\\maketitle/g, headerHtml);

    // Abstract
    body = body.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g, (_m, content) => {
      return `
        <div class="latex-abstract" style="background: var(--bg-secondary); border-left: 3px solid var(--accent-yellow); padding: 14px 18px; margin: 20px 0; font-size: 0.9rem; font-style: italic;">
          <div style="font-weight: bold; font-style: normal; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; margin-bottom: 6px;">Resumo (Abstract)</div>
          ${content.trim()}
        </div>
      `;
    });

    // Seções
    body = body.replace(/\\section\*?\{([^}]+)\}/g, '<h2 class="latex-sec" style="margin-top: 28px; margin-bottom: 12px; font-size: 1.3rem; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">$1</h2>');
    body = body.replace(/\\subsection\*?\{([^}]+)\}/g, '<h3 class="latex-subsec" style="margin-top: 20px; margin-bottom: 10px; font-size: 1.1rem;">$1</h3>');
    body = body.replace(/\\subsubsection\*?\{([^}]+)\}/g, '<h4 class="latex-subsubsec" style="margin-top: 16px; margin-bottom: 8px; font-size: 0.95rem;">$1</h4>');

    // Equações em display mode: \begin{equation}...\end{equation} ou $$...$$ ou \[...\]
    body = body.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (_m, eq) => {
      return `<div class="katex-block-wrapper my-4">${renderMath(eq, true)}</div>`;
    });
    body = body.replace(/\$\$([\s\S]*?)\$\$/g, (_m, eq) => {
      return `<div class="katex-block-wrapper my-4">${renderMath(eq, true)}</div>`;
    });
    body = body.replace(/\\\[([\s\S]*?)\\\]/g, (_m, eq) => {
      return `<div class="katex-block-wrapper my-4">${renderMath(eq, true)}</div>`;
    });

    // Fórmulas inline $...$
    body = body.replace(/\$([^\$\n]+)\$/g, (_m, eq) => {
      return renderMath(eq, false);
    });

    // Formatação de texto
    body = body.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    body = body.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    body = body.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
    body = body.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');

    // Listas: \begin{itemize} ... \end{itemize}
    body = body.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_m, items) => {
      const listItems = items.replace(/\\item\s+([^\n]+)/g, '<li>$1</li>');
      return `<ul style="margin: 12px 0 12px 24px;">${listItems}</ul>`;
    });
    body = body.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_m, items) => {
      const listItems = items.replace(/\\item\s+([^\n]+)/g, '<li>$1</li>');
      return `<ol style="margin: 12px 0 12px 24px;">${listItems}</ol>`;
    });

    // Parágrafos simples
    const paragraphs = body.split(/\n\s*\n/).filter(Boolean);
    const formattedParagraphs = paragraphs.map((p) => {
      const trimmed = p.trim();
      if (trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
        return trimmed;
      }
      return `<p style="margin-bottom: 12px; text-align: justify;">${trimmed}</p>`;
    });

    return formattedParagraphs.join('\n');
  };

  const renderedHtml = parseLatexToHtml(sourceCode);
  const sourceLines = sourceCode.split('\n');

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api.updateReferenceContent(reference.id, { text: sourceCode });
      setOriginalCode(sourceCode);
      setSaveStatus('Alterações salvas com sucesso no arquivo TeX!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Erro ao salvar: ${err.message || 'Falha na requisição'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pdf-viewer-container" ref={containerRef} onMouseUp={handleMouseUp}>
      {/* Top Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <Code size={16} className="text-accent" style={{ color: '#a855f7' }} />
          <span className="pdf-title truncate" title={reference.title}>
            {reference.title}
          </span>
          <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid #a855f7' }}>
            LaTeX (.tex)
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
          {/* Mode Switcher */}
          <div className="segmented-control" style={{ display: 'flex', gap: 2, background: 'var(--bg-tertiary)', padding: 2, borderRadius: 6 }}>
            <button
              className={`toolbar-btn ${viewMode === 'rendered' ? 'active' : ''}`}
              onClick={() => setViewMode('rendered')}
              title="Visualização Formatada (KaTeX)"
              style={{ padding: '3px 8px', fontSize: '0.75rem', gap: 4 }}
            >
              <Eye size={13} />
              <span>Formatado</span>
            </button>
            <button
              className={`toolbar-btn ${viewMode === 'source' ? 'active' : ''}`}
              onClick={() => setViewMode('source')}
              title="Editor / Código TeX"
              style={{ padding: '3px 8px', fontSize: '0.75rem', gap: 4 }}
            >
              <Code size={13} />
              <span>Editor TeX</span>
            </button>
            <button
              className={`toolbar-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="Lado a Lado (Split)"
              style={{ padding: '3px 8px', fontSize: '0.75rem', gap: 4 }}
            >
              <Columns size={13} />
              <span>Lado a Lado</span>
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
            title="Salvar alterações no arquivo TeX"
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
          <span style={{ fontSize: '0.8rem', minWidth: 36, textAlign: 'center' }}>
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

          {/* Search */}
          <button
            className={`toolbar-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen((prev) => !prev)}
            title="Buscar no LaTeX"
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
            placeholder="Buscar termos no documento LaTeX..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.82rem', flex: 1 }}
            autoFocus
          />
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
                <span>Citar Trecho {selectedLineNumber ? `(Linha ${selectedLineNumber})` : ''}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Viewport Area */}
      <div className="pdf-viewport" style={{ padding: '24px 32px', overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)' }}>
        {loading ? (
          <div className="empty-state">
            <p>Carregando arquivo LaTeX (.tex)...</p>
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
              maxWidth: viewMode === 'split' ? 1200 : 780,
              margin: '0 auto',
              fontSize: `${zoom}%`
            }}
          >
            {/* Formatted Render Mode */}
            {(viewMode === 'rendered' || viewMode === 'split') && (
              <div
                className="latex-rendered-paper"
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-primary)',
                  padding: '44px 50px',
                  borderRadius: 6,
                  boxShadow: '0 4px 18px rgba(0, 0, 0, 0.12)',
                  lineHeight: 1.7,
                  color: 'var(--text-primary)',
                  overflowX: 'auto'
                }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            )}

            {/* Source Code Mode */}
            {(viewMode === 'source' || viewMode === 'split') && (
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
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.76rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className={`toolbar-btn ${sourceTab === 'editor' ? 'active' : ''}`}
                      onClick={() => setSourceTab('editor')}
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      Editar TeX
                    </button>
                    <button
                      className={`toolbar-btn ${sourceTab === 'lines' ? 'active' : ''}`}
                      onClick={() => setSourceTab('lines')}
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      Linhas ({sourceLines.length})
                    </button>
                  </div>
                  <span>{isDirty ? 'Modificado (Não salvo)' : 'Sem alterações'}</span>
                </div>

                {sourceTab === 'editor' ? (
                  <textarea
                    className="form-textarea"
                    style={{
                      flex: 1,
                      minHeight: 520,
                      padding: '16px',
                      fontFamily: 'monospace',
                      fontSize: '0.86rem',
                      lineHeight: 1.6,
                      border: 'none',
                      outline: 'none',
                      resize: 'vertical',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    placeholder="Digite ou edite código LaTeX..."
                  />
                ) : (
                  <div
                    ref={sourceRef}
                    className="latex-source-code"
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '16px 20px',
                      fontFamily: 'monospace',
                      fontSize: '0.84rem',
                      lineHeight: 1.6,
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}
                  >
                    {sourceLines.map((line, idx) => {
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
                          <span style={{ flex: 1 }}>{line || ' '}</span>
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
