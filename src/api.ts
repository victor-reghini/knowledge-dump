import { Note, Folder, Category, Tag, Bookmark, SearchResult, User, ReferenceFile, Citation } from './types';

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
    if (!res.ok) {
      console.warn('Falha ao obter categorias:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async createCategory(data: { name: string; color?: string; icon?: string; parent_id?: string | null } | string, color?: string): Promise<Category> {
    const payload = typeof data === 'string' ? { name: data, color } : data;
    const res = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async updateCategory(id: string, data: { name?: string; color?: string; icon?: string; parent_id?: string | null }): Promise<Category> {
    const res = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteCategory(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async getFolders(): Promise<Folder[]> {
    const res = await fetch(`${BASE_URL}/folders`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      console.warn('Falha ao obter pastas:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async createFolder(name: string, parent_id?: string | null): Promise<Folder> {
    const res = await fetch(`${BASE_URL}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ name, parent_id })
    });
    return res.json();
  },

  async updateFolder(id: string, data: { name?: string; parent_id?: string | null }): Promise<Folder> {
    const res = await fetch(`${BASE_URL}/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteFolder(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/folders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
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
    if (!res.ok) {
      console.warn('Falha ao obter notas:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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
    if (!res.ok) {
      console.warn('Falha ao obter favoritos:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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

  // References & PDFs (RF-14, RNF-03, RN-02)
  async getReferences(): Promise<ReferenceFile[]> {
    const res = await fetch(`${BASE_URL}/references`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      console.warn('Falha ao obter referências:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getReference(id: string): Promise<ReferenceFile> {
    const res = await fetch(`${BASE_URL}/references/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Referência não encontrada');
    return res.json();
  },

  getReferenceFileUrl(id: string): string {
    return `${BASE_URL}/references/${id}/file`;
  },

  async getReferenceContent(id: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/references/${id}/content`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao obter conteúdo da referência');
    return res.json();
  },

  async updateReferenceContent(id: string, data: { text: string }): Promise<{ success: boolean; id: string; file_type: string }> {
    const res = await fetch(`${BASE_URL}/references/${id}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao salvar conteúdo da referência');
    }
    return res.json();
  },

  async createReference(data: FormData | { title: string; authors?: string; year?: number; doi?: string; file_base64?: string; filename?: string }): Promise<ReferenceFile> {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    const res = await fetch(`${BASE_URL}/references`, {
      method: 'POST',
      headers: isFormData ? getAuthHeaders() : { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: isFormData ? data : JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao importar referência');
    }
    return res.json();
  },

  async updateReference(id: string, data: Partial<ReferenceFile>): Promise<ReferenceFile> {
    const res = await fetch(`${BASE_URL}/references/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao atualizar referência');
    }
    return res.json();
  },

  async deleteReference(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/references/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Citations (RF-19)
  async getCitations(noteId?: string): Promise<Citation[]> {
    const query = noteId ? `?note_id=${encodeURIComponent(noteId)}` : '';
    const res = await fetch(`${BASE_URL}/citations${query}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      console.warn('Falha ao obter citações:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async createCitation(data: { note_id: string; reference_id: string; quote_text: string; page_number?: number; anchor_data?: string }): Promise<Citation> {
    const res = await fetch(`${BASE_URL}/citations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao salvar citação');
    return res.json();
  },

  async deleteCitation(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/citations/${id}`, {
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
    if (!res.ok) {
      console.warn('Falha na busca:', res.status);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }
};
