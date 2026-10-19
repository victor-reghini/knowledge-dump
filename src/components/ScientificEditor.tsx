import React, { useState, useEffect, useRef } from 'react';
import {
  PenTool,
  Download,
  Trash2,
  Plus,
  Search,
  Check,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Quote,
  ExternalLink,
  Copy,
  BookMarked,
  List
} from 'lucide-react';
import { api } from '../api';
import { Article, ReferenceFile, Note } from '../types';

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

      const updatedCitations = [...(activeArticle.citations || []), citation];
      setActiveArticle({
        ...activeArticle,
        citations: updatedCitations,
        citations_count: updatedCitations.length
      });

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

  const filteredReferences = references.filter(r =>
    r.title.toLowerCase().includes(drawerSearch.toLowerCase()) ||
    (r.authors && r.authors.toLowerCase().includes(drawerSearch.toLowerCase()))
  );

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(drawerSearch.toLowerCase()) ||
    n.content.toLowerCase().includes(drawerSearch.toLowerCase())
  );

  return (
    <div className={`sci-container ${isFocusMode ? 'focus-mode' : ''}`}>
      {/* Top Header Bar */}
      <div className="sci-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-yellow-glow)', color: 'var(--primary-yellow-text)', display: 'flex' }}>
              <PenTool size={18} />
            </div>
            <div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Modo de Redação Científica
              </span>
              <span className="sci-badge" style={{ marginLeft: 8 }}>
                RF-30 / RF-31
              </span>
            </div>
          </div>

          {activeArticle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{activeArticle.word_count || 0} palavras</span>
              <span>•</span>
              <span>~{activeArticle.estimated_reading_minutes || 1} min de leitura</span>
              <span>•</span>
              <span>{activeArticle.citations_count || 0} fontes citadas</span>
              {saving ? (
                <span style={{ color: 'var(--primary-yellow-border)', marginLeft: 6 }}>Salvando...</span>
              ) : lastSaved ? (
                <span style={{ color: 'var(--accent-green)', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={12} /> Salvo
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeArticle && (
            <>
              <button
                type="button"
                onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
                className={`sci-btn ${isMetadataExpanded ? 'sci-btn-active' : ''}`}
                title="Metadados acadêmicos (Resumo, Palavras-chave, Veículo)"
              >
                <BookMarked size={14} />
                <span>Metadados</span>
                {isMetadataExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                className={`sci-btn ${isDrawerOpen ? 'sci-btn-active' : ''}`}
                title="Gaveta de Fontes e Citações"
              >
                <Quote size={14} />
                <span>Gaveta de Citações</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.68rem',
                  backgroundColor: 'var(--primary-yellow)',
                  color: 'var(--primary-yellow-text)',
                  fontWeight: 700
                }}>
                  {activeArticle.citations_count || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="sci-btn sci-btn-primary"
              >
                <Download size={14} />
                <span>Compilar & Exportar</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`sci-icon-btn ${isFocusMode ? 'primary' : ''}`}
            style={{ border: '1px solid var(--border-color)', padding: 6 }}
            title={isFocusMode ? 'Sair do Modo Foco' : 'Modo Foco Zen'}
          >
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="sci-workspace">
        {/* Left: Article Selector Sidebar (hidden in focus mode) */}
        {!isFocusMode && (
          <aside className="sci-sidebar">
            <div className="sci-sidebar-header">
              <span className="sci-sidebar-title">
                Seus Artigos ({articles.length})
              </span>
              <button
                type="button"
                onClick={handleCreateArticle}
                className="sci-icon-btn primary"
                title="Novo Artigo"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Search Box */}
            <div className="sci-search-box">
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar artigos..."
                  value={articleSearch}
                  onChange={e => setArticleSearch(e.target.value)}
                  className="sci-input"
                  style={{ paddingLeft: 26 }}
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="sci-pills">
              {['all', 'draft', 'review', 'published'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`sci-pill ${statusFilter === st ? 'active' : ''}`}
                >
                  {st === 'all' ? 'Todos' : st === 'draft' ? 'Rascunho' : st === 'review' ? 'Revisão' : 'Pronto'}
                </button>
              ))}
            </div>

            {/* Articles List */}
            <div className="sci-articles-list">
              {articles
                .filter(a => a.title.toLowerCase().includes(articleSearch.toLowerCase()))
                .map(art => {
                  const isSelected = activeArticle?.id === art.id;
                  return (
                    <div
                      key={art.id}
                      onClick={() => loadArticleDetail(art.id)}
                      className={`sci-article-card ${isSelected ? 'active' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <h4 className="sci-article-title">
                          {art.title || 'Sem título'}
                        </h4>
                        <button
                          type="button"
                          onClick={e => handleDeleteArticle(art.id, e)}
                          className="sci-icon-btn"
                          style={{ padding: 2 }}
                          title="Excluir Artigo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {art.subtitle && (
                        <p className="sci-article-subtitle">
                          {art.subtitle}
                        </p>
                      )}
                      <div className="sci-article-tags">
                        <span className={`sci-status-tag ${art.status}`}>
                          {art.status === 'published' ? 'Publicado' : art.status === 'review' ? 'Em Revisão' : 'Rascunho'}
                        </span>
                        <span>{art.word_count || 0} pal.</span>
                        {art.citations_count ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Quote size={10} /> {art.citations_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              {articles.length === 0 && !loading && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Nenhum artigo encontrado. Clique no botão + acima para iniciar um novo texto acadêmico.
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center: Focused Writing Environment */}
        <main className="sci-main-canvas">
          {activeArticle ? (
            <div className="sci-center-paper">
              {/* Status and Target Venue Bar */}
              <div className="sci-meta-strip">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Estado do Manuscrito:</span>
                  <select
                    value={activeArticle.status}
                    onChange={e => handleFieldChange('status', e.target.value)}
                    className="sci-select"
                  >
                    <option value="draft">Rascunho Inicial</option>
                    <option value="review">Em Revisão por Pares</option>
                    <option value="published">Finalizado / Publicado</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Veículo Alvo:</span>
                  <input
                    type="text"
                    placeholder="ex: Periódico IEEE, Revista ABNT, Simpósio"
                    value={activeArticle.target_venue || ''}
                    onChange={e => handleFieldChange('target_venue', e.target.value)}
                    className="sci-input"
                    style={{ width: 220 }}
                  />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="text"
                  value={activeArticle.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  placeholder="Título do Artigo Científico..."
                  className="sci-title-input"
                />
                <input
                  type="text"
                  value={activeArticle.subtitle || ''}
                  onChange={e => handleFieldChange('subtitle', e.target.value)}
                  placeholder="Subtítulo ou delimitação do escopo teórico (opcional)..."
                  className="sci-subtitle-input"
                />
              </div>

              {/* Metadata Expandable Block (Abstract & Keywords) */}
              {isMetadataExpanded && (
                <div className="sci-meta-card">
                  <div>
                    <label className="sci-label">
                      Resumo Estruturado (Abstract)
                    </label>
                    <textarea
                      rows={4}
                      value={activeArticle.abstract || ''}
                      onChange={e => handleFieldChange('abstract', e.target.value)}
                      placeholder="Sintetize a problemática, metodologia, resultados centrais e conclusão..."
                      className="sci-textarea"
                    />
                  </div>
                  <div>
                    <label className="sci-label">
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
                      className="sci-input"
                    />
                  </div>
                </div>
              )}

              {/* Formatting Toolbar */}
              <div className="sci-toolbar">
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n# ')}
                  className="sci-tool-btn bold"
                  title="Seção Principal (H1)"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n## ')}
                  className="sci-tool-btn bold"
                  title="Subseção (H2)"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n### ')}
                  className="sci-tool-btn bold"
                  title="Sub-subseção (H3)"
                >
                  H3
                </button>
                <div className="sci-tool-divider" />
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('**termo**')}
                  className="sci-tool-btn bold"
                  title="Negrito (**)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('*termo*')}
                  className="sci-tool-btn italic"
                  title="Itálico (*)"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n> ')}
                  className="sci-tool-btn"
                  title="Citação em Bloco (>)"
                >
                  <Quote size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor('\n- ')}
                  className="sci-tool-btn"
                  title="Item de Lista (-)"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertTextAtCursor(' $E=mc^2$ ')}
                  className="sci-tool-btn"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  title="Fórmula LaTeX ($)"
                >
                  $\sum$
                </button>
                <div className="sci-tool-divider" />
                <button
                  type="button"
                  onClick={() => insertTextAtCursor(' [[Nota]] ')}
                  className="sci-tool-btn"
                  style={{ color: 'var(--primary-yellow-border)', fontWeight: 600 }}
                  title="Wikilink para anotação"
                >
                  [[Wikilink]]
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="sci-btn"
                  style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  <Quote size={12} /> Inserir Fonte
                </button>
              </div>

              {/* Main Content Textarea */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 480 }}>
                <textarea
                  ref={textareaRef}
                  value={activeArticle.content}
                  onChange={e => handleFieldChange('content', e.target.value)}
                  placeholder="Escreva seu artigo aqui... Use Markdown para títulos, parágrafos e citações."
                  className="sci-editor-textarea"
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center' }}>
              <div style={{ padding: 18, borderRadius: '50%', backgroundColor: 'var(--primary-yellow-glow)', color: 'var(--primary-yellow-text)', marginBottom: 16 }}>
                <PenTool size={36} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                Ambiente de Redação Acadêmica & Síntese
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 440, marginBottom: 20 }}>
                Redija artigos científicos com acesso instantâneo a todas as notas, citações e referências catalogadas no acervo soberano.
              </p>
              <button
                type="button"
                onClick={handleCreateArticle}
                className="sci-btn sci-btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.82rem' }}
              >
                <Plus size={16} /> Criar Primeiro Artigo
              </button>
            </div>
          )}
        </main>

        {/* Right Drawer: Gaveta de Citações e Fontes (RF-30) */}
        {isDrawerOpen && activeArticle && !isFocusMode && (
          <aside className="sci-drawer">
            {/* Header */}
            <div className="sci-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Quote size={14} style={{ color: 'var(--primary-yellow-border)' }} />
                <span>Gaveta de Citações</span>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="sci-icon-btn"
                title="Fechar Gaveta"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="sci-tabs">
              <button
                type="button"
                onClick={() => setDrawerTab('search')}
                className={`sci-tab-btn ${drawerTab === 'search' ? 'active' : ''}`}
              >
                Consultar Acervo
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('citations')}
                className={`sci-tab-btn ${drawerTab === 'citations' ? 'active' : ''}`}
              >
                Referências Citadas ({activeArticle.citations_count || 0})
              </button>
            </div>

            {/* Tab: Consultar Acervo */}
            {drawerTab === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Filtrar papers, PDFs ou notas..."
                      value={drawerSearch}
                      onChange={e => setDrawerSearch(e.target.value)}
                      className="sci-input"
                      style={{ paddingLeft: 26 }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                  {/* References Section */}
                  <div style={{ marginBottom: 16 }}>
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Papers & Referências ({filteredReferences.length})
                    </h5>
                    <div>
                      {filteredReferences.map(ref => (
                        <div key={ref.id} className="sci-ref-card">
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                            <span className="sci-ref-title">
                              {ref.title}
                            </span>
                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              {ref.file_type}
                            </span>
                          </div>
                          <p className="sci-ref-authors">
                            {ref.authors ? `${ref.authors} (${ref.year || 's.d.'})` : 'Autor desconhecido'}
                          </p>

                          {/* Quick Insert Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                            <button
                              type="button"
                              onClick={() => handleAddCitationFromReference(ref)}
                              className="sci-btn"
                              style={{ flex: 1, padding: '3px 8px', fontSize: '0.7rem', justifyContent: 'center' }}
                              title="Insere citação inline e inclui na bibliografia"
                            >
                              + Citar (ABNT)
                            </button>
                            {onNavigateToReference && (
                              <button
                                type="button"
                                onClick={() => onNavigateToReference(ref.id)}
                                className="sci-icon-btn"
                                title="Abrir referência no visualizador"
                              >
                                <ExternalLink size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {filteredReferences.length === 0 && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: 4 }}>
                          Nenhuma referência encontrada.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div>
                    <h5 style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>
                      Notas do Acervo ({filteredNotes.length})
                    </h5>
                    <div>
                      {filteredNotes.slice(0, 10).map(note => (
                        <div key={note.id} className="sci-ref-card">
                          <span className="sci-ref-title">
                            {note.title}
                          </span>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.content.replace(/<[^>]+>/g, '').slice(0, 75)}...
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                            <button
                              type="button"
                              onClick={() => handleAddCitationFromNote(note)}
                              className="sci-btn"
                              style={{ flex: 1, padding: '3px 8px', fontSize: '0.7rem', justifyContent: 'center' }}
                              title="Insere Wikilink e vincula à bibliografia"
                            >
                              + Inserir [[Wikilink]]
                            </button>
                            {onNavigateToNote && (
                              <button
                                type="button"
                                onClick={() => onNavigateToNote(note.id)}
                                className="sci-icon-btn"
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
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {(activeArticle.citations || []).length > 0 ? (
                  activeArticle.citations!.map((cit, idx) => (
                    <div key={cit.id} className="sci-ref-card">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-yellow-border)', fontFamily: 'var(--font-mono)' }}>
                          [{idx + 1}] \{'{'}{cit.citation_key}{'}'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCitation(cit.id)}
                          className="sci-icon-btn"
                          style={{ padding: 2, color: 'var(--accent-red)' }}
                          title="Remover citação deste artigo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                        {cit.reference_title || cit.note_title}
                      </p>
                      {cit.reference_authors && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {cit.reference_authors} ({cit.reference_year || 's.d.'})
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
                        <button
                          type="button"
                          onClick={() => insertTextAtCursor(`\\cite{${cit.citation_key}}`)}
                          className="sci-btn"
                          style={{ padding: '2px 6px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}
                          title="Inserir \cite{key} LaTeX"
                        >
                          + \cite
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const author = cit.reference_authors?.split(',')[0] || 'AUTOR';
                            insertTextAtCursor(` (${author.toUpperCase()}, ${cit.reference_year || ''})`);
                          }}
                          className="sci-btn"
                          style={{ padding: '2px 6px', fontSize: '0.68rem' }}
                          title="Inserir (AUTOR, Ano) ABNT"
                        >
                          + (Autor, Ano)
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Nenhuma referência vinculada a este artigo ainda. Vá até a aba "Consultar Acervo" e clique em "+ Citar".
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Export & Compilation Modal (RF-31) */}
      {isExportModalOpen && activeArticle && (
        <div className="sci-modal-overlay">
          <div className="sci-modal-dialog">
            {/* Modal Header */}
            <div className="sci-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={18} style={{ color: 'var(--primary-yellow-border)' }} />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Compilação e Exportação Científica (RF-31)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="sci-icon-btn"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="sci-modal-body">
              {/* Formats Selection */}
              <div>
                <label className="sci-label">
                  1. Formato de Publicação
                </label>
                <div className="sci-format-grid">
                  {[
                    { id: 'pdf', label: 'PDF Acadêmico (.pdf)', desc: 'Layout com cabeçalho e páginas' },
                    { id: 'tex', label: 'LaTeX (.tex)', desc: 'Código puro para pdflatex / Overleaf' },
                    { id: 'docx', label: 'Word (.docx)', desc: 'Documento editável OpenXML' },
                    { id: 'md', label: 'Markdown (.md)', desc: 'Frontmatter YAML & Portabilidade' }
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setExportFormat(fmt.id as any)}
                      className={`sci-format-card ${exportFormat === fmt.id ? 'active' : ''}`}
                    >
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt.label}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.2 }}>{fmt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                <div>
                  <label className="sci-label">
                    Estilo de Citação
                  </label>
                  <select
                    value={exportStyle}
                    onChange={e => setExportStyle(e.target.value as any)}
                    className="sci-select"
                    style={{ width: '100%', padding: '6px 10px' }}
                  >
                    <option value="ABNT">ABNT (SOBRENOME, Ano)</option>
                    <option value="IEEE">IEEE ([1] Autor, "Título")</option>
                    <option value="APA">APA (Autor, Ano)</option>
                  </select>
                </div>

                <div>
                  <label className="sci-label">
                    Elementos Opcionais
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={includeAbstract}
                        onChange={e => setIncludeAbstract(e.target.checked)}
                      />
                      <span>Incluir Resumo & Palavras-chave</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={includeBib}
                        onChange={e => setIncludeBib(e.target.checked)}
                      />
                      <span>Incluir Lista de Referências Citadas</span>
                    </label>
                    {exportFormat === 'md' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={includeFrontmatter}
                          onChange={e => setIncludeFrontmatter(e.target.checked)}
                        />
                        <span>Incluir Metadados YAML Frontmatter</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Code Preview for Markdown / LaTeX */}
              {(exportFormat === 'md' || exportFormat === 'tex') && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="sci-label" style={{ margin: 0 }}>
                      Pré-visualização do Código Compilado
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (compilePreview) {
                          navigator.clipboard.writeText(compilePreview);
                          setCopiedPreview(true);
                          setTimeout(() => setCopiedPreview(false), 2000);
                        }
                      }}
                      className="sci-btn"
                      style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                    >
                      {copiedPreview ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedPreview ? 'Copiado!' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <pre className="sci-preview-box">
                    {compiling ? 'Compilando arquivo...' : compilePreview || 'Sem conteúdo para pré-visualização.'}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sci-modal-footer">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="sci-btn"
              >
                Cancelar
              </button>
              <a
                href={api.getArticleExportUrl(activeArticle.id, exportFormat, exportStyle)}
                download
                className="sci-btn sci-btn-primary"
                style={{ textDecoration: 'none' }}
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
