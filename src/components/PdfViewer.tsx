import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error Vite URL import for worker
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ReferenceFile } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Quote,
  X,
  Maximize2,
  Minimize2,
  FileText,
  BookmarkCheck
} from 'lucide-react';

// Configure PDF.js worker using Vite asset URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  reference: ReferenceFile;
  initialPage?: number;
  highlightText?: string;
  onCite?: (citation: {
    quoteText: string;
    pageNumber: number;
    referenceId: string;
    referenceTitle: string;
  }) => void;
  onClose?: () => void;
  isCompact?: boolean;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  reference,
  initialPage = 1,
  highlightText,
  onCite,
  onClose,
  isCompact = false
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.1);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search in PDF
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ page: number; text: string }[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);

  // Selection & citation toolbar
  const [selectedText, setSelectedText] = useState('');
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number } | null>(null);
  const [copiedCite, setCopiedCite] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const fileUrl = `/api/references/${reference.id}/file`;

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setErrorMessage(null);

    const loadingTask = pdfjsLib.getDocument({
      url: fileUrl,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true
    });

    loadingTask.promise
      .then((doc) => {
        if (isCancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(Math.min(Math.max(1, initialPage), doc.numPages));
        setLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Erro ao carregar PDF:', err);
        setErrorMessage('Não foi possível carregar o arquivo PDF. Verifique se o arquivo existe e é válido.');
        setLoading(false);
      });

    return () => {
      isCancelled = true;
      loadingTask.destroy();
    };
  }, [fileUrl, reference.id]);

  // Jump to initialPage when changed externally
  useEffect(() => {
    if (initialPage && pdfDoc && initialPage <= pdfDoc.numPages) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, pdfDoc]);

  // Render active page on canvas and textLayer
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;

      // Render Text Layer for native selection and deep-link highlights
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
        textLayerRef.current.style.width = `${Math.floor(viewport.width)}px`;
        textLayerRef.current.style.height = `${Math.floor(viewport.height)}px`;

        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport: viewport
        });
        await textLayer.render();

        // Highlight targeted deep-link text if on this page
        if (highlightText && highlightText.trim()) {
          const spans = textLayerRef.current.querySelectorAll('span');
          const normalizedTarget = highlightText.trim().toLowerCase();
          spans.forEach((span) => {
            if (span.textContent && span.textContent.toLowerCase().includes(normalizedTarget.slice(0, 20))) {
              span.classList.add('pdf-text-highlight');
              span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
        console.error('Erro de renderização da página PDF:', err);
      }
    }
  }, [pdfDoc, currentPage, scale, rotation, highlightText]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Handle Text Selection for Citation Tooltip
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !textLayerRef.current) {
        setSelectedText('');
        setSelectionBox(null);
        return;
      }

      if (textLayerRef.current.contains(selection.anchorNode)) {
        const text = selection.toString().trim();
        if (text.length > 3) {
          setSelectedText(text);
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const containerRect = containerRef.current?.getBoundingClientRect();

          if (containerRect) {
            setSelectionBox({
              x: rect.left - containerRect.left + rect.width / 2,
              y: rect.top - containerRect.top - 12
            });
          }
          return;
        }
      }

      setSelectedText('');
      setSelectionBox(null);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mouseup', handleMouseUp);
      return () => container.removeEventListener('mouseup', handleMouseUp);
    }
  }, []);

  // Citation Action Trigger
  const handleCiteSelection = () => {
    if (!selectedText || !onCite) return;
    onCite({
      quoteText: selectedText,
      pageNumber: currentPage,
      referenceId: reference.id,
      referenceTitle: reference.title
    });
    setCopiedCite(true);
    setTimeout(() => {
      setCopiedCite(false);
      setSelectionBox(null);
      setSelectedText('');
    }, 1500);
  };

  // Search within document
  const handlePerformSearch = async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    const results: { page: number; text: string }[] = [];
    const q = searchQuery.toLowerCase().trim();

    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const fullPageText = content.items
          .map((item) => ('str' in item ? (item as { str: string }).str : ''))
          .join(' ');
        if (fullPageText.toLowerCase().includes(q)) {
          results.push({ page: i, text: fullPageText.slice(0, 100) });
        }
      }
      setSearchResults(results);
      if (results.length > 0) {
        setActiveSearchIndex(0);
        setCurrentPage(results[0].page);
      }
    } catch (err) {
      console.error('Falha na busca:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextSearch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (activeSearchIndex + 1) % searchResults.length;
    setActiveSearchIndex(nextIdx);
    setCurrentPage(searchResults[nextIdx].page);
  };

  const handlePrevSearch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (activeSearchIndex - 1 + searchResults.length) % searchResults.length;
    setActiveSearchIndex(prevIdx);
    setCurrentPage(searchResults[prevIdx].page);
  };

  return (
    <div className={`pdf-viewer-container ${isCompact ? 'compact' : ''}`} ref={containerRef}>
      {/* Top Toolbar */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <span className="pdf-doc-badge" title={reference.title}>
            <FileText size={14} className="pdf-badge-icon" />
            <span className="pdf-doc-title">{reference.title}</span>
          </span>
          {reference.authors && (
            <span className="pdf-doc-author" title={reference.authors}>
              ({reference.authors}{reference.year ? `, ${reference.year}` : ''})
            </span>
          )}
        </div>

        {/* Page navigation */}
        <div className="pdf-toolbar-group pdf-nav-group">
          <button
            className="pdf-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            title="Página Anterior (Alt+Left)"
            aria-label="Página Anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="pdf-page-indicator">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const p = parseInt(e.target.value, 10);
                if (!isNaN(p)) setCurrentPage(Math.min(Math.max(1, p), totalPages));
              }}
              className="pdf-page-input"
              aria-label="Número da página"
            />
            <span className="pdf-page-total">/ {totalPages}</span>
          </div>

          <button
            className="pdf-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            title="Próxima Página (Alt+Right)"
            aria-label="Próxima Página"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Zoom & Rotation */}
        <div className="pdf-toolbar-group">
          <button
            className="pdf-btn"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            title="Diminuir Zoom"
            aria-label="Diminuir Zoom"
          >
            <ZoomOut size={16} />
          </button>
          <span className="pdf-zoom-label">{Math.round(scale * 100)}%</span>
          <button
            className="pdf-btn"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            title="Aumentar Zoom"
            aria-label="Aumentar Zoom"
          >
            <ZoomIn size={16} />
          </button>
          <button
            className="pdf-btn"
            onClick={() => setScale(1.0)}
            title="Ajustar 100%"
            aria-label="Zoom 100%"
          >
            100%
          </button>
          <button
            className="pdf-btn"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Girar 90° no sentido horário"
            aria-label="Girar 90 graus"
          >
            <RotateCw size={16} />
          </button>
        </div>

        {/* Actions: Search & Close */}
        <div className="pdf-toolbar-group">
          <button
            className={`pdf-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen((prev) => !prev)}
            title="Pesquisar no Documento"
            aria-label="Pesquisar no PDF"
          >
            <Search size={16} />
          </button>
          {onClose && (
            <button
              className="pdf-btn pdf-close-btn"
              onClick={onClose}
              title="Fechar Visualizador de PDF"
              aria-label="Fechar PDF"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Search Drawer */}
      {isSearchOpen && (
        <div className="pdf-search-bar">
          <input
            type="text"
            placeholder="Buscar termo no PDF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePerformSearch()}
            className="pdf-search-input"
            autoFocus
          />
          <button className="pdf-btn-action" onClick={handlePerformSearch} disabled={isSearching}>
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
          {searchResults.length > 0 && (
            <div className="pdf-search-matches">
              <span>
                {activeSearchIndex + 1} de {searchResults.length} ocorrência(s)
              </span>
              <button className="pdf-btn-icon-sm" onClick={handlePrevSearch} title="Anterior">
                <ChevronLeft size={14} />
              </button>
              <button className="pdf-btn-icon-sm" onClick={handleNextSearch} title="Próxima">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          {searchResults.length === 0 && searchQuery && !isSearching && (
            <span className="pdf-search-empty">Nenhum resultado</span>
          )}
        </div>
      )}

      {/* Floating Citation Tooltip on Text Selection */}
      {selectionBox && selectedText && onCite && (
        <div
          className="pdf-floating-cite-box"
          style={{
            left: `${selectionBox.x}px`,
            top: `${selectionBox.y}px`
          }}
        >
          <button
            className="pdf-cite-trigger-btn"
            onClick={handleCiteSelection}
            title="Citar trecho selecionado na anotação ativa"
          >
            {copiedCite ? (
              <>
                <BookmarkCheck size={14} className="text-success" />
                <span>Citado na Nota!</span>
              </>
            ) : (
              <>
                <Quote size={14} />
                <span>Citar na Anotação (Pág. {currentPage})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Viewport & Canvas Area */}
      <div className="pdf-canvas-wrapper">
        {loading && (
          <div className="pdf-status-layer">
            <div className="pdf-spinner" />
            <p>Carregando documento PDF ({reference.title})...</p>
          </div>
        )}

        {errorMessage && (
          <div className="pdf-status-layer error">
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="pdf-page-container" style={{ display: loading || errorMessage ? 'none' : 'block' }}>
          <canvas ref={canvasRef} className="pdf-canvas" />
          <div ref={textLayerRef} className="pdf-text-layer" />
        </div>
      </div>
    </div>
  );
};
