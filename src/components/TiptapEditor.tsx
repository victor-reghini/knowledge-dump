import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import katex from 'katex';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Undo,
  Redo,
  Printer,
  CheckCheck,
  Link as LinkIcon,
  Sigma,
  Image as ImageIcon,
  List,
  ListOrdered,
  RemoveFormatting,
  Table as TableIcon,
  Edit3,
  ArrowLeft,
  ArrowRight,
  MoreVertical,
  Trash2,
  SeparatorHorizontal,
  BookOpen,
  Scroll
} from 'lucide-react';

// Custom TipTap Extension for Google Docs / Word Page Break
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
      { tag: 'div.docs-page-break' },
      { tag: 'hr.page-break' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-break',
        class: 'docs-page-break',
      }),
      [
        'div',
        { class: 'docs-page-break-gap' },
        ['span', { class: 'docs-page-break-label' }, 'Página'],
      ],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
          ({ chain }: any) => {
            return chain().insertContent({ type: this.name }).run();
          },
    } as any;
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        return (this.editor.commands as any).setPageBreak();
      },
    };
  },
});

// Custom TipTap Extension for Font Size
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});

interface TiptapEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  onInsertWikilink: () => void;
  onInsertMath: () => void;
  onInsertAnchor: () => void;
  noteTitle?: string;
  noteId?: string;
  onExportDocx?: () => void;
  onExportMarkdown?: () => void;
  onExportPdf?: () => void;
  isPaginatedMode?: boolean;
  onTogglePaginatedMode?: () => void;
}

