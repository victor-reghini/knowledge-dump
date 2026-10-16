import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { db, initDatabase, hashPassword, hasFts5, DATA_DIR, REFS_DIR } from './db.js';
import { parseDocxFile, saveDocxFile } from './docx.js';
import { parsePptxFile } from './pptx.js';

initDatabase();

const server = Fastify({
  logger: process.env.NODE_ENV !== 'production' ? { level: 'info' } : false
});

await server.register(cors, {
  origin: true
});

await server.register(multipart, {
  limits: {
    fileSize: 150 * 1024 * 1024 // 150 MB para suportar papers e livros volumosos (RNF-03)
  }
});

const CLIENT_DIST = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  await server.register(fastifyStatic, {
    root: CLIENT_DIST,
    prefix: '/'
  });
}

// Health check
server.get('/api/health', async () => {
  const notesCount = (db.prepare('SELECT count(*) as count FROM notes').get() as { count: number }).count;
  return {
    status: 'ok',
    version: '1.0.0',
    notesCount,
    uptime: process.uptime()
  };
});

// Helper to get active user ID from request header
function getUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const header = request.headers['x-user-id'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  return 'user-admin';
}

// --- AUTHENTICATION ROUTES (RF-36) ---

server.post('/api/auth/login', async (request, reply) => {
  const { username, password } = request.body as { username?: string; password?: string };
  if (!username || !password) {
    return reply.status(400).send({ error: 'Usuário e senha são obrigatórios' });
  }

  const hashedPassword = hashPassword(password);
  const user = db.prepare('SELECT id, username, name, created_at FROM users WHERE username = ? AND password_hash = ?').get(
    username.trim(),
    hashedPassword
  ) as { id: string; username: string; name: string; created_at: string } | undefined;

  if (!user) {
    return reply.status(401).send({ error: 'Credenciais inválidas' });
  }

  return { user };
});

server.post('/api/auth/register', async (request, reply) => {
  const { username, password, name } = request.body as { username?: string; password?: string; name?: string };
  if (!username || !password) {
    return reply.status(400).send({ error: 'Usuário e senha são obrigatórios' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    return reply.status(400).send({ error: 'Nome de usuário já está em uso' });
  }

  const id = `user-${Date.now()}`;
  const displayName = (name && name.trim()) || username.trim();
  db.prepare(`
    INSERT INTO users (id, username, password_hash, name)
    VALUES (?, ?, ?, ?)
  `).run(id, username.trim(), hashPassword(password), displayName);

  return { user: { id, username: username.trim(), name: displayName } };
});

server.get('/api/auth/me', async (request) => {
  const userId = getUserId(request);
  const user = db.prepare('SELECT id, username, name, created_at FROM users WHERE id = ?').get(userId);
  return { user: user || { id: 'user-admin', username: 'admin', name: 'Pesquisador' } };
});

// --- PUBLIC SHARING ROUTES (RF-37) ---

server.post('/api/notes/:id/share', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    is_public: boolean;
    share_include_sources?: boolean;
    share_include_related?: boolean;
  };

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!note) {
    return reply.status(404).send({ error: 'Nota não encontrada' });
  }

  let shareToken = note.share_token as string | null;
  if (body.is_public && !shareToken) {
    shareToken = `share-${crypto.randomBytes(8).toString('hex')}`;
  }

  db.prepare(`
    UPDATE notes
    SET is_public = ?, share_token = ?, share_include_sources = ?, share_include_related = ?
    WHERE id = ?
  `).run(
    body.is_public ? 1 : 0,
    body.is_public ? shareToken : null,
    body.share_include_sources ? 1 : 0,
    body.share_include_related ? 1 : 0,
    id
  );

  return {
    is_public: body.is_public,
    share_token: body.is_public ? shareToken : null,
    share_include_sources: !!body.share_include_sources,
    share_include_related: !!body.share_include_related
  };
});

