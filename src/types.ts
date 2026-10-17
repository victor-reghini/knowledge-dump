export interface User {
  id: string;
  username: string;
  name: string;
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
