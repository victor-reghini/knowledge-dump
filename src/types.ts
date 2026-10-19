export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  google_id?: string;
  avatar_url?: string;
  gdrive_auto_sync?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  level: number;
}

export interface ReferenceFile {
  id: string;
  user_id?: string;
  title: string;
  file_path: string;
  file_type: string;
  authors?: string | null;
  year?: number | null;
  doi?: string | null;
  folder_id?: string | null;
  category_id?: string | null;
  folder_name?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  parent_id?: string | null;
  created_at: string;
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  level: number;
}

export interface Tag {
  id: string;
  name: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  note_id: string | null;
  reference_id: string | null;
  title: string;
  page_or_pos: string | null;
  comment: string | null;
  color: string;
  created_at: string;
  note_title?: string;
}

export interface Citation {
  id: string;
  note_id?: string;
  reference_id?: string;
  quote_text: string;
  page_number?: number;
  anchor_data?: string;
  source_title?: string;
  file_type?: string;
  authors?: string;
  year?: number;
}

export interface RelatedNote {
  id: string;
  title: string;
  snippet?: string;
  share_token?: string;
}

export interface Note {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  file_type?: string;
  category_id: string | null;
  category_name?: string;
  category_color?: string;
  folder_id: string | null;
  folder_name?: string;
  is_favorite: number | boolean;
  is_public?: number | boolean;
  share_token?: string | null;
  share_include_sources?: number | boolean;
  share_include_related?: number | boolean;
  author_name?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  backlinks?: { id: string; title: string }[];
  bookmarks?: Bookmark[];
  citations?: Citation[];
  related_notes?: RelatedNote[];
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  category_name?: string;
}

export type DirectoryViewLayout = 'list' | 'grid';

export interface GraphNode {
  id: string;
  title: string;
  type: 'note' | 'reference';
  category_id?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
  file_type?: string;
  tags?: string[];
  degree: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius?: number;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: 'wikilink' | 'citation';
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphFilterOptions {
  searchQuery?: string;
  type?: 'all' | 'notes' | 'references';
  categoryId?: string | null;
  folderId?: string | null;
  tag?: string | null;
  minDegree: number;
  hideIsolated: boolean;
  showLabels: boolean;
}

export interface StudyTopic {
  id: string;
  plan_id: string;
  title: string;
  order_index: number;
  estimated_hours: number;
  status: 'pending' | 'in_progress' | 'completed';
  due_date?: string | null;
  notes_ids: string[];
  references_ids: string[];
  notes?: Note[];
  references?: ReferenceFile[];
  exercises_count?: number;
  created_at?: string;
}

export interface StudyPlan {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  target_date?: string | null;
  created_at?: string;
  updated_at?: string;
  topics?: StudyTopic[];
  total_topics?: number;
  completed_topics?: number;
  progress_percent?: number;
}

export interface Exercise {
  id: string;
  user_id?: string;
  topic_id?: string | null;
  topic_title?: string | null;
  note_id?: string | null;
  note_title?: string | null;
  reference_id?: string | null;
  reference_title?: string | null;
  question: string;
  type: 'multiple_choice' | 'open';
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  created_at?: string;
}

export interface ExerciseVerifyResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  note_id?: string | null;
  note_title?: string | null;
  reference_id?: string | null;
  reference_title?: string | null;
}

export interface SimulationAnswer {
  id: string;
  simulation_id: string;
  exercise_id: string;
  selected_answer: string;
  is_correct: boolean | number;
  time_spent_seconds?: number;
  question?: string;
  explanation?: string;
  note_id?: string | null;
  note_title?: string | null;
  reference_id?: string | null;
  reference_title?: string | null;
}

export interface Simulation {
  id: string;
  user_id?: string;
  plan_id?: string | null;
  plan_title?: string | null;
  title: string;
  duration_minutes: number;
  score: number;
  total_questions: number;
  correct_count: number;
  completed_at?: string | null;
  created_at?: string;
  answers?: SimulationAnswer[];
}

export interface ArticleCitation {
  id: string;
  article_id: string;
  reference_id?: string | null;
  reference_title?: string | null;
  reference_authors?: string | null;
  reference_year?: number | null;
  reference_doi?: string | null;
  reference_file_type?: string | null;
  note_id?: string | null;
  note_title?: string | null;
  citation_key: string;
  formatted_text?: string | null;
  page_number?: number | null;
  created_at?: string;
}

export interface Article {
  id: string;
  user_id?: string;
  author_name?: string;
  title: string;
  subtitle?: string | null;
  abstract?: string | null;
  content: string;
  keywords: string[];
  status: 'draft' | 'review' | 'published';
  target_venue?: string | null;
  citations_count?: number;
  word_count?: number;
  estimated_reading_minutes?: number;
  citations?: ArticleCitation[];
  created_at?: string;
  updated_at?: string;
}

export interface CompileOptions {
  citationStyle?: 'ABNT' | 'APA' | 'IEEE';
  includeAbstract?: boolean;
  includeBibliography?: boolean;
  includeFrontmatter?: boolean;
}

export interface CompileResult {
  format: 'md' | 'tex' | 'docx' | 'pdf';
  compiled?: string;
  base64?: string;
  filename: string;
}

export interface SyncConflict {
  entity_type: string;
  entity_id: string;
  reason: string;
}

export interface SyncPushPayload {
  client_id?: string;
  last_synced_at?: string | null;
  changes?: {
    notes?: Note[];
    folders?: Folder[];
    categories?: Category[];
    bookmarks?: Bookmark[];
  };
}

export interface SyncResponse {
  server_time: string;
  applied: {
    notes: number;
    folders: number;
    categories: number;
    bookmarks: number;
    conflicts: SyncConflict[];
  };
  delta: {
    notes: Note[];
    folders: Folder[];
    categories: Category[];
    bookmarks: Bookmark[];
  };
  tombstones: Array<{
    entity_type: string;
    entity_id: string;
    deleted_at: string;
  }>;
}

export interface SyncStatus {
  status: 'online' | 'offline';
  server_time: string;
  user_id?: string;
  counts: {
    notes: number;
    folders: number;
    categories: number;
    bookmarks: number;
    tombstones: number;
  };
}

export interface BackupStatus {
  status: 'ready' | 'generating' | 'error';
  user_id: string;
  counts: {
    notes: number;
    references: number;
    categories: number;
    folders: number;
    bookmarks: number;
  };
  format: string;
}

export interface BackupDriveUploadResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  action?: 'pulled' | 'merged_and_pushed' | 'pushed_initial' | 'in_sync' | string;
  merged?: boolean;
  hash?: string;
  file?: {
    fileId: string;
    name: string;
    webViewLink?: string;
    size: number;
  };
  manifest?: {
    knowledge_dump_version: string;
    backup_created_at: string;
    counts: Record<string, number>;
    data_hash?: string;
  };
  mergeStats?: Record<string, number>;
}