server.get('/api/public/notes/:token', async (request, reply) => {
  const { token } = request.params as { token: string };

  const note = db.prepare(`
    SELECT n.*, u.name as author_name, c.name as category_name
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    LEFT JOIN categories c ON n.category_id = c.id
    WHERE n.share_token = ? AND n.is_public = 1
  `).get(token) as Record<string, unknown> | undefined;

  if (!note) {
    return reply.status(404).send({ error: 'Nota pública não encontrada ou link desativado' });
  }

  // Tags
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN note_tags nt ON nt.tag_id = t.id
    WHERE nt.note_id = ?
  `).all(note.id as string) as { name: string }[];
  note.tags = tags.map((t) => t.name);

  // Optional: include sources (RF-37)
  if (note.share_include_sources) {
    const citations = db.prepare(`
      SELECT c.*, rf.title as source_title, rf.file_type, rf.authors, rf.year, rf.doi
      FROM citations c
      JOIN references_files rf ON c.reference_id = rf.id
      WHERE c.note_id = ?
    `).all(note.id as string);
    note.citations = citations;
  }

  // Optional: include related notes (RF-37)
  if (note.share_include_related) {
    const related = db.prepare(`
      SELECT DISTINCT n.id, n.title, substr(n.content, 1, 150) as snippet, n.share_token
      FROM wikilinks w
      JOIN notes n ON (w.target_note_id = n.id OR w.target_title = n.title)
      WHERE w.source_note_id = ? AND n.id != ?
    `).all(note.id as string, note.id as string);
    note.related_notes = related;
  }

  return note;
});

// --- CORE SYSTEM ROUTES ---

// Categories (Hierárquicas e com edição/exclusão)
server.get('/api/categories', async (request) => {
  const userId = getUserId(request);
  return db.prepare('SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL ORDER BY name ASC').all(userId);
});

server.post('/api/categories', async (request) => {
  const userId = getUserId(request);
  const body = request.body as { name: string; color?: string; icon?: string; parent_id?: string | null };
  const id = `cat-${Date.now()}`;
  db.prepare('INSERT INTO categories (id, user_id, name, color, icon, parent_id) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    userId,
    body.name,
    body.color || '#eab308',
    body.icon || 'folder',
    body.parent_id || null
  );
  return { id, user_id: userId, ...body };
});

server.put('/api/categories/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { name?: string; color?: string; icon?: string; parent_id?: string | null };
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as {
    id: string;
    name: string;
    color: string;
    icon: string;
    parent_id: string | null;
  } | undefined;
  if (!existing) return reply.status(404).send({ error: 'Categoria não encontrada' });

  const name = body.name !== undefined ? body.name : existing.name;
  const color = body.color !== undefined ? body.color : existing.color;
  const icon = body.icon !== undefined ? body.icon : existing.icon;
  const parent_id = body.parent_id !== undefined ? body.parent_id : existing.parent_id;

  db.prepare('UPDATE categories SET name = ?, color = ?, icon = ?, parent_id = ? WHERE id = ?').run(
    name,
    color,
    icon,
    parent_id,
    id
  );
  return { ...existing, name, color, icon, parent_id };
});

server.delete('/api/categories/:id', async (request) => {
  const { id } = request.params as { id: string };
  db.prepare('UPDATE notes SET category_id = NULL WHERE category_id = ?').run(id);
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  return { success: true, id };
});

// Folders (RF-04: Árvore hierárquica e subpastas)
server.get('/api/folders', async (request) => {
  const userId = getUserId(request);
  return db.prepare('SELECT * FROM folders WHERE user_id = ? OR user_id IS NULL ORDER BY name ASC').all(userId);
});

server.post('/api/folders', async (request) => {
  const userId = getUserId(request);
  const body = request.body as { name: string; parent_id?: string | null };
  const id = `folder-${Date.now()}`;
  db.prepare('INSERT INTO folders (id, user_id, name, parent_id) VALUES (?, ?, ?, ?)').run(
    id,
    userId,
    body.name,
    body.parent_id || null
  );
  return { id, user_id: userId, ...body };
});

server.put('/api/folders/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as { name?: string; parent_id?: string | null };
  const existing = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as { id: string; name: string; parent_id: string | null } | undefined;
  if (!existing) return reply.status(404).send({ error: 'Pasta não encontrada' });
  const name = body.name !== undefined ? body.name : existing.name;
  const parent_id = body.parent_id !== undefined ? body.parent_id : existing.parent_id;
  db.prepare('UPDATE folders SET name = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, parent_id, id);
  return { ...existing, name, parent_id };
});

server.delete('/api/folders/:id', async (request) => {
  const { id } = request.params as { id: string };
  db.prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ?').run(id);
  db.prepare('UPDATE folders SET parent_id = NULL WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
  return { success: true, id };
});

// Tags
server.get('/api/tags', async () => {
  return db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
});

// Notes List (RF-04: multi-view support)
server.get('/api/notes', async (request) => {
  const userId = getUserId(request);
  const query = request.query as { folder_id?: string; category_id?: string; tag?: string };

  let sql = `
    SELECT n.*, c.name as category_name, c.color as category_color, f.name as folder_name
    FROM notes n
    LEFT JOIN categories c ON n.category_id = c.id
    LEFT JOIN folders f ON n.folder_id = f.id
    WHERE (n.user_id = ? OR n.user_id IS NULL)
  `;
  const params: (string | number | bigint | null)[] = [userId];

  if (query.folder_id) {
    sql += ' AND n.folder_id = ?';
    params.push(query.folder_id);
  }
  if (query.category_id) {
    sql += ' AND n.category_id = ?';
    params.push(query.category_id);
  }

  sql += ' ORDER BY n.updated_at DESC';
  const notes = db.prepare(sql).all(...params) as Record<string, unknown>[];

  // Fetch tags for each note
  for (const note of notes) {
    const tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN note_tags nt ON nt.tag_id = t.id
      WHERE nt.note_id = ?
    `).all(note.id as string) as { name: string }[];
    note.tags = tags.map((t) => t.name);
  }

  return notes;
});

