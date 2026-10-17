import React, { useState, useEffect, useCallback } from 'react';
import { Note, Folder, Category, Bookmark, User, ReferenceFile } from './types';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NoteEditor } from './components/NoteEditor';
import { NotesDirectoryView } from './components/NotesDirectoryView';
import { SearchModal } from './components/SearchModal';
import { ShareModal } from './components/ShareModal';
import { AuthModal } from './components/AuthModal';
import { PublicNoteView } from './components/PublicNoteView';
import { ReferenceViewer } from './components/ReferenceViewer';
import { GraphView } from './components/GraphView';
import { ArrowLeft, Columns, X, FileText } from 'lucide-react';

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [references, setReferences] = useState<ReferenceFile[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [shareModalNote, setShareModalNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  // View and Split-View states (Individual reference viewing & Dual Split View)
  const [mainViewMode, setMainViewMode] = useState<'directory' | 'note' | 'reference' | 'graph'>('directory');
  const [isSplitViewOpen, setIsSplitViewOpen] = useState(false);
  const [splitPaneMode, setSplitPaneMode] = useState<'reference' | 'note'>('reference');
  const [splitSecondaryNoteId, setSplitSecondaryNoteId] = useState<string | null>(null);
  const [splitSecondaryNote, setSplitSecondaryNote] = useState<Note | null>(null);

  const [activeReference, setActiveReference] = useState<ReferenceFile | null>(null);
  const [pdfInitialPage, setPdfInitialPage] = useState<number>(1);
  const [initialParagraph, setInitialParagraph] = useState<number | undefined>();
  const [initialLine, setInitialLine] = useState<number | undefined>();
  const [initialTimestamp, setInitialTimestamp] = useState<number | undefined>();
  const [pdfHighlightText, setPdfHighlightText] = useState<string | undefined>(undefined);

  // User state (RF-36)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('kd_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return { id: 'user-admin', username: 'admin', name: 'Pesquisador' };
  });

  // Theme state: DEFAULT TO LIGHT THEME
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('kd_theme');
    return (saved as 'dark' | 'light') || 'light';
  });

  // Public Share URL hash navigation (e.g. #/shared/share-123)
  const [sharedToken, setSharedToken] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/shared/')) {
      return hash.replace('#/shared/', '');
    }
    return null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/shared/')) {
        setSharedToken(hash.replace('#/shared/', ''));
      } else {
        setSharedToken(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kd_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Load data for active user
  const loadData = useCallback(async () => {
    try {
      const [cats, flds, bms, nts, refs] = await Promise.all([
        api.getCategories(),
        api.getFolders(),
        api.getBookmarks(),
        api.getNotes(),
        api.getReferences()
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setFolders(Array.isArray(flds) ? flds : []);
      setBookmarks(Array.isArray(bms) ? bms : []);
      setNotes(Array.isArray(nts) ? nts : []);
      const validRefs = Array.isArray(refs) ? refs : [];
      setReferences(validRefs);
      if (validRefs.length > 0 && !activeReference) {
        setActiveReference(validRefs[0]);
      }
    } catch (err) {
      console.error('Falha ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [activeReference]);

  useEffect(() => {
    loadData();
  }, [loadData, currentUser]);

  // Load active note details
  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null);
      return;
    }
    api
      .getNote(activeNoteId)
      .then((data) => setActiveNote(data))
      .catch((err) => console.error('Erro ao abrir nota:', err));
  }, [activeNoteId]);

  // Load secondary note in split-view
  useEffect(() => {
    if (!splitSecondaryNoteId) {
      setSplitSecondaryNote(null);
      return;
    }
    api
      .getNote(splitSecondaryNoteId)
      .then((data) => setSplitSecondaryNote(data))
      .catch((err) => console.error('Erro ao abrir nota secundária:', err));
  }, [splitSecondaryNoteId]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers for Folder & Category selection
  const handleSelectFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    setSelectedCategoryId(null);
    setActiveNoteId(null);
    setMainViewMode('directory');
  };

  const handleSelectCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setSelectedFolderId(null);
    setActiveNoteId(null);
    setMainViewMode('directory');
  };

  const handleViewAllNotes = () => {
    setSelectedCategoryId(null);
    setSelectedFolderId(null);
    setActiveNoteId(null);
    setMainViewMode('directory');
  };

  const handleSelectNote = (id: string) => {
    setActiveNoteId(id);
    setMainViewMode('note');
  };

  // Folder management
  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    try {
      await api.createFolder(name, parentId);
      const updated = await api.getFolders();
      setFolders(updated);
    } catch (err) {
      console.error('Erro ao criar pasta:', err);
    }
  };

  const handleUpdateFolder = async (id: string, data: { name?: string; parent_id?: string | null }) => {
    try {
      await api.updateFolder(id, data);
      const [updatedFolders, updatedNotes] = await Promise.all([api.getFolders(), api.getNotes()]);
      setFolders(updatedFolders);
      setNotes(updatedNotes);
      if (activeNote) {
        const refreshed = await api.getNote(activeNote.id);
        setActiveNote(refreshed);
      }
    } catch (err) {
      console.error('Erro ao atualizar pasta:', err);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api.deleteFolder(id);
      const [updatedFolders, updatedNotes] = await Promise.all([api.getFolders(), api.getNotes()]);
      setFolders(updatedFolders);
      setNotes(updatedNotes);
      if (selectedFolderId === id) setSelectedFolderId(null);
    } catch (err) {
      console.error('Erro ao excluir pasta:', err);
    }
  };

  // Category management (Criação, Edição, Mover, Remoção)
  const handleCreateCategory = async (data: { name: string; color?: string; parent_id?: string | null }) => {
    try {
      await api.createCategory(data);
      const updated = await api.getCategories();
      setCategories(updated);
    } catch (err) {
      console.error('Erro ao criar categoria:', err);
    }
  };

  const handleUpdateCategory = async (id: string, data: { name?: string; color?: string; parent_id?: string | null }) => {
    try {
      await api.updateCategory(id, data);
      const [updatedCats, updatedNotes] = await Promise.all([api.getCategories(), api.getNotes()]);
      setCategories(updatedCats);
      setNotes(updatedNotes);
      if (activeNote) {
        const refreshed = await api.getNote(activeNote.id);
        setActiveNote(refreshed);
      }
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.deleteCategory(id);
      const [updatedCats, updatedNotes] = await Promise.all([api.getCategories(), api.getNotes()]);
      setCategories(updatedCats);
      setNotes(updatedNotes);
      if (selectedCategoryId === id) setSelectedCategoryId(null);
      if (activeNote) {
        const refreshed = await api.getNote(activeNote.id);
        setActiveNote(refreshed);
      }
    } catch (err) {
      console.error('Erro ao excluir categoria:', err);
    }
  };

  // References & Document Handlers (Stand-alone individual viewer or Split View)
  const handleSelectReference = (ref: ReferenceFile, openInSplit: boolean = false) => {
    setActiveReference(ref);
    setPdfInitialPage(1);
    setPdfHighlightText(undefined);
    if (openInSplit || (isSplitViewOpen && mainViewMode === 'note')) {
      setIsSplitViewOpen(true);
      setSplitPaneMode('reference');
    } else {
      setMainViewMode('reference');
    }
  };

  const handleUploadPdf = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^.]+$/, ''));
      if (selectedFolderId) {
        formData.append('folder_id', selectedFolderId);
      }
      if (selectedCategoryId) {
        formData.append('category_id', selectedCategoryId);
      }
      const newRef = await api.createReference(formData);
      const updatedRefs = await api.getReferences();
      setReferences(updatedRefs);
      setActiveReference(newRef);
      setIsSplitViewOpen(true);
      setPdfInitialPage(1);
    } catch (err) {
      console.error('Erro ao enviar PDF:', err);
      alert('Erro ao enviar PDF: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleUpdateReference = async (id: string, data: Partial<ReferenceFile>) => {
    try {
      await api.updateReference(id, data);
      const updatedRefs = await api.getReferences();
      setReferences(updatedRefs);
      if (activeReference?.id === id) {
        const found = updatedRefs.find((r) => r.id === id);
        if (found) setActiveReference(found);
      }
    } catch (err) {
      console.error('Erro ao atualizar referência:', err);
    }
  };

  const handleDeleteReference = async (id: string) => {
    try {
      await api.deleteReference(id);
      const updatedRefs = await api.getReferences();
      setReferences(updatedRefs);
      if (activeReference?.id === id) {
        setActiveReference(updatedRefs[0] || null);
        if (updatedRefs.length === 0) setIsSplitViewOpen(false);
      }
    } catch (err) {
      console.error('Erro ao excluir referência:', err);
    }
  };

  // Deep-link from note or citation card into Document Viewer (RF-19 & RF-20)
  const handleOpenPdfDeepLink = (
    referenceId: string,
    pageNumber: number,
    highlightText?: string,
    anchorData?: string
  ) => {
    const targetRef = references.find((r) => r.id === referenceId) || activeReference || references[0];
    if (targetRef) {
      setActiveReference(targetRef);
      setPdfHighlightText(highlightText);

      const type = targetRef.file_type?.toLowerCase() || '';
      if (anchorData?.startsWith('t=') || type === 'video' || type === 'audio') {
        const secs = anchorData?.startsWith('t=') ? parseInt(anchorData.replace('t=', ''), 10) : pageNumber;
        setInitialTimestamp(secs);
      } else if (anchorData?.startsWith('slide=') || type === 'pptx') {
        const slide = anchorData?.startsWith('slide=') ? parseInt(anchorData.replace('slide=', ''), 10) : pageNumber;
        setPdfInitialPage(slide);
      } else if (anchorData?.startsWith('line=') || type === 'tex' || type === 'txt' || type === 'md') {
        const line = anchorData?.startsWith('line=') ? parseInt(anchorData.replace('line=', ''), 10) : pageNumber;
        setInitialLine(line);
      } else if (anchorData?.startsWith('p=') || type === 'docx') {
        const p = anchorData?.startsWith('p=') ? parseInt(anchorData.replace('p=', ''), 10) : pageNumber;
        setInitialParagraph(p);
      } else {
        setPdfInitialPage(pageNumber || 1);
      }

      setIsSplitViewOpen(true);
    }
  };

  // Citation from Document Viewer into active note (RF-19 & RF-20)
  const handleCiteFromPdf = async (citation: {
    quoteText: string;
    pageNumber: number;
    referenceId: string;
    referenceTitle: string;
    anchorData?: string;
  }) => {
    const ref = references.find((r) => r.id === citation.referenceId);
    const type = ref?.file_type?.toLowerCase() || 'pdf';

    let protocol = 'pdf';
    let paramStr = `page=${citation.pageNumber}`;
    let label = `p. ${citation.pageNumber}`;

    if (citation.anchorData?.startsWith('t=') || type === 'video' || type === 'audio') {
      protocol = 'media';
      const secs = citation.anchorData?.replace('t=', '') || citation.pageNumber;
      paramStr = `t=${secs}`;
      const m = Math.floor(Number(secs) / 60);
      const s = Math.floor(Number(secs) % 60);
      label = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else if (citation.anchorData?.startsWith('slide=') || type === 'pptx') {
      protocol = 'pptx';
      const slide = citation.anchorData?.replace('slide=', '') || citation.pageNumber;
      paramStr = `slide=${slide}`;
      label = `slide ${slide}`;
    } else if (citation.anchorData?.startsWith('line=') || type === 'tex' || type === 'txt' || type === 'md') {
      protocol = type === 'tex' ? 'tex' : (type === 'md' ? 'md' : 'txt');
      const line = citation.anchorData?.replace('line=', '') || citation.pageNumber;
      paramStr = `line=${line}`;
      label = `linha ${line}`;
    } else if (citation.anchorData?.startsWith('p=') || type === 'docx') {
      protocol = 'docx';
      const p = citation.anchorData?.replace('p=', '') || citation.pageNumber;
      paramStr = `p=${p}`;
      label = `parágrafo ${p}`;
    }

    const citationMarkdown = `\n\n> "${citation.quoteText}"\n> — [${citation.referenceTitle} (${label})](${protocol}://${citation.referenceId}?${paramStr})\n`;
    const anchorVal = citation.anchorData || `p=${citation.pageNumber}`;

    if (!activeNote) {
      const newNote = await api.createNote({
        title: `Citação: ${citation.referenceTitle.slice(0, 35)}`,
        content: `# Citação de ${citation.referenceTitle}${citationMarkdown}`
      });
      await api.createCitation({
        note_id: newNote.id,
        reference_id: citation.referenceId,
        quote_text: citation.quoteText,
        page_number: citation.pageNumber,
        anchor_data: anchorVal
      });
      await loadData();
      setActiveNoteId(newNote.id);
      return;
    }

    // Save citation relation in database
    await api.createCitation({
      note_id: activeNote.id,
      reference_id: citation.referenceId,
      quote_text: citation.quoteText,
      page_number: citation.pageNumber,
      anchor_data: anchorVal
    });

    const updatedContent = activeNote.content + citationMarkdown;
    await handleSaveNote(activeNote.id, { content: updatedContent });

    const refreshed = await api.getNote(activeNote.id);
    setActiveNote(refreshed);
  };

  const handleDeleteCitation = async (id: string) => {
    try {
      await api.deleteCitation(id);
      if (activeNote) {
        const refreshed = await api.getNote(activeNote.id);
        setActiveNote(refreshed);
      }
    } catch (err) {
      console.error('Erro ao excluir citação:', err);
    }
  };

  // Create Note with chosen file_type ('docx' default or 'md')
  const handleCreateNote = async (fileType: 'docx' | 'md' = 'docx') => {
    try {
      const isMd = fileType === 'md';
      const defaultContent = isMd
        ? '# Nova Anotação\n\nComece a escrever seu conhecimento em Markdown aqui...'
        : '<p>Comece a escrever seu documento aqui...</p>';

      const newNote = await api.createNote({
        title: isMd ? 'Nova Anotação Markdown' : 'Novo Documento Word',
        content: defaultContent,
        category_id: selectedCategoryId || undefined,
        folder_id: selectedFolderId || undefined,
        file_type: fileType
      });
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      setMainViewMode('note');
    } catch (err) {
      console.error('Erro ao criar nota:', err);
    }
  };

  // Save Note
  const handleSaveNote = async (id: string, updates: Partial<Note>) => {
    try {
      const updated = await api.updateNote(id, updates);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updated } : n)));
      if (activeNote && activeNote.id === id) {
        setActiveNote((prev) => (prev ? { ...prev, ...updated } : null));
      }
    } catch (err) {
      console.error('Erro ao salvar nota:', err);
    }
  };

  // Delete Note
  const handleDeleteNote = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta nota?')) return;
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveNoteId(null);
    } catch (err) {
      console.error('Erro ao excluir nota:', err);
    }
  };

  // Navigate to note by title & anchor
  const handleNavigateToNoteTitle = async (title: string, anchor?: string) => {
    const found = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (found) {
      setActiveNoteId(found.id);
      if (anchor) {
        setTimeout(() => {
          const el = document.getElementById(anchor);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } else {
      const confirmed = confirm(
        `A nota "[[${title}]]" ainda não existe. Deseja criá-la agora com 1 clique?`
      );
      if (confirmed) {
        const created = await api.createNote({
          title,
          content: `# ${title}\n\nNota criada automaticamente a partir de um Wikilink.`
        });
        setNotes((prev) => [created, ...prev]);
        setActiveNoteId(created.id);
      }
    }
  };

  // Add Bookmark (RF-05)
  const handleAddBookmark = async (noteId: string, title: string, comment?: string) => {
    try {
      const bm = await api.createBookmark({
        note_id: noteId,
        title,
        comment
      });
      setBookmarks((prev) => [bm, ...prev]);
      if (activeNote && activeNote.id === noteId) {
        setActiveNote((prev) =>
          prev ? { ...prev, bookmarks: [bm, ...(prev.bookmarks || [])] } : null
        );
      }
    } catch (err) {
      console.error('Erro ao adicionar marcador:', err);
    }
  };

  // Update note after sharing
  const handleNoteShareUpdated = (noteId: string, updates: Partial<Note>) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...updates } : n)));
    if (activeNote && activeNote.id === noteId) {
      setActiveNote((prev) => (prev ? { ...prev, ...updates } : null));
    }
    if (shareModalNote && shareModalNote.id === noteId) {
      setShareModalNote((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  // Public View route
  if (sharedToken) {
    return (
      <PublicNoteView
        shareToken={sharedToken}
        onBackToApp={() => {
          window.location.hash = '';
          setSharedToken(null);
        }}
        onNavigateToToken={(token) => {
          window.location.hash = `#/shared/${token}`;
          setSharedToken(token);
        }}
      />
    );
  }

  // Filter notes for current folder/category
  const filteredNotes = notes.filter((n) => {
    if (selectedCategoryId && n.category_id !== selectedCategoryId) return false;
    if (selectedFolderId && n.folder_id !== selectedFolderId) return false;
    return true;
  });

  const currentCategory = categories.find((c) => c.id === selectedCategoryId);
  const currentFolder = folders.find((f) => f.id === selectedFolderId);

  const directoryTitle = currentCategory
    ? `Categoria: ${currentCategory.name}`
    : currentFolder
    ? `Pasta: ${currentFolder.name}`
    : 'Todas as Anotações';

  return (
    <div className="app-container">
      <Sidebar
        notes={filteredNotes}
        allNotes={notes}
        folders={folders}
        categories={categories}
        bookmarks={bookmarks}
        references={references}
        activeNoteId={activeNoteId}
        activeReferenceId={activeReference?.id}
        onSelectNote={handleSelectNote}
        onNewNote={handleCreateNote}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleSelectFolder}
        onViewAllNotes={handleViewAllNotes}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onSelectReference={(ref) => handleSelectReference(ref, false)}
        onUploadPdf={handleUploadPdf}
        onDeleteReference={handleDeleteReference}
        onOpenGraph={() => setMainViewMode('graph')}
        isGraphOpen={mainViewMode === 'graph'}
      />

      <div className="main-wrapper">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          notesCount={notes.length}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          isGraphOpen={mainViewMode === 'graph'}
          onToggleGraph={() => setMainViewMode((prev) => (prev === 'graph' ? 'directory' : 'graph'))}
          isSplitViewOpen={isSplitViewOpen}
          onToggleSplitView={() => {
            if (!isSplitViewOpen && !activeReference && references.length > 0) {
              setActiveReference(references[0]);
            }
            setIsSplitViewOpen((prev) => !prev);
          }}
        />

        <div className="content-area">
          {loading ? (
            <div className="empty-state">
              <p>Carregando repositório de conhecimento...</p>
            </div>
          ) : (
            <div className={`split-view-container ${isSplitViewOpen ? 'split-active' : ''}`}>
              {/* Main Content Area: Note, Standalone Reference, Graph, or Directory */}
              <div className="split-view-main">
                {mainViewMode === 'note' && activeNote ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {/* Back to directory view breadcrumb */}
                    <div
                      style={{
                        padding: '10px 40px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.82rem'
                      }}
                    >
                      <button
                        className="toolbar-btn"
                        onClick={() => {
                          setActiveNoteId(null);
                          setMainViewMode('directory');
                        }}
                        style={{ padding: '3px 8px' }}
                      >
                        <ArrowLeft size={14} />
                        <span>Voltar para {directoryTitle}</span>
                      </button>
                    </div>

                    <NoteEditor
                      note={activeNote}
                      categories={categories}
                      folders={folders}
                      allNotes={notes}
                      onSave={handleSaveNote}
                      onDelete={handleDeleteNote}
                      onNavigateToNoteTitle={handleNavigateToNoteTitle}
                      onAddBookmark={handleAddBookmark}
                      onOpenShare={(note) => setShareModalNote(note)}
                      onOpenPdfDeepLink={handleOpenPdfDeepLink}
                      onToggleSplitView={() => setIsSplitViewOpen((prev) => !prev)}
                      isSplitViewOpen={isSplitViewOpen}
                      onDeleteCitation={handleDeleteCitation}
                    />
                  </div>
                ) : mainViewMode === 'reference' && activeReference ? (
                  /* Standalone Individual Reference Viewer (No split screen required) */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <div
                      style={{
                        padding: '8px 24px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="toolbar-btn"
                          onClick={() => setMainViewMode('directory')}
                          style={{ padding: '3px 8px' }}
                        >
                          <ArrowLeft size={14} />
                          <span>Voltar para {directoryTitle}</span>
                        </button>
                        <span style={{ fontWeight: 600 }}>{activeReference.title}</span>
                        <span className="badge" style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}>
                          {activeReference.file_type}
                        </span>
                      </div>

                      <button
                        className={`toolbar-btn ${isSplitViewOpen ? 'active' : ''}`}
                        onClick={() => setIsSplitViewOpen((prev) => !prev)}
                        title="Dividir tela com outra nota ou referência"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Columns size={14} />
                        <span>{isSplitViewOpen ? 'Fechar Split' : 'Dividir Tela'}</span>
                      </button>
                    </div>

                    <div style={{ flex: 1, height: 'calc(100% - 45px)', overflow: 'hidden' }}>
                      <ReferenceViewer
                        reference={activeReference}
                        initialPage={pdfInitialPage}
                        initialParagraph={initialParagraph}
                        initialLine={initialLine}
                        initialTimestamp={initialTimestamp}
                        highlightText={pdfHighlightText}
                        onCite={handleCiteFromPdf}
                        onClose={() => setMainViewMode('directory')}
                      />
                    </div>
                  </div>
                ) : mainViewMode === 'graph' ? (
                  /* Interactive Knowledge Graph View (RF-32, RF-33) */
                  <GraphView
                    categories={categories}
                    folders={folders}
                    onSelectNote={(noteId) => {
                      handleSelectNote(noteId);
                    }}
                    onSelectReference={(refId) => {
                      const ref = references.find((r) => r.id === refId);
                      if (ref) {
                        handleSelectReference(ref, false);
                      }
                    }}
                    onClose={() => setMainViewMode('directory')}
                  />
                ) : (
                  /* Directory View (List or Grid view with Notes & References) */
                  <NotesDirectoryView
                    title={directoryTitle}
                    notes={filteredNotes}
                    references={references}
                    folders={folders}
                    categories={categories}
                    currentFolder={currentFolder}
                    currentCategory={currentCategory}
                    onSelectNote={handleSelectNote}
                    onSelectReference={(ref) => handleSelectReference(ref, false)}
                    onUpdateReference={handleUpdateReference}
                    onNewNote={handleCreateNote}
                    onOpenShareModal={(note) => setShareModalNote(note)}
                  />
                )}
              </div>

              {/* Side Panel (Split-View: Reference or Another Note side-by-side) */}
              {isSplitViewOpen && (
                <div className="split-view-side">
                  <div className="split-view-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="split-mode-toggle">
                        <button
                          type="button"
                          className={`split-mode-btn ${splitPaneMode === 'reference' ? 'active' : ''}`}
                          onClick={() => setSplitPaneMode('reference')}
                        >
                          Referência
                        </button>
                        <button
                          type="button"
                          className={`split-mode-btn ${splitPaneMode === 'note' ? 'active' : ''}`}
                          onClick={() => {
                            setSplitPaneMode('note');
                            if (!splitSecondaryNoteId && notes.length > 0) {
                              const other = notes.find((n) => n.id !== activeNoteId) || notes[0];
                              if (other) setSplitSecondaryNoteId(other.id);
                            }
                          }}
                        >
                          Outra Nota
                        </button>
                      </div>

                      {splitPaneMode === 'reference' ? (
                        <select
                          className="split-select"
                          value={activeReference?.id || ''}
                          onChange={(e) => {
                            const found = references.find((r) => r.id === e.target.value);
                            if (found) setActiveReference(found);
                          }}
                          title="Alternar arquivo de referência"
                        >
                          {references.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title} ({r.file_type.toUpperCase()})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          className="split-select"
                          value={splitSecondaryNoteId || ''}
                          onChange={(e) => setSplitSecondaryNoteId(e.target.value)}
                          title="Alternar segunda nota"
                        >
                          {notes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button
                      type="button"
                      className="toolbar-btn close-btn"
                      onClick={() => setIsSplitViewOpen(false)}
                      title="Fechar tela dividida"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="split-view-content">
                    {splitPaneMode === 'reference' && activeReference ? (
                      <ReferenceViewer
                        reference={activeReference}
                        initialPage={pdfInitialPage}
                        initialParagraph={initialParagraph}
                        initialLine={initialLine}
                        initialTimestamp={initialTimestamp}
                        highlightText={pdfHighlightText}
                        onCite={handleCiteFromPdf}
                        onClose={() => setIsSplitViewOpen(false)}
                      />
                    ) : splitPaneMode === 'note' && splitSecondaryNote ? (
                      <NoteEditor
                        note={splitSecondaryNote}
                        categories={categories}
                        folders={folders}
                        allNotes={notes}
                        onSave={handleSaveNote}
                        onDelete={handleDeleteNote}
                        onNavigateToNoteTitle={handleNavigateToNoteTitle}
                        onAddBookmark={handleAddBookmark}
                        onOpenShare={(note) => setShareModalNote(note)}
                        onOpenPdfDeepLink={handleOpenPdfDeepLink}
                        onDeleteCitation={handleDeleteCitation}
                      />
                    ) : (
                      <div className="empty-state" style={{ padding: 24 }}>
                        <p>Selecione um item para exibir neste painel dividido.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Global Search Modal (FTS5) */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(id) => {
          setActiveNoteId(id);
          setIsSearchOpen(false);
        }}
      />

      {/* Public Share Modal (RF-37) */}
      <ShareModal
        note={shareModalNote}
        isOpen={!!shareModalNote}
        onClose={() => setShareModalNote(null)}
        onUpdated={handleNoteShareUpdated}
      />

      {/* User Auth Modal (RF-36) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUserChanged={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />
    </div>
  );
};
