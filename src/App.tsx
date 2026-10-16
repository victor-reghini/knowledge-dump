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
import { PdfViewer } from './components/PdfViewer';
import { ArrowLeft } from 'lucide-react';

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

  // Split-View & PDF states (RF-14, RF-19)
  const [isSplitViewOpen, setIsSplitViewOpen] = useState(false);
  const [activeReference, setActiveReference] = useState<ReferenceFile | null>(null);
  const [pdfInitialPage, setPdfInitialPage] = useState<number>(1);
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
      setCategories(cats);
      setFolders(flds);
      setBookmarks(bms);
      setNotes(nts);
      setReferences(refs);
      if (refs.length > 0 && !activeReference) {
        setActiveReference(refs[0]);
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
  };

  const handleSelectCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
    setSelectedFolderId(null);
    setActiveNoteId(null);
  };

  const handleViewAllNotes = () => {
    setSelectedCategoryId(null);
    setSelectedFolderId(null);
    setActiveNoteId(null);
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

  // References & PDF Handlers
  const handleSelectReference = (ref: ReferenceFile) => {
    setActiveReference(ref);
    setIsSplitViewOpen(true);
    setPdfInitialPage(1);
    setPdfHighlightText(undefined);
  };

  const handleUploadPdf = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^.]+$/, ''));
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

  // Deep-link from note or citation card into PDF Viewer (RF-19 & Cenário 2)
  const handleOpenPdfDeepLink = (referenceId: string, pageNumber: number, highlightText?: string) => {
    const targetRef = references.find((r) => r.id === referenceId) || activeReference || references[0];
    if (targetRef) {
      setActiveReference(targetRef);
      setPdfInitialPage(pageNumber);
      setPdfHighlightText(highlightText);
      setIsSplitViewOpen(true);
    }
  };

  // Citation from PDF into active note (RF-19 & Cenário 2)
  const handleCiteFromPdf = async (citation: {
    quoteText: string;
    pageNumber: number;
    referenceId: string;
    referenceTitle: string;
  }) => {
    const citationMarkdown = `\n\n> "${citation.quoteText}"\n> — [${citation.referenceTitle} (p. ${citation.pageNumber})](pdf://${citation.referenceId}?page=${citation.pageNumber})\n`;

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
        anchor_data: `p=${citation.pageNumber}`
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
      anchor_data: `p=${citation.pageNumber}`
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

  // Create Note
  const handleCreateNote = async () => {
    try {
      const newNote = await api.createNote({
        title: 'Nova Anotação',
        content: '# Nova Anotação\n\nComece a escrever seu conhecimento aqui...',
        category_id: selectedCategoryId || undefined,
        folder_id: selectedFolderId || undefined
      });
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
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
        onSelectNote={setActiveNoteId}
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
        onSelectReference={handleSelectReference}
        onUploadPdf={handleUploadPdf}
        onDeleteReference={handleDeleteReference}
      />

      <div className="main-wrapper">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          notesCount={notes.length}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
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
              <div className="split-view-main">
                {activeNote ? (
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
                        onClick={() => setActiveNoteId(null)}
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
                ) : (
                  /* Directory View (RF-04: List or Grid view) */
                  <NotesDirectoryView
                    title={directoryTitle}
                    notes={filteredNotes}
                    currentFolder={currentFolder}
                    currentCategory={currentCategory}
                    onSelectNote={setActiveNoteId}
                    onNewNote={handleCreateNote}
                    onOpenShareModal={(note) => setShareModalNote(note)}
                  />
                )}
              </div>

              {/* Side PDF Viewer Panel (Split-View) */}
              {isSplitViewOpen && activeReference && (
                <div className="split-view-side">
                  <PdfViewer
                    reference={activeReference}
                    initialPage={pdfInitialPage}
                    highlightText={pdfHighlightText}
                    onCite={handleCiteFromPdf}
                    onClose={() => setIsSplitViewOpen(false)}
                  />
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