// Single Note Detail
server.get('/api/notes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const note = db.prepare(`
    SELECT n.*, c.name as category_name, c.color as category_color, f.name as folder_name
    FROM notes n
    LEFT JOIN categories c ON n.category_id = c.id
    LEFT JOIN folders f ON n.folder_id = f.id
    WHERE n.id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!note) {
    return reply.status(404).send({ error: 'Nota não encontrada' });
  }

  // Tags
  const tags = db.prepare(`
    SELECT t.name FROM tags t
    JOIN note_tags nt ON nt.tag_id = t.id
    WHERE nt.note_id = ?
  `).all(id) as { name: string }[];
  note.tags = tags.map((t) => t.name);

  // Backlinks (RF-10)
  const backlinks = db.prepare(`
    SELECT DISTINCT n.id, n.title
    FROM notes n
    JOIN wikilinks w ON w.source_note_id = n.id
    WHERE w.target_title = ? OR w.target_note_id = ?
  `).all(note.title as string, id);
  note.backlinks = backlinks;

  // Bookmarks (RF-05)
  const bookmarks = db.prepare(`
    SELECT * FROM bookmarks WHERE note_id = ? ORDER BY created_at DESC
  `).all(id);
  note.bookmarks = bookmarks;

  // Citations (RF-19)
  const citations = db.prepare(`
    SELECT c.*, rf.title as source_title, rf.file_type, rf.authors, rf.year, rf.doi
    FROM citations c
    JOIN references_files rf ON c.reference_id = rf.id
    WHERE c.note_id = ?
    ORDER BY c.created_at ASC
  `).all(id);
  note.citations = citations;

  return note;
});