const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const TEXT_COLORS = [
  { name: 'Padrão', value: 'inherit' },
  { name: 'Preto', value: '#18181b' },
  { name: 'Cinza', value: '#52525b' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Roxo', value: '#7c3aed' },
  { name: 'Laranja', value: '#d97706' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Sem Realce', value: '' },
  { name: 'Amarelo', value: '#fef08a' },
  { name: 'Verde', value: '#bbf7d0' },
  { name: 'Azul', value: '#bfdbfe' },
  { name: 'Rosa', value: '#fbcfe8' },
  { name: 'Laranja', value: '#fed7aa' },
];

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  onInsertWikilink,
  onInsertMath: _onInsertMath,
  onInsertAnchor: _onInsertAnchor,
  noteTitle: _noteTitle = 'Nota Sem Título',
  noteId: _noteId,
  onExportDocx: _onExportDocx,
  onExportMarkdown: _onExportMarkdown,
  onExportPdf,
  isPaginatedMode: isPaginatedModeProp,
  onTogglePaginatedMode,
}) => {
  const [localPaginatedMode, setLocalPaginatedMode] = useState<boolean>(true);
  const isPaginated = isPaginatedModeProp !== undefined ? isPaginatedModeProp : localPaginatedMode;
  const togglePaginated = () => {
    if (onTogglePaginatedMode) {
      onTogglePaginatedMode();
    } else {
      setLocalPaginatedMode((prev) => !prev);
    }
  };

  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [currentFontSize, setCurrentFontSize] = useState<number>(11);
  const [selectedFontFamily, setSelectedFontFamily] = useState<string>('Arial, sans-serif');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const [showRuler] = useState<boolean>(true);

  // Modals & popovers
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showMathModal, setShowMathModal] = useState(false);
  const [mathInput, setMathInput] = useState('\\sigma(z) = \\frac{1}{1 + e^{-z}}');
  const [mathPreviewHtml, setMathPreviewHtml] = useState('');

  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextStyle,
      FontSize,
      PageBreak,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep synced if content updates externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Extract headings dynamically for Google Docs "Guias no documento" outline
  const headings = useMemo(() => {
    if (!editor) return [];
    const items: { text: string; level: number }[] = [];
    try {
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          const text = node.textContent?.trim();
          if (text) {
            items.push({
              text,
              level: node.attrs.level || 1,
            });
          }
        }
      });
    } catch { }
    return items;
  }, [content, editor]);

  // Update KaTeX preview
  useEffect(() => {
    if (!mathInput.trim()) {
      setMathPreviewHtml('');
      return;
    }
    try {
      const rendered = katex.renderToString(mathInput.trim(), {
        throwOnError: false,
        displayMode: true,
      });
      setMathPreviewHtml(rendered);
    } catch (e: any) {
      setMathPreviewHtml(`<span style="color:red">Erro: ${e.message}</span>`);
    }
  }, [mathInput]);

  if (!editor) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        Carregando editor Google Docs...
      </div>
    );
  }

  // Format Heading / Paragraph Change
  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'p') editor.chain().focus().setParagraph().run();
    else if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
    else if (val === 'quote') editor.chain().focus().toggleBlockquote().run();
    else if (val === 'code') editor.chain().focus().toggleCodeBlock().run();
  };

  const getCurrentFormat = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    if (editor.isActive('blockquote')) return 'quote';
    if (editor.isActive('codeBlock')) return 'code';
    return 'p';
  };

  // Font size handlers
  const handleFontSizeDelta = (delta: number) => {
    const nextSize = Math.max(8, Math.min(72, currentFontSize + delta));
    setCurrentFontSize(nextSize);
    (editor.commands as any).setFontSize(`${nextSize}pt`);
  };

  // Font family change
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const family = e.target.value;
    setSelectedFontFamily(family);
  };

  // Click on heading in outline drawer scrolls into view
  const handleHeadingClick = (text: string) => {
    const sheet = document.querySelector('.docs-page-canvas');
    if (!sheet) return;
    const elements = sheet.querySelectorAll('h1, h2, h3');
    for (const el of Array.from(elements)) {
      if (el.textContent?.trim() === text.trim()) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
    }
  };

  // Image insertion
  const handleInsertImageUrl = () => {
    if (!imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl('');
    setShowImageModal(false);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        editor.chain().focus().setImage({ src }).run();
      }
    };
    reader.readAsDataURL(file);
    setShowImageModal(false);
  };

  // KaTeX insertion
  const handleInsertMathConfirm = () => {
    if (!mathInput.trim()) return;
    const mathBlockHtml = `<div class="katex-block-wrapper" data-latex="${encodeURIComponent(
      mathInput.trim()
    )}">${mathPreviewHtml}</div><p></p>`;
    editor.chain().focus().insertContent(mathBlockHtml).run();
    setShowMathModal(false);
  };

  return (
    <div className="word-editor-container" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
      {/* 1. Google Docs Formatting Ribbon Toolbar */}
      <div className="docs-ribbon-bar" role="toolbar" aria-label="Barra de Ferramentas Google Docs">
        {/* Undo / Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="docs-tool-btn"
          title="Desfazer (Ctrl+Z)"
        >
          <Undo size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="docs-tool-btn"
          title="Refazer (Ctrl+Y)"
        >
          <Redo size={14} />
        </button>

        {/* Print / Export PDF */}
        <button
          type="button"
          onClick={onExportPdf || (() => window.print())}
          className="docs-tool-btn"
          title="Imprimir / Exportar PDF (Ctrl+P)"
        >
          <Printer size={14} />
        </button>

        {/* Spellcheck */}
        <button
          type="button"
          className="docs-tool-btn"
          title="Verificação ortográfica e gramatical"
        >
          <CheckCheck size={14} />
        </button>

        <div className="docs-tool-divider" />

        {/* Zoom */}
        <select
          className="docs-tool-select"
          value={zoomPercent}
          onChange={(e) => setZoomPercent(Number(e.target.value))}
          title="Zoom"
        >
          <option value={75}>75%</option>
          <option value={90}>90%</option>
          <option value={100}>100%</option>
          <option value={125}>125%</option>
          <option value={150}>150%</option>
        </select>

        <div className="docs-tool-divider" />

        {/* Style Dropdown (Texto normal, Título 1, Título 2, etc.) */}
        <select
          className="docs-tool-select"
          value={getCurrentFormat()}
          onChange={handleFormatChange}
          title="Estilos de Parágrafo"
          style={{ minWidth: 110 }}
        >
          <option value="p">Texto normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
          <option value="quote">Citação</option>
          <option value="code">Código</option>
        </select>

        <div className="docs-tool-divider" />

        {/* Font Family Dropdown */}
        <select
          className="docs-tool-select"
          value={selectedFontFamily}
          onChange={handleFontFamilyChange}
          title="Fonte"
          style={{ minWidth: 80 }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <div className="docs-tool-divider" />

        {/* Font Size: - 11 + */}
        <div className="docs-font-size-group" title="Tamanho da fonte">
          <button
            type="button"
            className="docs-font-size-btn"
            onClick={() => handleFontSizeDelta(-1)}
          >
            -
          </button>
          <span className="docs-font-size-val">{currentFontSize}</span>
          <button
            type="button"
            className="docs-font-size-btn"
            onClick={() => handleFontSizeDelta(1)}
          >
            +
          </button>
        </div>

        <div className="docs-tool-divider" />

        {/* Character Formatting: B, I, U, Strike */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`docs-tool-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          title="Negrito (Ctrl+B)"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`docs-tool-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          title="Itálico (Ctrl+I)"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`docs-tool-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
          title="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`docs-tool-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
          title="Tachado"
        >
          <Strikethrough size={14} />
        </button>

        {/* Text Color Picker */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="docs-tool-btn"
            title="Cor do Texto"
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem', lineHeight: 1 }}>A</span>
              <div style={{ width: 12, height: 3, backgroundColor: '#2563eb', marginTop: 1 }} />
            </div>
          </button>
          {showColorPicker && (
            <div className="word-palette-dropdown">
              <div className="word-palette-header">Cor do Texto</div>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="word-palette-item"
                  onClick={() => {
                    if (c.value === 'inherit') editor.chain().focus().unsetColor().run();
                    else editor.chain().focus().setColor(c.value).run();
                    setShowColorPicker(false);
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: c.value === 'inherit' ? '#888' : c.value,
                      display: 'inline-block',
                    }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Highlight Color Picker */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            className="docs-tool-btn"
            title="Cor de Destaque"
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Edit3 size={13} />
              <div style={{ width: 12, height: 3, backgroundColor: '#fef08a', marginTop: 1 }} />
            </div>
          </button>
          {showHighlightPicker && (
            <div className="word-palette-dropdown">
              <div className="word-palette-header">Cor de Realce</div>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="word-palette-item"
                  onClick={() => {
                    if (!c.value) editor.chain().focus().unsetHighlight().run();
                    else editor.chain().focus().toggleHighlight({ color: c.value }).run();
                    setShowHighlightPicker(false);
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      backgroundColor: c.value || '#eee',
                      border: '1px solid #ccc',
                      display: 'inline-block',
                    }}
                  />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="docs-tool-divider" />

        {/* Link / Wikilink */}
        <button
          type="button"
          onClick={onInsertWikilink}
          className="docs-tool-btn"
          title="Inserir Wikilink [[Nota]]"
        >
          <LinkIcon size={14} />
        </button>

        {/* KaTeX Math Equation */}
        <button
          type="button"
          onClick={() => setShowMathModal(true)}
          className="docs-tool-btn"
          title="Inserir Equação Matemática LaTeX / KaTeX"
        >
          <Sigma size={14} />
        </button>

        {/* Image */}
        <button
          type="button"
          onClick={() => setShowImageModal(true)}
          className="docs-tool-btn"
          title="Inserir imagem"
        >
          <ImageIcon size={14} />
        </button>

        <div className="docs-tool-divider" />

        {/* Lists & Tasks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`docs-tool-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
          title="Lista com Marcadores"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`docs-tool-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
          title="Lista Numerada"
        >
          <ListOrdered size={14} />
        </button>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="docs-tool-btn"
          title="Limpar Formatação"
        >
          <RemoveFormatting size={14} />
        </button>

        {/* Table Menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowTableMenu(!showTableMenu)}
            className="docs-tool-btn"
            title="Inserir ou gerenciar tabela"
          >
            <TableIcon size={14} />
          </button>
          {showTableMenu && (
            <div className="word-palette-dropdown" style={{ minWidth: 160 }}>
              <div className="word-palette-header">Opções de Tabela</div>
              <button
                type="button"
                className="word-palette-item"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  setShowTableMenu(false);
                }}
              >
                + Tabela 3x3
              </button>
              <button
                type="button"
                className="word-palette-item"
                onClick={() => {
                  editor.chain().focus().addRowAfter().run();
                  setShowTableMenu(false);
                }}
              >
                + Linha Abaixo
              </button>
              <button
                type="button"
                className="word-palette-item"
                onClick={() => {
                  editor.chain().focus().addColumnAfter().run();
                  setShowTableMenu(false);
                }}
              >
                + Coluna à Direita
              </button>
              <button
                type="button"
                className="word-palette-item"
                style={{ color: 'var(--accent-red)' }}
                onClick={() => {
                  editor.chain().focus().deleteTable().run();
                  setShowTableMenu(false);
                }}
              >
                <Trash2 size={12} />
                <span>Excluir Tabela</span>
              </button>
            </div>
          )}
        </div>

        {/* Page Break (Quebra de Página - Ctrl+Enter) */}
        <button
          type="button"
          onClick={() => (editor.commands as any).setPageBreak()}
          className="docs-tool-btn"
          title="Inserir Quebra de Página (Ctrl+Enter)"
        >
          <SeparatorHorizontal size={14} />
        </button>

        {/* Right Mode Indicator: "Edição" & "Com Páginas / Sem Páginas" */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={togglePaginated}
            className={`docs-tool-btn ${isPaginated ? 'is-active' : ''}`}
            title={
              isPaginated
                ? 'Modo Com Páginas (A4) ativo. Clique para alternar para Contínuo.'
                : 'Modo Sem Páginas (Contínuo) ativo. Clique para alternar para Com Páginas.'
            }
          >
            {isPaginated ? <BookOpen size={14} /> : <Scroll size={14} />}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: 'var(--bg-tertiary)',
            }}
          >
            <Edit3 size={12} />
            <span>Edição</span>
          </div>
        </div>
      </div>

      {/* 2. Google Docs Horizontal Measurement Ruler */}
      {showRuler && (
        <div className="docs-ruler-bar" title="Régua do Documento">
          <div className="docs-ruler-scale">
            <div className="docs-ruler-slider-left" />
            {[...Array(18)].map((_, i) => {
              const num = i + 1;
              const leftPercent = (num / 18) * 100;
              return (
                <React.Fragment key={num}>
                  <span
                    className="docs-ruler-number"
                    style={{ left: `${leftPercent}%` }}
                  >
                    {num}
                  </span>
                  <div
                    className="docs-ruler-tick"
                    style={{ left: `${leftPercent}%`, height: 8 }}
                  />
                  {num < 18 && (
                    <div
                      className="docs-ruler-tick"
                      style={{ left: `${leftPercent + 100 / 36}%`, height: 4 }}
                    />
                  )}
                </React.Fragment>
              );
            })}
            <div className="docs-ruler-slider-right" />
          </div>
        </div>
      )}

      {/* 3. Google Docs Workbench: Left Outline Drawer + White Paper Canvas */}
      <div className="docs-workbench-container">
        {/* Left Drawer ("Guias no documento" & Headings Outline) */}
        <aside
          className={`docs-outline-drawer ${!isDrawerOpen ? 'collapsed' : ''}`}
          aria-label="Sumário e Guias do Documento"
        >
          <div className="docs-guias-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Guias no documento</span>
            </div>
            <button
              type="button"
              className="docs-doc-chip-btn"
              onClick={() => setIsDrawerOpen(false)}
              title="Recolher guias do documento"
            >
              <ArrowLeft size={14} />
            </button>
          </div>

          {/* Active Guide Tab */}
          <div className="docs-guia-tab">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.8rem' }}>📄</span>
              <span>Guia 1</span>
            </div>
            <MoreVertical size={13} style={{ opacity: 0.6 }} />
          </div>

          <div style={{ marginTop: 8 }}>
            <span className="docs-outline-subtitle">
              {headings.length === 0
                ? 'Os títulos que forem adicionados ao documento aparecerão aqui.'
                : 'Sumário de Títulos:'}
            </span>
          </div>

          {/* Dynamic Headings List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
            {headings.map((h, idx) => (
              <button
                key={`${h.text}-${idx}`}
                type="button"
                className="docs-outline-item"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 6}px` }}
                onClick={() => handleHeadingClick(h.text)}
                title={`Ir para: ${h.text}`}
              >
                {h.text}
              </button>
            ))}
          </div>
        </aside>

        {/* Toggle open drawer button when collapsed */}
        {!isDrawerOpen && (
          <button
            type="button"
            className="notes-column-toggle-btn"
            style={{ position: 'absolute', left: 4, top: 110, zIndex: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            onClick={() => setIsDrawerOpen(true)}
            title="Expandir guias do documento"
          >
            <ArrowRight size={14} />
          </button>
        )}

        {/* Main Desk Surface & White Page Canvas */}
        <main className="docs-desk-area">
          <div
            className={`docs-page-canvas printable-document ${!isPaginated ? 'is-pageless' : ''}`}
            style={{
              transform: zoomPercent !== 100 ? `scale(${zoomPercent / 100})` : undefined,
              transformOrigin: 'top center',
              fontFamily: selectedFontFamily,
            }}
          >
            <EditorContent editor={editor} className="word-editor-content" />
          </div>
        </main>
      </div>

      {/* Modal: Inserir Imagem */}
      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem' }}>Inserir Imagem na Nota</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 6 }}>
                Enviar do Computador:
              </label>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileUpload}
                style={{ fontSize: '0.82rem' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 6 }}>
                Ou URL da Imagem na Web:
              </label>
              <input
                type="text"
                placeholder="https://exemplo.com/imagem.png"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => setShowImageModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleInsertImageUrl}
                disabled={!imageUrl.trim()}
              >
                Inserir Imagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inserir LaTeX / KaTeX */}
      {showMathModal && (
        <div className="modal-overlay" onClick={() => setShowMathModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1rem' }}>Inserir Equação LaTeX / KaTeX</h3>
            <textarea
              value={mathInput}
              onChange={(e) => setMathInput(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                marginBottom: 12,
              }}
              placeholder="ex: \sigma(z) = \frac{1}{1 + e^{-z}}"
            />
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                PREVIEW EM TEMPO REAL:
              </span>
              <div
                className="katex-block-wrapper"
                style={{ marginTop: 6, minHeight: 48 }}
                dangerouslySetInnerHTML={{ __html: mathPreviewHtml }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => setShowMathModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleInsertMathConfirm}
                disabled={!mathInput.trim()}
              >
                Inserir Equação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
