import React, { useState, useEffect, useRef } from 'react';
import {
  PenTool,
  BookOpen,
  FileText,
  Download,
  Share2,
  Trash2,
  Plus,
  Search,
  Check,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Quote,
  Hash,
  ExternalLink,
  Copy,
  Layers,
  Save,
  Clock,
  Type,
  FileCode,
  BookMarked,
  List,
  Sparkles,
  Eye,
  Edit3
} from 'lucide-react';
import { api } from '../api';
import { Article, ArticleCitation, ReferenceFile, Note, CompileOptions, CompileResult } from '../types';

interface ScientificEditorProps {
  references: ReferenceFile[];
  notes: Note[];
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToReference?: (refId: string) => void;
}

export const ScientificEditor: React.FC<ScientificEditorProps> = ({
  references,
  notes,
  onNavigateToNote,
  onNavigateToReference
}) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Focus mode
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Side Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [drawerTab, setDrawerTab] = useState<'search' | 'citations'>('search');
  const [drawerSearch, setDrawerSearch] = useState('');

  // Metadata collapse
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'md' | 'tex' | 'docx' | 'pdf'>('pdf');
  const [exportStyle, setExportStyle] = useState<'ABNT' | 'APA' | 'IEEE'>('ABNT');
  const [includeAbstract, setIncludeAbstract] = useState(true);
  const [includeBib, setIncludeBib] = useState(true);
  const [includeFrontmatter, setIncludeFrontmatter] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [compilePreview, setCompilePreview] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Filter articles
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [articleSearch, setArticleSearch] = useState('');

  // Auto-save timer ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    loadArticles();
  }, [statusFilter]);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const list = await api.getArticles(statusFilter === 'all' ? undefined : statusFilter);
      setArticles(list);
      if (list.length > 0 && !activeArticle) {
        loadArticleDetail(list[0].id);
      } else if (list.length === 0) {
        setActiveArticle(null);
      }
    } catch (err) {
      console.error('Falha ao carregar artigos:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadArticleDetail = async (id: string) => {
    try {
      const art = await api.getArticle(id);
      setActiveArticle(art);
    } catch (err) {
      console.error('Falha ao carregar detalhes do artigo:', err);
    }
  };

  const handleCreateArticle = async () => {
    try {
      const newArt = await api.createArticle({
        title: 'Novo Artigo Científico',
        subtitle: 'Subtítulo Temático e Delimitação do Escopo',
        abstract: 'Resumo estruturado contendo contextualização teórica, objetivos metodológicos e hipótese investigada.',
        content: '# 1. Introdução\n\nContextualize aqui a fundamentação teórica e a motivação do estudo.\n\n# 2. Metodologia & Fundamentação\n\nDescreva a abordagem formal ou experimental adotada.\n\n# 3. Análise e Discussão\n\nApresente os resultados e estabeleça diálogo com as fontes do acervo.',
        keywords: ['Metodologia', 'Síntese'],
        status: 'draft',
        target_venue: 'Revista Acadêmica'
      });
      setArticles([newArt, ...articles]);
      setActiveArticle(newArt);
    } catch (err) {
      console.error('Erro ao criar artigo:', err);
    }
  };

  const handleFieldChange = (field: keyof Article, value: any) => {
    if (!activeArticle) return;
    const updated = { ...activeArticle, [field]: value };

    if (field === 'content') {
      const words = (value || '').trim().split(/\s+/).filter(Boolean).length;
      updated.word_count = words;
      updated.estimated_reading_minutes = Math.max(1, Math.ceil(words / 200));
    }

    setActiveArticle(updated);

    // Schedule debounced auto-save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveArticle(updated);
    }, 1200);
  };

  const saveArticle = async (artToSave?: Article) => {
    const target = artToSave || activeArticle;
    if (!target) return;
    try {
      setSaving(true);
      const res = await api.updateArticle(target.id, {
        title: target.title,
        subtitle: target.subtitle || '',
        abstract: target.abstract || '',
        content: target.content,
        keywords: target.keywords,
        status: target.status,
        target_venue: target.target_venue || ''
      });
      setLastSaved(new Date());
      setArticles(prev => prev.map(a => a.id === target.id ? { ...a, ...res } : a));
    } catch (err) {
      console.error('Erro ao salvar artigo:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este artigo?')) return;
    try {
      await api.deleteArticle(id);
      const nextList = articles.filter(a => a.id !== id);
      setArticles(nextList);
      if (activeArticle?.id === id) {
        if (nextList.length > 0) loadArticleDetail(nextList[0].id);
        else setActiveArticle(null);
      }
    } catch (err) {
      console.error('Erro ao excluir artigo:', err);
    }
  };

  // Insert snippet or citation into editor at cursor position
  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !activeArticle) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const prevContent = activeArticle.content || '';
    const newContent = prevContent.substring(0, start) + textToInsert + prevContent.substring(end);

    handleFieldChange('content', newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  // Add citation to article and insert inline citation tag
  const handleAddCitationFromReference = async (ref: ReferenceFile) => {
    if (!activeArticle) return;
    try {
      const authorLastName = (ref.authors?.split(',')[0] || ref.authors?.split(' ')[0] || 'REF')
        .trim().replace(/[^a-zA-ZÀ-ÿ]/g, '');
      const year = ref.year || new Date().getFullYear();
      const citeKey = `${authorLastName.toLowerCase()}${year}`;

      const citation = await api.addArticleCitation(activeArticle.id, {
        reference_id: ref.id,
        citation_key: citeKey,
        formatted_text: `${(ref.authors || 'AUTOR').toUpperCase()}. ${ref.title}. ${ref.year || ''}.`
      });

      // Update local article citations
      const updatedCitations = [...(activeArticle.citations || []), citation];
      setActiveArticle({
        ...activeArticle,
        citations: updatedCitations,
        citations_count: updatedCitations.length
      });

      // Insert inline citation
      const inlineTag = ` (${authorLastName.toUpperCase()}, ${year})`;
      insertTextAtCursor(inlineTag);
    } catch (err) {
      console.error('Erro ao vincular citação:', err);
    }
  };

  const handleAddCitationFromNote = async (note: Note) => {
    if (!activeArticle) return;
    try {
      const citeKey = note.title.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
      const citation = await api.addArticleCitation(activeArticle.id, {
        note_id: note.id,
        citation_key: citeKey,
        formatted_text: `KNOWLEDGE DUMP. ${note.title}. Acervo de anotações pessoais.`
      });

      const updatedCitations = [...(activeArticle.citations || []), citation];
      setActiveArticle({
        ...activeArticle,
        citations: updatedCitations,
        citations_count: updatedCitations.length
      });

      // Insert Wikilink
      insertTextAtCursor(` [[${note.title}]] `);
    } catch (err) {
      console.error('Erro ao vincular nota:', err);
    }
  };

  const handleRemoveCitation = async (citationId: string) => {
    if (!activeArticle) return;
    try {
      await api.deleteArticleCitation(activeArticle.id, citationId);
      const filtered = (activeArticle.citations || []).filter(c => c.id !== citationId);
      setActiveArticle({
        ...activeArticle,
        citations: filtered,
        citations_count: filtered.length
      });
    } catch (err) {
      console.error('Erro ao remover citação:', err);
    }
  };

  // Compile Preview for Modal
  const handleUpdateCompilePreview = async () => {
    if (!activeArticle) return;
    try {
      setCompiling(true);
      const res = await api.compileExport(
        {
          title: activeArticle.title,
          subtitle: activeArticle.subtitle,
          authors: activeArticle.author_name || 'Pesquisador Knowledge Dump',
          abstract: activeArticle.abstract,
          keywords: activeArticle.keywords,
          content: activeArticle.content,
          status: activeArticle.status,
          target_venue: activeArticle.target_venue,
          citations: (activeArticle.citations || []).map(c => ({
            key: c.citation_key,
            title: c.reference_title || c.note_title || 'Fonte Sem Título',
            authors: c.reference_authors || undefined,
            year: c.reference_year || undefined,
            doi: c.reference_doi || undefined,
            formatted_text: c.formatted_text || undefined
          }))
        },
        exportFormat,
        {
          citationStyle: exportStyle,
          includeAbstract,
          includeBibliography: includeBib,
          includeFrontmatter
        }
      );
      if (res.compiled) {
        setCompilePreview(res.compiled);
      } else {
        setCompilePreview(null);
      }
    } catch (err) {
      console.error('Falha ao compilar pré-visualização:', err);
    } finally {
      setCompiling(false);
    }
  };

  useEffect(() => {
    if (isExportModalOpen && (exportFormat === 'md' || exportFormat === 'tex')) {
      handleUpdateCompilePreview();
    }
  }, [isExportModalOpen, exportFormat, exportStyle, includeAbstract, includeBib, includeFrontmatter]);

  // Filter drawer references and notes
  const filteredReferences = references.filter(r =>
    r.title.toLowerCase().includes(drawerSearch.toLowerCase()) ||
    (r.authors && r.authors.toLowerCase().includes(drawerSearch.toLowerCase()))
  );

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(drawerSearch.toLowerCase()) ||
    n.content.toLowerCase().includes(drawerSearch.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full bg-kd-bg text-kd-text select-text ${isFocusMode ? 'focus-mode' : ''}`}>
      {/* Top Navbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-kd-border bg-kd-surface">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 font-bold">
              <PenTool size={18} />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-wide text-kd-text">
                Modo de Redação Científica
              </span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-kd-border text-kd-muted">
                RF-30 / RF-31
              </span>
            </div>
          </div>

          {activeArticle && (
            <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-kd-border text-xs text-kd-muted">
              <span>{activeArticle.word_count || 0} palavras</span>
              <span>•</span>
              <span>~{activeArticle.estimated_reading_minutes || 1} min de leitura</span>
              <span>•</span>
              <span>{activeArticle.citations_count || 0} fontes citadas</span>
              {saving ? (
                <span className="text-yellow-500 ml-2 animate-pulse">Salvando...</span>
              ) : lastSaved ? (
                <span className="text-green-500 ml-2 flex items-center gap-1">
                  <Check size={12} /> Salvo
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2">
          {activeArticle && (
            <>
              <button
                onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors ${
                  isMetadataExpanded
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40'
                    : 'bg-kd-surface hover:bg-kd-hover text-kd-text border-kd-border'
                }`}
                title="Metadados acadêmicos (Resumo, Palavras-chave, Veículo)"
              >
                <BookMarked size={14} />
                <span className="hidden sm:inline">Metadados</span>
                {isMetadataExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              <button
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors ${
                  isDrawerOpen
                    ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40'
                    : 'bg-kd-surface hover:bg-kd-hover text-kd-text border-kd-border'
                }`}
                title="Gaveta de Fontes e Citações"
              >
                <Quote size={14} />
                <span className="hidden sm:inline">Gaveta de Citações</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                  {activeArticle.citations_count || 0}
                </span>
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-yellow-500 hover:bg-yellow-400 text-neutral-950 transition-colors shadow-sm"
              >
                <Download size={14} />
                <span>Compilar & Exportar</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`p-1.5 rounded border transition-colors ${
              isFocusMode
                ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40'
                : 'bg-kd-surface hover:bg-kd-hover text-kd-muted border-kd-border'
            }`}
            title={isFocusMode ? 'Sair do Modo Foco' : 'Modo Foco Zen'}
          >
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Article Selector Sidebar (hidden in focus mode) */}
        {!isFocusMode && (
          <div className="w-64 border-r border-kd-border bg-kd-surface flex flex-col shrink-0">
            {/* Header / Actions */}
            <div className="p-3 border-b border-kd-border flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-kd-muted">
                Seus Artigos ({articles.length})
              </span>
              <button
                onClick={handleCreateArticle}
                className="p-1 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 transition-colors"
                title="Novo Artigo"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="p-2 border-b border-kd-border space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-kd-muted" />
                <input
                  type="text"
                  placeholder="Buscar artigos..."
                  value={articleSearch}
                  onChange={e => setArticleSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-kd-bg border border-kd-border rounded focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div className="flex gap-1 text-[11px]">
                {['all', 'draft', 'review', 'published'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`flex-1 py-0.5 rounded text-center capitalize transition-colors ${
                      statusFilter === st
                        ? 'bg-yellow-500 text-neutral-950 font-bold'
                        : 'bg-kd-bg text-kd-muted hover:text-kd-text'
                    }`}
                  >
                    {st === 'all' ? 'Todos' : st === 'draft' ? 'Rascunho' : st === 'review' ? 'Revisão' : 'Pronto'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-kd-border/50">
              {articles
                .filter(a => a.title.toLowerCase().includes(articleSearch.toLowerCase()))
                .map(art => {
                  const isSelected = activeArticle?.id === art.id;
                  return (
                    <div
                      key={art.id}
                      onClick={() => loadArticleDetail(art.id)}
                      className={`p-3 cursor-pointer group transition-colors ${
                        isSelected
                          ? 'bg-yellow-500/15 border-l-4 border-yellow-500'
                          : 'hover:bg-kd-hover'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-semibold text-kd-text line-clamp-2 leading-tight">
                          {art.title || 'Sem título'}
                        </h4>
                        <button
                          onClick={e => handleDeleteArticle(art.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                          title="Excluir Artigo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {art.subtitle && (
                        <p className="text-[11px] text-kd-muted line-clamp-1 mt-0.5">
                          {art.subtitle}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-kd-muted">
                        <span className={`px-1.5 py-0.2 rounded font-medium ${
                          art.status === 'published'
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                            : art.status === 'review'
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'bg-kd-border text-kd-muted'
                        }`}>
                          {art.status === 'published' ? 'Publicado' : art.status === 'review' ? 'Em Revisão' : 'Rascunho'}
                        </span>
                        <span>{art.word_count || 0} pal.</span>
                        {art.citations_count ? (
                          <span className="flex items-center gap-0.5">
                            <Quote size={10} /> {art.citations_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              {articles.length === 0 && !loading && (
                <div className="p-4 text-center text-xs text-kd-muted">
                  Nenhum artigo encontrado. Clique no botão + acima para iniciar um novo texto acadêmico.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center: Focused Writing Environment */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-kd-bg">
          {activeArticle ? (
            <div className="max-w-4xl w-full mx-auto p-6 md:p-8 flex-1 flex flex-col gap-4">
              {/* Status and Target Venue Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-kd-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-kd-muted">Estado do Manuscrito:</span>
                  <select
                    value={activeArticle.status}
                    onChange={e => handleFieldChange('status', e.target.value)}
                    className="bg-kd-surface border border-kd-border rounded px-2 py-1 text-xs focus:outline-none focus:border-yellow-500 text-kd-text"
                  >
                    <option value="draft">Rascunho Inicial</option>
                    <option value="review">Em Revisão por Pares</option>
                    <option value="published">Finalizado / Publicado</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-kd-muted">Veículo Alvo:</span>
                  <input
                    type="text"
                    placeholder="ex: Periódico IEEE, Revista ABNT, Simpósio"
                    value={activeArticle.target_venue || ''}
                    onChange={e => handleFieldChange('target_venue', e.target.value)}
                    className="bg-kd-surface border border-kd-border rounded px-2.5 py-1 text-xs w-48 focus:outline-none focus:border-yellow-500 text-kd-text"
                  />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={activeArticle.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  placeholder="Título do Artigo Científico..."
                  className="w-full text-2xl md:text-3xl font-extrabold tracking-tight bg-transparent border-b border-transparent hover:border-kd-border focus:border-yellow-500 focus:outline-none pb-1 text-kd-text"
                />
                <input
                  type="text"
                  value={activeArticle.subtitle || ''}
                  onChange={e => handleFieldChange('subtitle', e.target.value)}
                  placeholder="Subtítulo ou delimitação do escopo teórico (opcional)..."
                  className="w-full text-sm italic text-kd-muted bg-transparent border-b border-transparent hover:border-kd-border focus:border-yellow-500 focus:outline-none pb-1"
                />
              </div>

              {/* Metadata Expandable Block (Abstract & Keywords) */}
              {isMetadataExpanded && (
                <div className="p-4 rounded-lg bg-kd-surface border border-kd-border space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-kd-muted mb-1">
                      Resumo Estruturado (Abstract)
                    </label>
                    <textarea
                      rows={4}
                      value={activeArticle.abstract || ''}
                      onChange={e => handleFieldChange('abstract', e.target.value)}
                      placeholder="Sintetize a problemática, metodologia, resultados centrais e conclusão..."
                      className="w-full p-2.5 text-xs bg-kd-bg border border-kd-border rounded focus:outline-none focus:border-yellow-500 text-kd-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-kd-muted mb-1">
                      Palavras-chave (separadas por vírgula)
                    </label>
                    <input
                      type="text"
                      value={(activeArticle.keywords || []).join(', ')}
                      onChange={e => {
                        const kw = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        handleFieldChange('keywords', kw);
                      }}
                      placeholder="ex: Redes Neurais, Otimização, Gradiente Descendente"
                      className="w-full px-2.5 py-1.5 text-xs bg-kd-bg border border-kd-border rounded focus:outline-none focus:border-yellow-500 text-kd-text"
                    />
                  </div>
                </div>
              )}

              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-lg bg-kd-surface border border-kd-border text-xs">
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n# ')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text font-bold"
                  title="Seção Principal (H1)"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n## ')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text font-bold"
                  title="Subseção (H2)"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n### ')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text font-bold"
                  title="Sub-subseção (H3)"
                >
                  H3
                </button>
                <div className="w-[1px] h-4 bg-kd-border mx-1" />
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('**termo**')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text font-bold"
                  title="Negrito (**)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('*termo*')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text italic"
                  title="Itálico (*)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n> ')}
                  className="p-1 hover:bg-kd-hover rounded text-kd-text"
                  title="Citação em Bloco (>)"
                >
                  <Quote size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n- ')}
                  className="p-1 hover:bg-kd-hover rounded text-kd-text"
                  title="Item de Lista (-)"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor(' $E=mc^2$ ')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text font-mono text-[11px]"
                  title="Fórmula LaTeX ($)"
                >
                  $\sum$
                </button>
                <div className="w-[1px] h-4 bg-kd-border mx-1" />
                <button
                  type="button"
                  onClick={() => insertTextAtCursor(' [[Nota]] ')}
                  className="px-2 py-1 hover:bg-kd-hover rounded text-kd-text font-mono text-[11px] text-yellow-600 dark:text-yellow-400"
                  title="Wikilink para anotação"
                >
                  [[Wikilink]]
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="ml-auto flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20"
                >
                  <Quote size={12} /> Inserir Fonte
                </button>
              </div>

              {/* Main Content Textarea */}
              <div className="flex-1 flex flex-col min-h-[420px]">
                <textarea
                  ref={textareaRef}
                  value={activeArticle.content}
                  onChange={e => handleFieldChange('content', e.target.value)}
                  placeholder="Escreva seu artigo aqui... Use Markdown para títulos, parágrafos e citações."
                  className="w-full flex-1 p-4 font-mono text-sm leading-relaxed bg-kd-surface border border-kd-border rounded-lg focus:outline-none focus:border-yellow-500 resize-none text-kd-text shadow-inner"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="p-4 rounded-full bg-yellow-500/10 text-yellow-500 mb-3">
                <PenTool size={36} />
              </div>
              <h3 className="text-base font-bold text-kd-text mb-1">
                Ambiente de Redação Acadêmica & Síntese
              </h3>
              <p className="text-xs text-kd-muted max-w-md mb-4">
                Redija artigos científicos com acesso instantâneo a todas as notas, citações e referências catalogadas no acervo soberano.
              </p>
              <button
                onClick={handleCreateArticle}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-bold rounded-lg text-xs shadow-md"
              >
                <Plus size={16} /> Criar Primeiro Artigo
              </button>
            </div>
          )}
        </div>

        {/* Right Drawer: Gaveta de Citações e Fontes (RF-30) */}
        {isDrawerOpen && activeArticle && !isFocusMode && (
          <div className="w-80 border-l border-kd-border bg-kd-surface flex flex-col shrink-0">
            {/* Header */}
            <div className="p-3 border-b border-kd-border flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-kd-text">
                <Quote size={14} className="text-yellow-500" />
                <span>Gaveta de Citações</span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 hover:bg-kd-hover rounded text-kd-muted"
                title="Fechar Gaveta"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-kd-border text-xs">
              <button
                onClick={() => setDrawerTab('search')}
                className={`flex-1 py-2 text-center font-medium transition-colors border-b-2 ${
                  drawerTab === 'search'
                    ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400 font-bold'
                    : 'border-transparent text-kd-muted hover:text-kd-text'
                }`}
              >
                Consultar Acervo
              </button>
              <button
                onClick={() => setDrawerTab('citations')}
                className={`flex-1 py-2 text-center font-medium transition-colors border-b-2 ${
                  drawerTab === 'citations'
                    ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400 font-bold'
                    : 'border-transparent text-kd-muted hover:text-kd-text'
                }`}
              >
                Referências Citadas ({activeArticle.citations_count || 0})
              </button>
            </div>

            {/* Tab: Consultar Acervo */}
            {drawerTab === 'search' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 border-b border-kd-border">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-kd-muted" />
                    <input
                      type="text"
                      placeholder="Filtrar papers, PDFs ou notas..."
                      value={drawerSearch}
                      onChange={e => setDrawerSearch(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs bg-kd-bg border border-kd-border rounded focus:outline-none focus:border-yellow-500 text-kd-text"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                  {/* References Section */}
                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-kd-muted mb-1.5 flex items-center justify-between">
                      <span>Papers & Referências ({filteredReferences.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {filteredReferences.map(ref => (
                        <div
                          key={ref.id}
                          className="p-2 rounded bg-kd-bg border border-kd-border/70 hover:border-yellow-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-semibold text-kd-text line-clamp-1">
                              {ref.title}
                            </span>
                            <span className="text-[10px] px-1 py-0.2 rounded bg-kd-surface text-kd-muted uppercase">
                              {ref.file_type}
                            </span>
                          </div>
                          <p className="text-[10px] text-kd-muted mt-0.5 line-clamp-1">
                            {ref.authors ? `${ref.authors} (${ref.year || 's.d.'})` : 'Autor desconhecido'}
                          </p>

                          {/* Quick Insert Buttons */}
                          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-kd-border/40">
                            <button
                              onClick={() => handleAddCitationFromReference(ref)}
                              className="flex-1 py-1 px-1.5 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-medium transition-colors"
                              title="Insere citação inline e inclui na bibliografia"
                            >
                              + Citar (ABNT)
                            </button>
                            {onNavigateToReference && (
                              <button
                                onClick={() => onNavigateToReference(ref.id)}
                                className="p-1 hover:bg-kd-hover rounded text-kd-muted hover:text-kd-text"
                                title="Abrir referência no visualizador"
                              >
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {filteredReferences.length === 0 && (
                        <p className="text-[11px] text-kd-muted italic p-1">Nenhuma referência encontrada.</p>
                      )}
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-kd-muted mb-1.5 flex items-center justify-between">
                      <span>Notas do Acervo ({filteredNotes.length})</span>
                    </h5>
                    <div className="space-y-1.5">
                      {filteredNotes.slice(0, 10).map(note => (
                        <div
                          key={note.id}
                          className="p-2 rounded bg-kd-bg border border-kd-border/70 hover:border-yellow-500/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-semibold text-kd-text line-clamp-1">
                              {note.title}
                            </span>
                          </div>
                          <p className="text-[10px] text-kd-muted mt-0.5 line-clamp-2">
                            {note.content.replace(/<[^>]+>/g, '').slice(0, 80)}...
                          </p>
                          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-kd-border/40">
                            <button
                              onClick={() => handleAddCitationFromNote(note)}
                              className="flex-1 py-1 px-1.5 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-[10px] font-medium transition-colors"
                              title="Insere Wikilink e vincula à bibliografia"
                            >
                              + Inserir [[Wikilink]]
                            </button>
                            {onNavigateToNote && (
                              <button
                                onClick={() => onNavigateToNote(note.id)}
                                className="p-1 hover:bg-kd-hover rounded text-kd-muted hover:text-kd-text"
                                title="Abrir nota no editor"
                              >
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Referências Citadas no Artigo */}
            {drawerTab === 'citations' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {(activeArticle.citations || []).length > 0 ? (
                  activeArticle.citations!.map((cit, idx) => (
                    <div
                      key={cit.id}
                      className="p-2.5 rounded bg-kd-bg border border-kd-border relative group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[11px] font-bold text-yellow-500">
                          [{idx + 1}] \{'{'}{cit.citation_key}{'}'}
                        </span>
                        <button
                          onClick={() => handleRemoveCitation(cit.id)}
                          className="text-kd-muted hover:text-red-500 p-0.5"
                          title="Remover citação deste artigo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-xs font-medium text-kd-text mt-1">
                        {cit.reference_title || cit.note_title}
                      </p>
                      {cit.reference_authors && (
                        <p className="text-[10px] text-kd-muted mt-0.5">
                          {cit.reference_authors} ({cit.reference_year || 's.d.'})
                        </p>
                      )}
                      <div className="mt-2 pt-1 border-t border-kd-border/40 flex items-center gap-2">
                        <button
                          onClick={() => insertTextAtCursor(`\\cite{${cit.citation_key}}`)}
                          className="text-[10px] text-kd-muted hover:text-yellow-500 font-mono"
                          title="Inserir \cite{key} LaTeX"
                        >
                          + \cite
                        </button>
                        <button
                          onClick={() => {
                            const author = cit.reference_authors?.split(',')[0] || 'AUTOR';
                            insertTextAtCursor(` (${author.toUpperCase()}, ${cit.reference_year || ''})`);
                          }}
                          className="text-[10px] text-kd-muted hover:text-yellow-500"
                          title="Inserir (AUTOR, Ano) ABNT"
                        >
                          + (Autor, Ano)
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-6 text-xs text-kd-muted">
                    Nenhuma referência vinculada a este artigo ainda. Vá até a aba "Consultar Acervo" e clique em "+ Citar".
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export & Compilation Modal (RF-31) */}
      {isExportModalOpen && activeArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-kd-surface border border-kd-border rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-kd-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={18} className="text-yellow-500" />
                <h3 className="text-sm font-bold text-kd-text">
                  Compilação e Exportação Científica (RF-31)
                </h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 hover:bg-kd-hover rounded text-kd-muted"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Formats Selection */}
              <div>
                <label className="block font-bold text-kd-text uppercase tracking-wider mb-2">
                  1. Formato de Publicação
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'pdf', label: 'PDF Acadêmico (.pdf)', desc: 'Layout com cabeçalho e páginas' },
                    { id: 'tex', label: 'LaTeX (.tex)', desc: 'Código puro para pdflatex / Overleaf' },
                    { id: 'docx', label: 'Word (.docx)', desc: 'Documento editável OpenXML' },
                    { id: 'md', label: 'Markdown (.md)', desc: 'Frontmatter YAML & Portabilidade' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => setExportFormat(fmt.id as any)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        exportFormat === fmt.id
                          ? 'bg-yellow-500/15 border-yellow-500 text-yellow-600 dark:text-yellow-400 font-bold ring-1 ring-yellow-500'
                          : 'bg-kd-bg border-kd-border text-kd-text hover:border-kd-border/80'
                      }`}
                    >
                      <div className="font-semibold">{fmt.label}</div>
                      <div className="text-[10px] text-kd-muted mt-1 leading-tight">{fmt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-kd-border">
                <div>
                  <label className="block font-bold text-kd-text uppercase tracking-wider mb-1.5">
                    Estilo de Citação
                  </label>
                  <select
                    value={exportStyle}
                    onChange={e => setExportStyle(e.target.value as any)}
                    className="w-full bg-kd-bg border border-kd-border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-yellow-500 text-kd-text"
                  >
                    <option value="ABNT">ABNT (SOBRENOME, Ano)</option>
                    <option value="IEEE">IEEE ([1] Autor, "Título")</option>
                    <option value="APA">APA (Autor, Ano)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-kd-text uppercase tracking-wider mb-1.5">
                    Elementos Opcionais
                  </label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeAbstract}
                        onChange={e => setIncludeAbstract(e.target.checked)}
                        className="rounded border-kd-border text-yellow-500 focus:ring-yellow-500"
                      />
                      <span className="text-kd-text">Incluir Resumo & Palavras-chave</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeBib}
                        onChange={e => setIncludeBib(e.target.checked)}
                        className="rounded border-kd-border text-yellow-500 focus:ring-yellow-500"
                      />
                      <span className="text-kd-text">Incluir Lista de Referências Citadas</span>
                    </label>
                    {exportFormat === 'md' && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeFrontmatter}
                          onChange={e => setIncludeFrontmatter(e.target.checked)}
                          className="rounded border-kd-border text-yellow-500 focus:ring-yellow-500"
                        />
                        <span className="text-kd-text">Incluir Metadados YAML Frontmatter</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Code Preview for Markdown / LaTeX */}
              {(exportFormat === 'md' || exportFormat === 'tex') && (
                <div className="pt-2 border-t border-kd-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-kd-text uppercase tracking-wider">
                      Pré-visualização do Código Compilado
                    </label>
                    <button
                      onClick={() => {
                        if (compilePreview) {
                          navigator.clipboard.writeText(compilePreview);
                          setCopiedPreview(true);
                          setTimeout(() => setCopiedPreview(false), 2000);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400 hover:underline"
                    >
                      {copiedPreview ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedPreview ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded bg-kd-bg border border-kd-border font-mono text-[11px] max-h-44 overflow-y-auto whitespace-pre-wrap text-kd-text">
                    {compiling ? 'Compilando arquivo...' : compilePreview || 'Sem conteúdo para pré-visualização.'}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-kd-border bg-kd-surface/50 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-3 py-1.5 rounded border border-kd-border hover:bg-kd-hover text-kd-muted text-xs"
              >
                Cancelar
              </button>
              <a
                href={api.getArticleExportUrl(activeArticle.id, exportFormat, exportStyle)}
                download
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-yellow-500 hover:bg-yellow-400 text-neutral-950 font-bold text-xs shadow-md transition-colors"
              >
                <Download size={14} />
                <span>Baixar Manuscrito Compilado (.{exportFormat})</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