// Helper to extract wikilinks from content
function extractAndSaveWikilinks(noteId: string, content: string) {
  db.prepare('DELETE FROM wikilinks WHERE source_note_id = ?').run(noteId);
  const regex = /\[\[([^\]#]+)(?:#([^\]]+))?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const targetTitle = match[1].trim();
    const targetAnchor = match[2] ? match[2].trim() : null;
    const targetNote = db.prepare('SELECT id FROM notes WHERE title = ?').get(targetTitle) as { id: string } | undefined;
    const linkId = `wl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO wikilinks (id, source_note_id, target_title, target_anchor, target_note_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(linkId, noteId, targetTitle, targetAnchor, targetNote ? targetNote.id : null);
  }
}

// Create Note
server.post('/api/notes', async (request) => {
  const userId = getUserId(request);
  const body = request.body as {
    title: string;
    content?: string;
    category_id?: string;
    folder_id?: string;
    tags?: string[];
  };

  const id = `note-${Date.now()}`;
  const content = body.content || '';
  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, category_id, folder_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, body.title, content, body.category_id || null, body.folder_id || null);

  // FTS5
  if (hasFts5) {
    try {
      db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(id, body.title, content);
    } catch {}
  }

  // Tags
  if (body.tags && Array.isArray(body.tags)) {
    for (const tagName of body.tags) {
      const trimmed = tagName.trim().toLowerCase();
      if (!trimmed) continue;
      db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(`tag-${trimmed}`, trimmed);
      db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(id, `tag-${trimmed}`);
    }
  }

  // Wikilinks
  extractAndSaveWikilinks(id, content);

  return { id, user_id: userId, ...body };
});

// Update Note
server.put('/api/notes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    title?: string;
    content?: string;
    category_id?: string;
    folder_id?: string;
    is_favorite?: boolean;
    tags?: string[];
  };

  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    return reply.status(404).send({ error: 'Nota não encontrada' });
  }

  const title = String(body.title !== undefined ? body.title : existing.title);
  const content = String(body.content !== undefined ? body.content : existing.content);
  const category_id = body.category_id !== undefined ? (body.category_id || null) : ((existing.category_id as string) || null);
  const folder_id = body.folder_id !== undefined ? (body.folder_id || null) : ((existing.folder_id as string) || null);
  const is_favorite = body.is_favorite !== undefined ? (body.is_favorite ? 1 : 0) : Number(existing.is_favorite || 0);

  db.prepare(`
    UPDATE notes
    SET title = ?, content = ?, category_id = ?, folder_id = ?, is_favorite = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, content, category_id, folder_id, is_favorite, id);

  // Update FTS5
  if (hasFts5) {
    try {
      db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
      db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(id, title, content);
    } catch {}
  }

  // Tags
  if (body.tags && Array.isArray(body.tags)) {
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(id);
    for (const tagName of body.tags) {
      const trimmed = tagName.trim().toLowerCase();
      if (!trimmed) continue;
      db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(`tag-${trimmed}`, trimmed);
      db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(id, `tag-${trimmed}`);
    }
  }

  // Wikilinks
  extractAndSaveWikilinks(id, content);

  const updatedNote = db.prepare(`
    SELECT n.*, c.name as category_name, c.color as category_color, f.name as folder_name
    FROM notes n
    LEFT JOIN categories c ON n.category_id = c.id
    LEFT JOIN folders f ON n.folder_id = f.id
    WHERE n.id = ?
  `).get(id);

  return updatedNote;
});

// Delete Note
server.delete('/api/notes/:id', async (request) => {
  const { id } = request.params as { id: string };
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  if (hasFts5) {
    try {
      db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
    } catch {}
  }
  return { success: true, id };
});

// Bookmarks (RF-05)
server.get('/api/bookmarks', async (request) => {
  const userId = getUserId(request);
  return db.prepare(`
    SELECT b.*, n.title as note_title
    FROM bookmarks b
    LEFT JOIN notes n ON b.note_id = n.id
    WHERE n.user_id = ? OR n.user_id IS NULL
    ORDER BY b.created_at DESC
  `).all(userId);
});

server.post('/api/bookmarks', async (request) => {
  const body = request.body as {
    note_id?: string;
    title: string;
    comment?: string;
    color?: string;
    page_or_pos?: string;
  };
  const id = `bm-${Date.now()}`;
  db.prepare(`
    INSERT INTO bookmarks (id, note_id, title, comment, color, page_or_pos)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, body.note_id || null, body.title, body.comment || null, body.color || '#eab308', body.page_or_pos || null);
  return { id, ...body };
});

server.delete('/api/bookmarks/:id', async (request) => {
  const { id } = request.params as { id: string };
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  return { success: true };
});

// --- REFERENCES & CITATIONS (RF-14, RF-19, RNF-03, RN-02) ---

// References list
server.get('/api/references', async (request) => {
  const userId = getUserId(request);
  const { folder_id, category_id } = request.query as { folder_id?: string; category_id?: string };

  let query = `
    SELECT rf.*, c.name as category_name, c.color as category_color, f.name as folder_name
    FROM references_files rf
    LEFT JOIN categories c ON rf.category_id = c.id
    LEFT JOIN folders f ON rf.folder_id = f.id
    WHERE (rf.user_id = ? OR rf.user_id IS NULL)
  `;
  const params: any[] = [userId];

  if (folder_id) {
    query += ' AND rf.folder_id = ?';
    params.push(folder_id);
  }
  if (category_id) {
    query += ' AND rf.category_id = ?';
    params.push(category_id);
  }

  query += ' ORDER BY rf.created_at DESC';
  return db.prepare(query).all(...params);
});

// Single Reference
server.get('/api/references/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const ref = db.prepare(`
    SELECT rf.*, c.name as category_name, c.color as category_color, f.name as folder_name
    FROM references_files rf
    LEFT JOIN categories c ON rf.category_id = c.id
    LEFT JOIN folders f ON rf.folder_id = f.id
    WHERE rf.id = ?
  `).get(id);
  if (!ref) return reply.status(404).send({ error: 'Referência não encontrada' });
  return ref;
});

function detectFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'docx';
  if (['tex', 'latex'].includes(ext)) return 'tex';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['md', 'markdown'].includes(ext)) return 'md';
  if (['txt', 'text'].includes(ext)) return 'txt';
  if (['pptx', 'ppt', 'pps', 'ppsx', 'odp'].includes(ext)) return 'pptx';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  return ext || 'binary';
}

function getMimeType(filePath: string, fileType: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc': return 'application/msword';
    case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.ppt': return 'application/vnd.ms-powerpoint';
    case '.tex': return 'text/plain; charset=utf-8';
    case '.txt': return 'text/plain; charset=utf-8';
    case '.html':
    case '.htm': return 'text/html; charset=utf-8';
    case '.md': return 'text/markdown; charset=utf-8';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.webp': return 'image/webp';
    default:
      if (fileType === 'pdf') return 'application/pdf';
      if (fileType === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      if (fileType === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      if (fileType === 'tex' || fileType === 'txt') return 'text/plain; charset=utf-8';
      if (fileType === 'md') return 'text/markdown; charset=utf-8';
      if (fileType === 'video') return 'video/mp4';
      if (fileType === 'audio') return 'audio/mpeg';
      if (fileType === 'image') return 'image/png';
      return 'application/octet-stream';
  }
}

// Serve Reference Stream (PDF, DOCX, Video, Audio, Imagem, etc.) with HTTP Range Support (RFC 7233)
server.get('/api/references/:id/file', async (request, reply) => {
  const { id } = request.params as { id: string };
  const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get(id) as { file_path: string; title: string; file_type: string } | undefined;
  if (!ref) return reply.status(404).send({ error: 'Referência não encontrada' });

  const fullPath = path.isAbsolute(ref.file_path) ? ref.file_path : path.join(DATA_DIR, ref.file_path);
  if (!fs.existsSync(fullPath)) {
    return reply.status(404).send({ error: 'Arquivo da referência não encontrado no disco' });
  }

  const stat = fs.statSync(fullPath);
  const totalSize = stat.size;
  const mimeType = getMimeType(fullPath, ref.file_type);
  const ext = path.extname(fullPath) || `.${ref.file_type}`;
  const rangeHeader = request.headers.range;

  reply.header('Accept-Ranges', 'bytes');

  if (!rangeHeader) {
    reply.header('Content-Type', mimeType);
    reply.header('Content-Length', totalSize);
    reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(ref.title)}${ext}"`);
    return reply.send(fs.createReadStream(fullPath));
  }

  const sendRangeError = () => {
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Range', `bytes */${totalSize}`);
    return reply.status(416).send({ error: 'Faixa de bytes não satisfatória (Range Not Satisfiable)' });
  };

  // Parse Range header: e.g. "bytes=0-1023", "bytes=1048576-", "bytes=-1024"
  const rangeMatch = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!rangeMatch) {
    return sendRangeError();
  }

  let start: number;
  let end: number;
  const rawStart = rangeMatch[1];
  const rawEnd = rangeMatch[2];

  if (rawStart === '' && rawEnd === '') {
    return sendRangeError();
  } else if (rawStart === '') {
    // Suffix range: bytes=-500 (last 500 bytes)
    const suffix = parseInt(rawEnd, 10);
    if (suffix <= 0) {
      return sendRangeError();
    }
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = parseInt(rawStart, 10);
    end = rawEnd === '' ? totalSize - 1 : parseInt(rawEnd, 10);
  }

  if (start >= totalSize || end >= totalSize || start > end || start < 0) {
    return sendRangeError();
  }

  const chunkSize = end - start + 1;
  reply.status(206);
  reply.header('Content-Type', mimeType);
  reply.header('Content-Range', `bytes ${start}-${end}/${totalSize}`);
  reply.header('Content-Length', chunkSize);
  reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(ref.title)}${ext}"`);
  return reply.send(fs.createReadStream(fullPath, { start, end }));
});

