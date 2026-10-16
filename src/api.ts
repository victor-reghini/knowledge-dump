import { Note, Folder, Category, Tag, Bookmark, SearchResult, User } from './types';

const BASE_URL = '/api';

function getAuthHeaders(): Record<string, string> {
  const userJson = localStorage.getItem('kd_user');
  if (userJson) {
    try {
      const user = JSON.parse(userJson) as User;
      return { 'x-user-id': user.id };
    } catch {}
  }
  return {};
}

export const api = {
  // Auth (RF-36)
  async login(username: string, password: string): Promise<{ user: User }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha no login');
    }
    return res.json();
  },

  async register(username: string, password: string, name?: string): Promise<{ user: User }> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Falha no cadastro');
    }
    return res.json();
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Public Sharing (RF-37)
  async shareNote(id: string, options: {
    is_public: boolean;
    share_include_sources?: boolean;
    share_include_related?: boolean;
  }): Promise<{ is_public: boolean; share_token: string | null; share_include_sources: boolean; share_include_related: boolean }> {
    const res = await fetch(`${BASE_URL}/notes/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(options)
    });
    if (!res.ok) throw new Error('Falha ao atualizar compartilhamento');
    return res.json();
  },

  async getPublicNote(token: string): Promise<Note> {
    const res = await fetch(`${BASE_URL}/public/notes/${token}`);
    if (!res.ok) throw new Error('Nota pública não encontrada ou link inativo');
    return res.json();
  },

  async getHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    return res.json();
  },

  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${BASE_URL}/categories`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async createCategory(name: string, color?: string): Promise<Category> {
    const res = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name, color })
    });
    return res.json();
  },

  async getFolders(): Promise<Folder[]> {
    const res = await fetch(`${BASE_URL}/folders`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async createFolder(name: string, parent_id?: string | null): Promise<Folder> {
    const res = await fetch(`${BASE_URL}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name, parent_id })
    });
    return res.json();
  },

  async getTags(): Promise<Tag[]> {
    const res = await fetch(`${BASE_URL}/tags`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async getNotes(params?: { folder_id?: string; category_id?: string }): Promise<Note[]> {
    const query = new URLSearchParams();
    if (params?.folder_id) query.set('folder_id', params.folder_id);
    if (params?.category_id) query.set('category_id', params.category_id);
    const res = await fetch(`${BASE_URL}/notes?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async getNote(id: string): Promise<Note> {
    const res = await fetch(`${BASE_URL}/notes/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Nota não encontrada');
    return res.json();
  },

  async createNote(data: { title: string; content?: string; category_id?: string; folder_id?: string; tags?: string[] }): Promise<Note> {
    const res = await fetch(`${BASE_URL}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateNote(id: string, data: Partial<Note>): Promise<Note> {
    const res = await fetch(`${BASE_URL}/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteNote(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/notes/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async getBookmarks(): Promise<Bookmark[]> {
    const res = await fetch(`${BASE_URL}/bookmarks`, {
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async createBookmark(data: { note_id?: string; title: string; comment?: string; color?: string; page_or_pos?: string }): Promise<Bookmark> {
    const res = await fetch(`${BASE_URL}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteBookmark(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/bookmarks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return [];
    const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders()
    });
    return res.json();
  }
};
