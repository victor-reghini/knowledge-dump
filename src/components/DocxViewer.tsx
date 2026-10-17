import React, { useState, useEffect, useRef } from 'react';
import { ReferenceFile } from '../types';
import { api } from '../api';
import {
  ZoomIn,
  ZoomOut,
  Search,
  Quote,
  X,
  FileText,
  BookmarkCheck,
  RotateCcw,
  Edit3,
  Eye,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DocxParagraph {
  index: number;
  type: 'title' | 'heading' | 'paragraph' | 'list-item' | 'table';
  level?: number;
  text: string;
  html: string;
}

interface DocxViewerProps {
  reference: ReferenceFile;
  initialParagraph?: number;
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

export const DocxViewer: React.FC<DocxViewerProps> = ({
  reference,
  initialParagraph,
  highlightText,
  onCite,
  onClose
}) => {
  const [paragraphs, setParagraphs] = useState<DocxParagraph[]>([]);
  const [docTitle, setDocTitle] = useState<string>(reference.title);
  const [rawText, setRawText] = useState<string>('');
  const [originalRawText, setOriginalRawText] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zoom / Scale
  const [zoom, setZoom] = useState(100);

  // Search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Citation
  const [selectedText, setSelectedText] = useState('');
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<number | undefined>();
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number } | null>(null);
  const [copiedCite, setCopiedCite] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const isDirty = rawText !== originalRawText;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getReferenceContent(reference.id)
      .then((data) => {
        if (!isMounted) return;
        if (data.paragraphs && Array.isArray(data.paragraphs)) {
          setParagraphs(data.paragraphs);
          if (data.title) setDocTitle(data.title);
          const txt = data.text || data.paragraphs.map((p: any) => p.text).join('\n\n');
          setRawText(txt);
          setOriginalRawText(txt);
        } else if (data.text) {
          setRawText(data.text);
          setOriginalRawText(data.text);
          const lines = data.text.split('\n\n').filter(Boolean);
          setParagraphs(
            lines.map((t: string, i: number) => ({
              index: i + 1,
              type: 'paragraph',
              text: t,
              html: `<p class="docx-paragraph">${t}</p>`
            }))
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Falha ao carregar documento Word');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reference.id]);

  // Scroll to deep-linked paragraph
  useEffect(() => {
    if (!loading && initialParagraph && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-p-index="${initialParagraph}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('p-deeplink-highlight');
        setTimeout(() => el.classList.remove('p-deeplink-highlight'), 3000);
      }
    }
  }, [loading, initialParagraph]);

  // Handle selection inside document
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

    // Identifica o parágrafo selecionado
    let node: Node | null = range.startContainer;
    let pIdx: number | undefined;
    while (node && node !== containerRef.current) {
      if (node instanceof HTMLElement && node.dataset.pIndex) {
        pIdx = parseInt(node.dataset.pIndex, 10);
        break;
      }
      node = node.parentNode;
    }

    setSelectedText(text);
    setSelectedParagraphIndex(pIdx);
    setSelectionBox({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 36
    });
  };

  const handleApplyCitation = () => {
    if (!selectedText || !onCite) return;
    const pNum = selectedParagraphIndex || 1;
    onCite({
      quoteText: selectedText,
      pageNumber: pNum,
      referenceId: reference.id,
      referenceTitle: reference.title,
      anchorData: `p=${pNum}`
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
      await api.updateReferenceContent(reference.id, { text: rawText });
      setOriginalRawText(rawText);
      setSaveStatus('Alterações salvas com sucesso no arquivo Word!');
      const refreshed = await api.getReferenceContent(reference.id);
      if (refreshed.paragraphs && Array.isArray(refreshed.paragraphs)) {
        setParagraphs(refreshed.paragraphs);
      }
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Erro ao salvar: ${err.message || 'Falha na requisição'}`);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawText]);

  // Filtered paragraphs if searching
  const filteredParagraphs = searchQuery.trim()
    ? paragraphs.filter((p) => p.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : paragraphs;

  return (
    <div className="pdf-viewer-container" ref={containerRef} onMouseUp={handleMouseUp}>
      {/* Viewer Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <FileText size={16} className="text-accent" style={{ color: '#3b82f6' }} />
          <span className="pdf-title truncate" title={docTitle}>
            {docTitle}
          </span>
          <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid #3b82f6' }}>
            DOCX
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
          {/* Mode Switch (Rendered vs Edit) */}
          <div className="btn-group" style={{ display: 'flex', gap: 2 }}>
            <button
              className={`toolbar-btn ${!isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing(false)}
              title="Visualização Formatada"
            >
              <Eye size={15} />
            </button>
            <button
              className={`toolbar-btn ${isEditing ? 'active' : ''}`}
              onClick={() => setIsEditing(true)}
              title="Editar Documento"
            >
              <Edit3 size={15} />
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
            title="Salvar alterações no arquivo Word"
          >
            <Save size={14} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
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
          <span style={{ fontSize: '0.8rem', minWidth: 40, textAlign: 'center' }}>
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
            title="Buscar no Documento"
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
            placeholder="Buscar termos no documento Word..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.82rem', flex: 1 }}
            autoFocus
          />
          {searchQuery && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {filteredParagraphs.length} parágrafo(s)
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
                <span>Citar Parágrafo {selectedParagraphIndex || ''}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Document View Content Area */}
      <div className="pdf-viewport" style={{ padding: '24px 32px', overflowY: 'auto', backgroundColor: 'var(--bg-tertiary)' }}>
        {loading ? (
          <div className="empty-state">
            <p>Carregando e renderizando documento DOCX...</p>
          </div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--accent-red)' }}>
            <p>{error}</p>
          </div>
        ) : isEditing ? (
          <div
            style={{
              maxWidth: 820,
              margin: '0 auto',
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
              <span>Edição direta de texto do documento Word (.docx)</span>
              <span>{isDirty ? 'Modificado (Não salvo)' : 'Sem alterações'}</span>
            </div>
            <textarea
              className="form-textarea"
              style={{
                width: '100%',
                minHeight: 520,
                padding: '20px',
                fontFamily: 'inherit',
                fontSize: `${zoom}%`,
                lineHeight: 1.7,
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)'
              }}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Digite o conteúdo do documento Word..."
            />
          </div>
        ) : paragraphs.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum conteúdo encontrado neste arquivo.</p>
          </div>
        ) : (
          <div
            className="docx-paper-container"
            style={{
              maxWidth: 780,
              margin: '0 auto',
              backgroundColor: 'var(--bg-primary)',
              padding: '48px 56px',
              borderRadius: 6,
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.12)',
              fontSize: `${zoom}%`,
              lineHeight: 1.7,
              color: 'var(--text-primary)'
            }}
          >
            {filteredParagraphs.map((p) => {
              const isMatch = searchQuery && p.text.toLowerCase().includes(searchQuery.toLowerCase());
              return (
                <div
                  key={p.index}
                  data-p-index={p.index}
                  className={`docx-item ${isMatch ? 'docx-search-match' : ''}`}
                  style={{
                    position: 'relative',
                    marginBottom: p.type === 'heading' || p.type === 'title' ? 14 : 10,
                    padding: '2px 4px',
                    borderRadius: 4
                  }}
                  dangerouslySetInnerHTML={{ __html: p.html }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