// Get Reference Formatted Content (DOCX, TeX, PPTX, HTML, Markdown, Plain Text)
server.get('/api/references/:id/content', async (request, reply) => {
  const { id } = request.params as { id: string };
  const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get(id) as { id: string; file_path: string; title: string; file_type: string } | undefined;
  if (!ref) return reply.status(404).send({ error: 'Referência não encontrada' });

  const fullPath = path.isAbsolute(ref.file_path) ? ref.file_path : path.join(DATA_DIR, ref.file_path);
  if (!fs.existsSync(fullPath)) {
    return reply.status(404).send({ error: 'Arquivo da referência não encontrado no disco' });
  }

  if (ref.file_type === 'docx' || fullPath.endsWith('.docx') || fullPath.endsWith('.doc')) {
    try {
      const docxData = parseDocxFile(fullPath);
      return {
        id: ref.id,
        title: ref.title,
        file_type: 'docx',
        ...docxData
      };
    } catch (err: any) {
      return reply.status(500).send({ error: `Erro ao analisar DOCX: ${err.message}` });
    }
  }

  if (ref.file_type === 'pptx' || fullPath.endsWith('.pptx') || fullPath.endsWith('.ppt')) {
    try {
      const pptxData = parsePptxFile(fullPath);
      return {
        id: ref.id,
        title: ref.title,
        file_type: 'pptx',
        ...pptxData
      };
    } catch (err: any) {
      return reply.status(500).send({ error: `Erro ao analisar PowerPoint: ${err.message}` });
    }
  }

  if (['tex', 'latex', 'md', 'markdown', 'html', 'htm', 'txt', 'text'].includes(ref.file_type) || /\.(tex|md|html|htm|txt)$/i.test(fullPath)) {
    const text = fs.readFileSync(fullPath, 'utf8');
    return {
      id: ref.id,
      title: ref.title,
      file_type: ref.file_type,
      text
    };
  }

  return {
    id: ref.id,
    title: ref.title,
    file_type: ref.file_type,
    file_url: `/api/references/${ref.id}/file`
  };
});

