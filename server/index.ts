import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, initDatabase, hashPassword } from './db.js';

initDatabase();

const server = Fastify({
  logger: process.env.NODE_ENV !== 'production' ? { level: 'info' } : false
});

await server.register(cors, {
  origin: true
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

// Categories
server.get('/api/categories', async (request) => {
  const userId = getUserId(request);
  return db.prepare('SELECT * FROM categories WHERE user_id = ? OR user_id IS NULL ORDER BY name ASC').all(userId);
});

server.post('/api/categories', async (request) => {
  const userId = getUserId(request);
  const body = request.body as { name: string; color?: string; icon?: string };
  const id = `cat-${Date.now()}`;
  db.prepare('INSERT INTO categories (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)').run(
    id,
    userId,
    body.name,
    body.color || '#eab308',
    body.icon || 'folder'
  );
  return { id, user_id: userId, ...body };
});

// Folders
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
  db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(id, body.title, content);

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
  db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
  db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(id, title, content);

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
  db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(id);
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

// FTS5 Global Search
server.get('/api/search', async (request) => {
  const { q } = request.query as { q?: string };
  if (!q || !q.trim()) {
    return [];
  }

  const cleanQuery = q.trim().replace(/['"*]/g, '');
  if (!cleanQuery) return [];

  const ftsQuery = `"${cleanQuery}"*`;

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
  } catch {
    return db.prepare(`
      SELECT n.id, n.title, substr(n.content, 1, 120) as snippet, c.name as category_name
      FROM notes n
      LEFT JOIN categories c ON n.category_id = c.id
      WHERE n.title LIKE ? OR n.content LIKE ?
      LIMIT 20
    `).all(`%${cleanQuery}%`, `%${cleanQuery}%`);
  }
});

// Fallback for SPA routing in production
if (fs.existsSync(CLIENT_DIST)) {
  server.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

try {
  await server.listen({ port: PORT, host: HOST });
  console.log(`Knowledge Dump API Server rodando em http://${HOST}:${PORT}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
