import React, { useState, useEffect, useCallback } from 'react';
import { Note, Folder, Category, Bookmark, User } from './types';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { NoteEditor } from './components/NoteEditor';
import { NotesDirectoryView } from './components/NotesDirectoryView';
import { SearchModal } from './components/SearchModal';
import { ShareModal } from './components/ShareModal';
import { AuthModal } from './components/AuthModal';
import { PublicNoteView } from './components/PublicNoteView';
import { ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [shareModalNote, setShareModalNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

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
      const [cats, flds, bms, nts] = await Promise.all([
        api.getCategories(),
        api.getFolders(),
        api.getBookmarks(),
        api.getNotes()
      ]);
      setCategories(cats);
      setFolders(flds);
      setBookmarks(bms);
      setNotes(nts);
    } catch (err) {
      console.error('Falha ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Handlers for Folder & Category selection (RF-04: Show directory view on click)
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

  // Navigate to note by title & anchor (RF-07, RF-08, RF-09: On-demand creation if orphan)
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
        activeNoteId={activeNoteId}
        onSelectNote={setActiveNoteId}
        onNewNote={handleCreateNote}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        selectedFolderId={selectedFolderId}
        onSelectFolder={handleSelectFolder}
        onViewAllNotes={handleViewAllNotes}
      />

      <div className="main-wrapper">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          notesCount={notes.length}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
        />

        <div className="content-area">
          {loading ? (
            <div className="empty-state">
              <p>Carregando repositório de conhecimento...</p>
            </div>
          ) : activeNote ? (
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