// Update Reference Content (Edição de texto no disco para TXT, MD, DOCX, TEX, HTML)
server.put('/api/references/:id/content', async (request, reply) => {
  const { id } = request.params as { id: string };
  const { text } = (request.body as { text?: string }) || {};

  if (typeof text !== 'string') {
    return reply.status(400).send({ error: 'Campo "text" obrigatório para atualizar o conteúdo' });
  }

  const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get(id) as { id: string; file_path: string; title: string; file_type: string } | undefined;
  if (!ref) return reply.status(404).send({ error: 'Referência não encontrada' });

  const fullPath = path.isAbsolute(ref.file_path) ? ref.file_path : path.join(DATA_DIR, ref.file_path);
  if (!fs.existsSync(fullPath)) {
    return reply.status(404).send({ error: 'Arquivo da referência não encontrado no disco' });
  }

  const isDocx = ref.file_type === 'docx' || fullPath.endsWith('.docx') || fullPath.endsWith('.doc');
  const isText = ['txt', 'text', 'md', 'markdown', 'tex', 'latex', 'html', 'htm'].includes(ref.file_type) || /\.(txt|md|tex|html|htm)$/i.test(fullPath);

  if (!isDocx && !isText) {
    return reply.status(400).send({ error: 'O formato deste arquivo não permite edição direta de texto' });
  }

  try {
    if (isDocx) {
      saveDocxFile(fullPath, text);
    } else {
      fs.writeFileSync(fullPath, text, 'utf8');
    }

    return {
      success: true,
      id: ref.id,
      title: ref.title,
      file_type: ref.file_type,
      updated_at: new Date().toISOString()
    };
  } catch (err: any) {
    return reply.status(500).send({ error: `Erro ao salvar alterações no arquivo: ${err.message}` });
  }
});

