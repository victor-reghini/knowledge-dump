import React, { useState, useEffect, useRef } from 'react';
import { ReferenceFile } from '../types';
import { api } from '../api';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Quote,
  X,
  BookmarkCheck,
  Layout,
  MessageSquare
} from 'lucide-react';

export interface PptxSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
  text: string;
  notes?: string;
}

interface PptxViewerProps {
  reference: ReferenceFile;
  initialSlide?: number;
  initialPage?: number;
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

export const PptxViewer: React.FC<PptxViewerProps> = ({
  reference,
  initialSlide,
  initialPage,
  highlightText: _highlightText,
  onCite,
  onClose
}) => {
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [presentationTitle, setPresentationTitle] = useState<string>(reference.title);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [zoom, setZoom] = useState<number>(100);
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  // Search
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Citation
  const [selectedText, setSelectedText] = useState('');
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number } | null>(null);
  const [copiedCite, setCopiedCite] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideCanvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getReferenceContent(reference.id)
      .then((data) => {
        if (!isMounted) return;
        if (data.slides && Array.isArray(data.slides)) {
          setSlides(data.slides);
          if (data.title) setPresentationTitle(data.title);
          const startNum = initialSlide || initialPage || 1;
          const targetIdx = Math.max(0, Math.min(startNum - 1, data.slides.length - 1));
          setCurrentSlideIndex(targetIdx);
        } else if (data.text) {
          // Fallback se retornou texto plano
          const chunks = data.text.split('\n\n').filter(Boolean);
          const mockSlides: PptxSlide[] = chunks.map((c: string, idx: number) => ({
            slideNumber: idx + 1,
            title: `Slide ${idx + 1}`,
            bullets: [c],
            text: c
          }));
          setSlides(mockSlides);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Falha ao carregar apresentação PowerPoint');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reference.id, initialSlide, initialPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length]);

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

    setSelectedText(text);
    setSelectionBox({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 36
    });
  };

  const currentSlide = slides[currentSlideIndex];
  const slideNumber = currentSlide ? currentSlide.slideNumber : currentSlideIndex + 1;

  const handleApplyCitation = () => {
    if (!selectedText || !onCite) return;
    onCite({
      quoteText: selectedText,
      pageNumber: slideNumber,
      referenceId: reference.id,
      referenceTitle: reference.title,
      anchorData: `slide=${slideNumber}`
    });

    setCopiedCite(true);
    setTimeout(() => {
      setCopiedCite(false);
      setSelectionBox(null);
      window.getSelection()?.removeAllRanges();
    }, 1200);
  };

  // Slides matching search
  const matchingSlideIndices = searchQuery.trim()
    ? slides
        .map((s, idx) => ({ s, idx }))
        .filter(
          ({ s }) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.text.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(({ idx }) => idx)
    : [];

  return (
    <div className="pdf-viewer-container" ref={containerRef} onMouseUp={handleMouseUp}>
      {/* Top Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <button
            className={`toolbar-btn ${showSidebar ? 'active' : ''}`}
            onClick={() => setShowSidebar((prev) => !prev)}
            title="Alternar Miniaturas / Slides"
          >
            <Layout size={15} />
          </button>

          <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: 'rgba(234, 88, 12, 0.15)', color: '#ea580c', border: '1px solid #ea580c' }}>
            PPTX
          </span>

          <span className="pdf-title truncate" title={presentationTitle}>
            {presentationTitle}
          </span>
        </div>

        {/* Slide navigation controls */}
        <div className="pdf-toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentSlideIndex <= 0}
            title="Slide Anterior (Seta Esquerda)"
          >
            <ChevronLeft size={16} />
          </button>

          <span style={{ fontSize: '0.82rem', minWidth: 80, textAlign: 'center', fontWeight: 500 }}>
            {slides.length > 0 ? `${currentSlideIndex + 1} / ${slides.length}` : '0 / 0'}
          </span>

          <button
            className="toolbar-btn"
            onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
            disabled={currentSlideIndex >= slides.length - 1}
            title="Próximo Slide (Seta Direita / Espaço)"
          >
            <ChevronRight size={16} />
          </button>

          <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

          {/* Notes toggle */}
          {currentSlide?.notes && (
            <button
              className={`toolbar-btn ${showNotes ? 'active' : ''}`}
              onClick={() => setShowNotes((prev) => !prev)}
              title="Notas do Apresentador"
            >
              <MessageSquare size={15} />
            </button>
          )}

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
            title="Buscar nos Slides"
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

      {/* Search Bar */}
      {isSearchOpen && (
        <div className="pdf-search-bar" style={{ display: 'flex', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar termo na apresentação PowerPoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '4px 8px', fontSize: '0.82rem', flex: 1 }}
            autoFocus
          />
          {searchQuery && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {matchingSlideIndices.length} slide(s) encontrado(s)
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
                <span>Citar Slide {slideNumber}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Body Area: Sidebar (Thumbnails) + Main Slide View */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Thumbnails Sidebar */}
        {showSidebar && (
          <div
            style={{
              width: 200,
              backgroundColor: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              overflowY: 'auto',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0 4px 4px' }}>
              SLIDES ({slides.length})
            </div>
            {slides.map((s, idx) => {
              const isSelected = idx === currentSlideIndex;
              const isMatch = searchQuery && matchingSlideIndices.includes(idx);
              return (
                <div
                  key={s.slideNumber}
                  onClick={() => setCurrentSlideIndex(idx)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--accent-primary)'
                      : isMatch
                      ? 'rgba(234, 88, 12, 0.12)'
                      : 'var(--bg-primary)',
                    color: isSelected ? '#ffffff' : 'inherit',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : isMatch ? '#ea580c' : 'var(--border-color)'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', opacity: 0.85 }}>
                    <span>Slide {s.slideNumber}</span>
                    {isMatch && <span style={{ color: isSelected ? '#fff' : '#ea580c' }}>●</span>}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={s.title}
                  >
                    {s.title || `Slide ${s.slideNumber}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Viewport for active slide */}
        <div
          className="pdf-viewport"
          style={{
            flex: 1,
            padding: '32px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          {loading ? (
            <div className="empty-state">
              <p>Carregando apresentação PowerPoint...</p>
            </div>
          ) : error ? (
            <div className="empty-state" style={{ color: 'var(--accent-red)' }}>
              <p>{error}</p>
            </div>
          ) : !currentSlide ? (
            <div className="empty-state">
              <p>Nenhum slide encontrado nesta apresentação.</p>
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                maxWidth: 880,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              {/* Slide Card Canvas (16:9 Presentation look) */}
              <div
                ref={slideCanvasRef}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 8,
                  padding: '48px 56px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.16)',
                  minHeight: 460,
                  fontSize: `${zoom}%`,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: '1px solid var(--border-color)'
                }}
              >
                {/* Slide Top Badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid rgba(234, 88, 12, 0.25)',
                    paddingBottom: 14,
                    marginBottom: 24
                  }}
                >
                  <h2
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      margin: 0,
                      color: 'var(--text-primary)'
                    }}
                  >
                    {currentSlide.title || `Slide ${currentSlide.slideNumber}`}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '3px 8px',
                      borderRadius: 12
                    }}
                  >
                    #{currentSlide.slideNumber}
                  </span>
                </div>

                {/* Slide Content Bullets */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {currentSlide.bullets && currentSlide.bullets.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {currentSlide.bullets.map((bullet, bIdx) => (
                        <li
                          key={bIdx}
                          style={{
                            fontSize: '1.02rem',
                            lineHeight: 1.6,
                            color: 'var(--text-primary)'
                          }}
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '1.02rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {currentSlide.text}
                    </p>
                  )}
                </div>

                {/* Slide Footer */}
                <div
                  style={{
                    marginTop: 32,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span>{presentationTitle}</span>
                  <span>Slide {currentSlide.slideNumber} de {slides.length}</span>
                </div>
              </div>

              {/* Speaker Notes */}
              {(showNotes || currentSlide.notes) && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 6,
                    padding: '14px 18px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.84rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ea580c', fontWeight: 600, marginBottom: 4 }}>
                    <MessageSquare size={14} />
                    <span>Notas do Apresentador:</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {currentSlide.notes || 'Sem notas para este slide.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
