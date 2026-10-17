import React, { useState, useEffect, useRef } from 'react';
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
import { Extension } from '@tiptap/core';
import katex from 'katex';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Link as LinkIcon,
  Sigma,
  Anchor as AnchorIcon,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  Plus,
  Trash2,
  Image as ImageIcon,
  FileDown,
  Printer,
  Maximize2,
  Minimize2,
  FileText,
  Palette,
  Highlighter,
  RemoveFormatting,
  Eye,
  SlidersHorizontal,
  Columns
} from 'lucide-react';

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
              if (!attributes.fontSize) {
                return {};
              }
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
}

type RibbonTab = 'home' | 'insert' | 'table' | 'view' | 'export';

const FONT_SIZES = [
  { label: '9 pt', value: '9pt' },
  { label: '10 pt', value: '10pt' },
  { label: '11 pt', value: '11pt' },
  { label: '12 pt (Padrão)', value: '12pt' },
  { label: '14 pt', value: '14pt' },
  { label: '16 pt (Subtítulo)', value: '16pt' },
  { label: '18 pt', value: '18pt' },
  { label: '24 pt (Título)', value: '24pt' },
  { label: '30 pt', value: '30pt' },
  { label: '36 pt', value: '36pt' },
];

const TEXT_COLORS = [
  { name: 'Padrão', value: 'inherit' },
  { name: 'Preto', value: '#18181b' },
  { name: 'Cinza Escuro', value: '#52525b' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Roxo', value: '#7c3aed' },
  { name: 'Laranja / Âmbar', value: '#d97706' },
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
  onInsertMath,
  onInsertAnchor,
  noteTitle = 'Nota Sem Título',
  noteId,
  onExportDocx,
  onExportMarkdown,
  onExportPdf
}) => {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [isRibbonCollapsed, setIsRibbonCollapsed] = useState(false);
  const [pageLayout, setPageLayout] = useState<'a4' | 'fluid'>('a4');
  const [zoomPercent, setZoomPercent] = useState<number>(100);

  // Dropdown open states
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
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
        Carregando editor completo no formato Word...
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

  // Font size handler
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    if (!size) {
      (editor.commands as any).unsetFontSize();
    } else {
      (editor.commands as any).setFontSize(size);
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
    <div className="word-editor-container">
      {/* 1. Word / Docs Top Ribbon Menu Bar */}
      <div className="word-ribbon">
        {/* Ribbon Tab Headers */}
        <div className="word-ribbon-tabs">
          <button
            type="button"
            className={`word-tab ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('home');
              if (isRibbonCollapsed) setIsRibbonCollapsed(false);
            }}
          >
            Página Inicial
          </button>
          <button
            type="button"
            className={`word-tab ${activeTab === 'insert' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('insert');
              if (isRibbonCollapsed) setIsRibbonCollapsed(false);
            }}
          >
            Inserir
          </button>
          <button
            type="button"
            className={`word-tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('table');
              if (isRibbonCollapsed) setIsRibbonCollapsed(false);
            }}
          >
            Tabela
          </button>
          <button
            type="button"
            className={`word-tab ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('view');
              if (isRibbonCollapsed) setIsRibbonCollapsed(false);
            }}
          >
            Exibir
          </button>
          <button
            type="button"
            className={`word-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('export');
              if (isRibbonCollapsed) setIsRibbonCollapsed(false);
            }}
          >
            Exportar
          </button>

          {/* Retract / Collapse Ribbon Toggle */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginRight: 6,
                fontWeight: 500
              }}
            >
              Formato: DOCX (Word)
            </span>
            <button
              type="button"
              className="word-ribbon-toggle-btn"
              onClick={() => setIsRibbonCollapsed((prev) => !prev)}
              title={isRibbonCollapsed ? 'Expandir menus da faixa de opções' : 'Recolher menus (Modo Foco)'}
            >
              {isRibbonCollapsed ? (
                <>
                  <ChevronDown size={14} />
                  <span>Expandir Menus</span>
                </>
              ) : (
                <>
                  <ChevronUp size={14} />
                  <span>Recolher Menus</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Ribbon Toolbars Content (Collapsible) */}
        {!isRibbonCollapsed && (
          <div className="word-ribbon-body">
            {/* TAB: PÁGINA INICIAL */}
            {activeTab === 'home' && (
              <div className="word-ribbon-group-row">
                {/* Desfazer / Refazer */}
                <div className="word-tool-group">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="word-icon-btn"
                    title="Desfazer (Ctrl+Z)"
                  >
                    <Undo size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="word-icon-btn"
                    title="Refazer (Ctrl+Y)"
                  >
                    <Redo size={15} />
                  </button>
                  <span className="word-group-label">Histórico</span>
                </div>

                <div className="word-divider" />

                {/* Formatação de Parágrafo & Tamanho de Fonte */}
                <div className="word-tool-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Estilo Dropdown */}
                    <select
                      className="word-select"
                      value={getCurrentFormat()}
                      onChange={handleFormatChange}
                      title="Estilo do Texto (Título, Subtítulo, Parágrafo)"
                      style={{ minWidth: 120 }}
                    >
                      <option value="p">Texto Normal</option>
                      <option value="h1">Título 1 (H1)</option>
                      <option value="h2">Título 2 (H2)</option>
                      <option value="h3">Título 3 (H3)</option>
                      <option value="quote">Citação</option>
                      <option value="code">Bloco de Código</option>
                    </select>

                    {/* Tamanho da Fonte */}
                    <select
                      className="word-select"
                      onChange={handleFontSizeChange}
                      defaultValue="12pt"
                      title="Tamanho da Fonte"
                      style={{ width: 85 }}
                    >
                      {FONT_SIZES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="word-group-label">Estilo & Fonte</span>
                </div>

                <div className="word-divider" />

                {/* Estilos de Caractere (Bold, Italic, Underline, Strike, Code, Cor, Realce) */}
                <div className="word-tool-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={`word-icon-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
                      title="Negrito (Ctrl+B)"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={`word-icon-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
                      title="Itálico (Ctrl+I)"
                    >
                      <Italic size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      className={`word-icon-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
                      title="Sublinhado (Ctrl+U)"
                    >
                      <UnderlineIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleStrike().run()}
                      className={`word-icon-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
                      title="Tachado"
                    >
                      <Strikethrough size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleCode().run()}
                      className={`word-icon-btn ${editor.isActive('code') ? 'is-active' : ''}`}
                      title="Código Inline"
                    >
                      <Code size={15} />
                    </button>

                    {/* Cor do Texto Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowColorPicker(!showColorPicker);
                          setShowHighlightPicker(false);
                        }}
                        className="word-icon-btn"
                        title="Cor da Fonte"
                      >
                        <Palette size={15} />
                      </button>
                      {showColorPicker && (
                        <div className="word-palette-dropdown">
                          <div className="word-palette-header">Cor do Texto</div>
                          {TEXT_COLORS.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              className="word-palette-item"
                              onClick={() => {
                                if (c.value === 'inherit') {
                                  editor.chain().focus().unsetColor().run();
                                } else {
                                  editor.chain().focus().setColor(c.value).run();
                                }
                                setShowColorPicker(false);
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 14,
                                  height: 14,
                                  borderRadius: 3,
                                  backgroundColor: c.value === 'inherit' ? 'var(--text-primary)' : c.value,
                                  border: '1px solid rgba(0,0,0,0.2)'
                                }}
                              />
                              <span>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Cor de Realce Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowHighlightPicker(!showHighlightPicker);
                          setShowColorPicker(false);
                        }}
                        className={`word-icon-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
                        title="Cor de Realce do Texto"
                      >
                        <Highlighter size={15} />
                      </button>
                      {showHighlightPicker && (
                        <div className="word-palette-dropdown">
                          <div className="word-palette-header">Cor de Realce</div>
                          {HIGHLIGHT_COLORS.map((h) => (
                            <button
                              key={h.value}
                              type="button"
                              className="word-palette-item"
                              onClick={() => {
                                if (!h.value) {
                                  editor.chain().focus().unsetHighlight().run();
                                } else {
                                  editor.chain().focus().toggleHighlight({ color: h.value }).run();
                                }
                                setShowHighlightPicker(false);
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 14,
                                  height: 14,
                                  borderRadius: 3,
                                  backgroundColor: h.value || 'transparent',
                                  border: '1px solid rgba(0,0,0,0.2)'
                                }}
                              />
                              <span>{h.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Limpar Formatação */}
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                      className="word-icon-btn"
                      title="Limpar Toda a Formatação"
                    >
                      <RemoveFormatting size={15} />
                    </button>
                  </div>
                  <span className="word-group-label">Formatação</span>
                </div>

                <div className="word-divider" />

                {/* Listas e Parágrafo */}
                <div className="word-tool-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={`word-icon-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                      title="Marcadores"
                    >
                      <List size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      className={`word-icon-btn ${editor.isActive('orderedList') ? 'is-active' : ''}`}
                      title="Numeração"
                    >
                      <ListOrdered size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBlockquote().run()}
                      className={`word-icon-btn ${editor.isActive('blockquote') ? 'is-active' : ''}`}
                      title="Citação em Bloco"
                    >
                      <Quote size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().setHorizontalRule().run()}
                      className="word-icon-btn"
                      title="Linha Horizontal"
                    >
                      <Minus size={15} />
                    </button>
                  </div>
                  <span className="word-group-label">Parágrafo</span>
                </div>
              </div>
            )}

            {/* TAB: INSERIR */}
            {activeTab === 'insert' && (
              <div className="word-ribbon-group-row">
                {/* Tabelas */}
                <div className="word-tool-group">
                  <button
                    type="button"
                    className="word-action-chip"
                    onClick={() =>
                      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                    }
                    title="Inserir Tabela 3x3 no documento"
                  >
                    <TableIcon size={15} />
                    <span>Inserir Tabela (3x3)</span>
                  </button>
                  <span className="word-group-label">Tabelas</span>
                </div>

                <div className="word-divider" />

                {/* Imagens */}
                <div className="word-tool-group">
                  <button
                    type="button"
                    className="word-action-chip"
                    onClick={() => setShowImageModal(true)}
                    title="Inserir Imagem (URL ou Arquivo do Computador)"
                  >
                    <ImageIcon size={15} />
                    <span>Inserir Imagem</span>
                  </button>
                  <span className="word-group-label">Mídia</span>
                </div>

                <div className="word-divider" />

                {/* LaTeX / KaTeX Math */}
                <div className="word-tool-group">
                  <button
                    type="button"
                    className="word-action-chip"
                    onClick={() => setShowMathModal(true)}
                    title="Inserir Bloco de Fórmula Matemática LaTeX / KaTeX"
                  >
                    <Sigma size={15} />
                    <span>Fórmula LaTeX / KaTeX</span>
                  </button>
                  <span className="word-group-label">Equações</span>
                </div>

                <div className="word-divider" />

                {/* Código e Markdown */}
                <div className="word-tool-group">
                  <button
                    type="button"
                    className="word-action-chip"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    title="Inserir Bloco de Código com realce"
                  >
                    <Code size={15} />
                    <span>Bloco de Código</span>
                  </button>
                  <span className="word-group-label">Código</span>
                </div>

                <div className="word-divider" />

                {/* Wikilinks & Âncoras */}
                <div className="word-tool-group">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={onInsertWikilink}
                      title="Inserir Wikilink [[Nome da Nota#âncora]]"
                    >
                      <LinkIcon size={14} />
                      <span>Wikilink</span>
                    </button>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={onInsertAnchor}
                      title="Inserir Marcador de Âncora {#secao}"
                    >
                      <AnchorIcon size={14} />
                      <span>Âncora</span>
                    </button>
                  </div>
                  <span className="word-group-label">Conexões</span>
                </div>
              </div>
            )}

            {/* TAB: TABELA */}
            {activeTab === 'table' && (
              <div className="word-ribbon-group-row">
                <div className="word-tool-group">
                  <button
                    type="button"
                    className="word-action-chip"
                    onClick={() =>
                      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                    }
                  >
                    <Plus size={14} />
                    <span>Nova Tabela</span>
                  </button>
                  <span className="word-group-label">Criar</span>
                </div>

                <div className="word-divider" />

                <div className="word-tool-group">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => editor.chain().focus().addRowBefore().run()}
                      title="Adicionar Linha Acima"
                    >
                      + Linha Acima
                    </button>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      title="Adicionar Linha Abaixo"
                    >
                      + Linha Abaixo
                    </button>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      title="Excluir Linha Selecionada"
                    >
                      Excluir Linha
                    </button>
                  </div>
                  <span className="word-group-label">Linhas</span>
                </div>

                <div className="word-divider" />

                <div className="word-tool-group">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => editor.chain().focus().addColumnBefore().run()}
                      title="Adicionar Coluna Antes"
                    >
                      + Coluna Antes
                    </button>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      title="Adicionar Coluna Depois"
                    >
                      + Coluna Depois
                    </button>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      title="Excluir Coluna Selecionada"
                    >
                      Excluir Coluna
                    </button>
                  </div>
                  <span className="word-group-label">Colunas</span>
                </div>

                <div className="word-divider" />

                <div className="word-tool-group">
                  <button
                    type="button"
                    className="word-action-chip"
                    style={{ color: 'var(--accent-red)' }}
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    title="Excluir Tabela Inteira"
                  >
                    <Trash2 size={14} />
                    <span>Excluir Tabela</span>
                  </button>
                  <span className="word-group-label">Ações</span>
                </div>
              </div>
            )}

            {/* TAB: EXIBIR */}
            {activeTab === 'view' && (
              <div className="word-ribbon-group-row">
                <div className="word-tool-group">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`word-action-chip ${pageLayout === 'a4' ? 'active' : ''}`}
                      onClick={() => setPageLayout('a4')}
                    >
                      <FileText size={14} />
                      <span>Layout Página A4 (Word)</span>
                    </button>
                    <button
                      type="button"
                      className={`word-action-chip ${pageLayout === 'fluid' ? 'active' : ''}`}
                      onClick={() => setPageLayout('fluid')}
                    >
                      <Maximize2 size={14} />
                      <span>Largura Total (Fluida)</span>
                    </button>
                  </div>
                  <span className="word-group-label">Modo de Exibição</span>
                </div>

                <div className="word-divider" />

                <div className="word-tool-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="word-icon-btn"
                      onClick={() => setZoomPercent((prev) => Math.max(75, prev - 10))}
                      title="Diminuir Zoom"
                    >
                      -
                    </button>
                    <span style={{ fontSize: '0.82rem', minWidth: 44, textAlign: 'center' }}>
                      {zoomPercent}%
                    </span>
                    <button
                      type="button"
                      className="word-icon-btn"
                      onClick={() => setZoomPercent((prev) => Math.min(150, prev + 10))}
                      title="Aumentar Zoom"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={() => setZoomPercent(100)}
                      style={{ padding: '2px 6px', fontSize: '0.72rem' }}
                    >
                      100%
                    </button>
                  </div>
                  <span className="word-group-label">Zoom da Página</span>
                </div>
              </div>
            )}

            {/* TAB: EXPORTAR */}
            {activeTab === 'export' && (
              <div className="word-ribbon-group-row">
                <div className="word-tool-group">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="word-action-chip primary"
                      onClick={onExportDocx}
                      title="Exportar anotação como documento Microsoft Word (.docx)"
                    >
                      <FileDown size={15} />
                      <span>Exportar como Word (.docx)</span>
                    </button>

                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={onExportPdf || (() => window.print())}
                      title="Exportar / Imprimir como PDF (.pdf)"
                    >
                      <Printer size={15} />
                      <span>Exportar como PDF (.pdf)</span>
                    </button>

                    <button
                      type="button"
                      className="word-action-chip"
                      onClick={onExportMarkdown}
                      title="Exportar como Markdown (.md)"
                    >
                      <FileText size={15} />
                      <span>Exportar como Markdown (.md)</span>
                    </button>
                  </div>
                  <span className="word-group-label">Opções de Exportação</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Word Workbench / Paper Page View */}
      <div className={`word-workbench-area ${pageLayout === 'fluid' ? 'is-fluid' : ''}`}>
        <div
          className="word-page-sheet printable-document"
          style={{
            transform: zoomPercent !== 100 ? `scale(${zoomPercent / 100})` : undefined,
            transformOrigin: 'top center'
          }}
        >
          {/* Document Header Line (Visual Guide) */}
          <div className="word-page-header-indicator">
            <span className="word-page-title-preview">{noteTitle}</span>
            <span className="word-page-date-indicator">{new Date().toLocaleDateString('pt-BR')}</span>
          </div>

          {/* Main TipTap Editing Surface */}
          <EditorContent editor={editor} className="word-editor-content" />
        </div>
      </div>

      {/* Modal: Inserir Imagem */}
      {showImageModal && (
        <div className="modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem' }}>Inserir Imagem na Nota</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 6 }}>
                Opção 1: Enviar do Computador
              </label>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileUpload}
                style={{ fontSize: '0.82rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OU</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-color)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: 6 }}>
                Opção 2: URL da Imagem na Web
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
                  color: 'var(--text-primary)'
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
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Digite o código em notação matemática LaTeX. O preview em tempo real é exibido abaixo.
            </p>

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
                marginBottom: 12
              }}
              placeholder="ex: \int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
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
                Inserir no Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