// Upload / Create Reference
server.post('/api/references', async (request, reply) => {
  const userId = getUserId(request);
  if (request.isMultipart()) {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });
    const filename = `${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const targetPath = path.join(REFS_DIR, filename);
    await pipeline(data.file, fs.createWriteStream(targetPath));

    const fields = (data.fields || {}) as Record<string, any>;
    const title = fields.title?.value || data.filename.replace(/\.[^.]+$/, '');
    const authors = fields.authors?.value || '';
    const year = fields.year?.value ? parseInt(fields.year.value, 10) : new Date().getFullYear();
    const folderId = fields.folder_id?.value || null;
    const categoryId = fields.category_id?.value || null;
    const fileType = detectFileType(data.filename);
    const id = `ref-${Date.now()}`;

    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year, folder_id, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, title, `references/${filename}`, fileType, authors, year, folderId, categoryId);

    return {
      id,
      user_id: userId,
      title,
      file_path: `references/${filename}`,
      file_type: fileType,
      authors,
      year,
      folder_id: folderId,
      category_id: categoryId
    };
  } else {
    const body = request.body as {
      title: string;
      file_path?: string;
      authors?: string;
      year?: number;
      doi?: string;
      folder_id?: string | null;
      category_id?: string | null;
      file_base64?: string;
      filename?: string;
      file_type?: string;
    };
    const id = `ref-${Date.now()}`;
    let filePath = body.file_path || '';
    let fileType = body.file_type;
    if (body.file_base64 && body.filename) {
      const filename = `${Date.now()}-${body.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const targetPath = path.join(REFS_DIR, filename);
      await fs.promises.writeFile(targetPath, Buffer.from(body.file_base64, 'base64'));
      filePath = `references/${filename}`;
      if (!fileType) fileType = detectFileType(body.filename);
    }

    if (!fileType) {
      fileType = filePath ? detectFileType(filePath) : 'pdf';
    }

    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year, doi, folder_id, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, body.title, filePath, fileType, body.authors || null, body.year || null, body.doi || null, body.folder_id || null, body.category_id || null);

    return { id, user_id: userId, ...body, file_path: filePath, file_type: fileType };
  }
});

