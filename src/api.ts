import {
  Note,
  Folder,
  Category,
  Tag,
  Bookmark,
  SearchResult,
  User,
  ReferenceFile,
  Citation,
  GraphData,
  StudyPlan,
  StudyTopic,
  Exercise,
  ExerciseVerifyResult,
  Simulation,
  Article,
  ArticleCitation,
  CompileOptions,
  CompileResult
} from './types';

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
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (!res.ok) return { status: 'error', notesCount: 0 };
      return await res.json();
    } catch {
      return { status: 'offline', notesCount: 0 };
    }
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

  async createNote(data: { title: string; content?: string; category_id?: string; folder_id?: string; file_type?: string; tags?: string[] }): Promise<Note> {
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

  getNoteExportUrl(id: string, format: 'docx' | 'md' = 'docx'): string {
    return `${BASE_URL}/notes/${id}/export?format=${format}`;
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
  },

  // Knowledge Graph (RF-32, RF-33)
  async getGraphData(params?: { category_id?: string; folder_id?: string; min_degree?: number }): Promise<GraphData> {
    const query = new URLSearchParams();
    if (params?.category_id) query.append('category_id', params.category_id);
    if (params?.folder_id) query.append('folder_id', params.folder_id);
    if (params?.min_degree !== undefined) query.append('min_degree', String(params.min_degree));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${BASE_URL}/graph${qs}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      console.warn('Falha ao obter dados do grafo:', res.status);
      return { nodes: [], links: [] };
    }
    return res.json();
  },

  // --- STUDY PLANS & TOPICS (RF-22, RF-23) ---
  async getStudyPlans(): Promise<StudyPlan[]> {
    const res = await fetch(`${BASE_URL}/study-plans`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json();
  },

  async createStudyPlan(data: { title: string; description?: string; target_date?: string }): Promise<StudyPlan> {
    const res = await fetch(`${BASE_URL}/study-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao criar plano de estudos');
    return res.json();
  },

  async updateStudyPlan(id: string, data: Partial<StudyPlan>): Promise<StudyPlan> {
    const res = await fetch(`${BASE_URL}/study-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar plano de estudos');
    return res.json();
  },

  async deleteStudyPlan(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/study-plans/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async addStudyTopic(planId: string, data: {
    title: string;
    order_index?: number;
    estimated_hours?: number;
    due_date?: string;
    notes_ids?: string[];
    references_ids?: string[];
  }): Promise<StudyTopic> {
    const res = await fetch(`${BASE_URL}/study-plans/${planId}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao adicionar tópico de estudos');
    return res.json();
  },

  async updateStudyTopic(id: string, data: Partial<StudyTopic>): Promise<StudyTopic> {
    const res = await fetch(`${BASE_URL}/study-topics/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar tópico de estudos');
    return res.json();
  },

  async deleteStudyTopic(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/study-topics/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // --- EXERCISES (RF-24 & BDD Cenário 3) ---
  async getExercises(params?: { topic_id?: string; note_id?: string }): Promise<Exercise[]> {
    const query = new URLSearchParams();
    if (params?.topic_id) query.append('topic_id', params.topic_id);
    if (params?.note_id) query.append('note_id', params.note_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${BASE_URL}/exercises${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json();
  },

  async createExercise(data: {
    topic_id?: string;
    note_id?: string;
    reference_id?: string;
    question: string;
    type?: string;
    options?: string[];
    correct_answer: string;
    explanation: string;
    difficulty?: string;
  }): Promise<Exercise> {
    const res = await fetch(`${BASE_URL}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao cadastrar exercício');
    return res.json();
  },

  async updateExercise(id: string, data: Partial<Exercise>): Promise<Exercise> {
    const res = await fetch(`${BASE_URL}/exercises/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar exercício');
    return res.json();
  },

  async deleteExercise(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/exercises/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  async verifyExercise(id: string, answer: string): Promise<ExerciseVerifyResult> {
    const res = await fetch(`${BASE_URL}/exercises/${id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ answer })
    });
    if (!res.ok) throw new Error('Falha ao verificar exercício');
    return res.json();
  },

  // --- SIMULATIONS (RF-25) ---
  async getSimulations(): Promise<Simulation[]> {
    const res = await fetch(`${BASE_URL}/simulations`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json();
  },

  async createSimulation(data: {
    title: string;
    plan_id?: string;
    topic_ids?: string[];
    duration_minutes?: number;
    exercise_ids?: string[];
  }): Promise<Simulation & { questions: any[] }> {
    const res = await fetch(`${BASE_URL}/simulations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao iniciar simulado');
    return res.json();
  },

  async finishSimulation(id: string, answers: Array<{ exercise_id: string; selected_answer: string; time_spent_seconds?: number }>): Promise<Simulation & { review_recommendations: any[] }> {
    const res = await fetch(`${BASE_URL}/simulations/${id}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ answers })
    });
    if (!res.ok) throw new Error('Falha ao concluir simulado');
    return res.json();
  },

  // --- SCIENTIFIC ARTICLES & EXPORT (RF-30 & RF-31) ---
  async getArticles(status?: string, search?: string): Promise<Article[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${BASE_URL}/articles${qs}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json();
  },

  async getArticle(id: string): Promise<Article> {
    const res = await fetch(`${BASE_URL}/articles/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar artigo');
    return res.json();
  },

  async createArticle(data: {
    title: string;
    subtitle?: string;
    abstract?: string;
    content?: string;
    keywords?: string[];
    status?: string;
    target_venue?: string;
  }): Promise<Article> {
    const res = await fetch(`${BASE_URL}/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao criar artigo');
    return res.json();
  },

  async updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const res = await fetch(`${BASE_URL}/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao atualizar artigo');
    return res.json();
  },

  async deleteArticle(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/articles/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao excluir artigo');
    return res.json();
  },

  async addArticleCitation(articleId: string, data: {
    reference_id?: string;
    note_id?: string;
    citation_key?: string;
    formatted_text?: string;
    page_number?: number;
  }): Promise<ArticleCitation> {
    const res = await fetch(`${BASE_URL}/articles/${articleId}/citations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Falha ao adicionar citação');
    return res.json();
  },

  async deleteArticleCitation(articleId: string, citationId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/articles/${articleId}/citations/${citationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Falha ao remover citação');
    return res.json();
  },

  getArticleExportUrl(id: string, format: 'md' | 'tex' | 'docx' | 'pdf', style: 'ABNT' | 'APA' | 'IEEE' = 'ABNT'): string {
    return `${BASE_URL}/articles/${id}/export?format=${format}&style=${style}`;
  },

  async compileExport(data: any, format: 'md' | 'tex' | 'docx' | 'pdf', options?: CompileOptions): Promise<CompileResult> {
    const res = await fetch(`${BASE_URL}/export/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ data, format, options })
    });
    if (!res.ok) throw new Error('Falha ao compilar exportação');
    return res.json();
  }
};