// Update Reference (organize into folder, categorize, edit metadata)
server.put('/api/references/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    title?: string;
    folder_id?: string | null;
    category_id?: string | null;
    authors?: string | null;
    year?: number | null;
    doi?: string | null;
  };

  const existing = db.prepare('SELECT * FROM references_files WHERE id = ?').get(id) as any;
  if (!existing) return reply.status(404).send({ error: 'Referência não encontrada' });

  const title = body.title !== undefined ? body.title : existing.title;
  const folderId = body.folder_id !== undefined ? body.folder_id : existing.folder_id;
  const categoryId = body.category_id !== undefined ? body.category_id : existing.category_id;
  const authors = body.authors !== undefined ? body.authors : existing.authors;
  const year = body.year !== undefined ? body.year : existing.year;
  const doi = body.doi !== undefined ? body.doi : existing.doi;

  db.prepare(`
    UPDATE references_files
    SET title = ?, folder_id = ?, category_id = ?, authors = ?, year = ?, doi = ?
    WHERE id = ?
  `).run(title, folderId, categoryId, authors, year, doi, id);

  const updated = db.prepare(`
    SELECT rf.*, c.name as category_name, c.color as category_color, f.name as folder_name
    FROM references_files rf
    LEFT JOIN categories c ON rf.category_id = c.id
    LEFT JOIN folders f ON rf.folder_id = f.id
    WHERE rf.id = ?
  `).get(id);

  return updated;
});

// Delete Reference
server.delete('/api/references/:id', async (request) => {
  const { id } = request.params as { id: string };
  db.prepare('DELETE FROM citations WHERE reference_id = ?').run(id);
  db.prepare('DELETE FROM references_files WHERE id = ?').run(id);
  return { success: true, id };
});

// Citations
server.get('/api/citations', async (request) => {
  const { note_id } = request.query as { note_id?: string };
  if (note_id) {
    return db.prepare(`
      SELECT c.*, rf.title as source_title, rf.file_type, rf.authors, rf.year, rf.doi
      FROM citations c
      JOIN references_files rf ON c.reference_id = rf.id
      WHERE c.note_id = ?
      ORDER BY c.created_at ASC
    `).all(note_id);
  }
  return db.prepare(`
    SELECT c.*, rf.title as source_title, rf.file_type, rf.authors, rf.year
    FROM citations c
    JOIN references_files rf ON c.reference_id = rf.id
    ORDER BY c.created_at DESC
  `).all();
});

server.post('/api/citations', async (request) => {
  const body = request.body as {
    note_id: string;
    reference_id: string;
    quote_text: string;
    page_number?: number;
    anchor_data?: string;
  };
  const id = `cite-${Date.now()}`;
  db.prepare(`
    INSERT INTO citations (id, note_id, reference_id, quote_text, page_number, anchor_data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, body.note_id, body.reference_id, body.quote_text, body.page_number || null, body.anchor_data || null);

  const citation = db.prepare(`
    SELECT c.*, rf.title as source_title, rf.file_type, rf.authors, rf.year
    FROM citations c
    JOIN references_files rf ON c.reference_id = rf.id
    WHERE c.id = ?
  `).get(id);
  return citation;
});

server.delete('/api/citations/:id', async (request) => {
  const { id } = request.params as { id: string };
  db.prepare('DELETE FROM citations WHERE id = ?').run(id);
  return { success: true, id };
});

// FTS5 Global Search
server.get('/api/search', async (request) => {
  const { q } = request.query as { q?: string };
  if (!q || !q.trim()) {
    return [];
  }

  const cleanQuery = q.trim().replace(/['"*]/g, '');
  if (!cleanQuery) return [];

  const ftsQuery = `"${cleanQuery}"*`;

  if (hasFts5) {
    try {
      const results = db.prepare(`
        SELECT n.id, n.title, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 20) as snippet,
               c.name as category_name
        FROM notes_fts
        JOIN notes n ON notes_fts.note_id = n.id
        LEFT JOIN categories c ON n.category_id = c.id
        WHERE notes_fts MATCH ?
        LIMIT 20
      `).all(ftsQuery);
      return results;
    } catch {}
  }

  return db.prepare(`
    SELECT n.id, n.title, substr(n.content, 1, 120) as snippet, c.name as category_name
    FROM notes n
    LEFT JOIN categories c ON n.category_id = c.id
    WHERE n.title LIKE ? OR n.content LIKE ?
    LIMIT 20
  `).all(`%${cleanQuery}%`, `%${cleanQuery}%`);
});

// Fallback for SPA routing in production
if (fs.existsSync(CLIENT_DIST)) {
  server.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.NODE_ENV !== 'test') {
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`Knowledge Dump API Server rodando em http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

export { server };
