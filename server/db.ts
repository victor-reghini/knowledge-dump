import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'knowledge.db');

export const db = new DatabaseSync(DB_PATH);

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#eab308',
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      is_favorite INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 0,
      share_token TEXT UNIQUE,
      share_include_sources INTEGER DEFAULT 0,
      share_include_related INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS wikilinks (
      id TEXT PRIMARY KEY,
      source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      target_title TEXT NOT NULL,
      target_anchor TEXT,
      target_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
      reference_id TEXT,
      title TEXT NOT NULL,
      page_or_pos TEXT,
      comment TEXT,
      color TEXT DEFAULT '#eab308',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS references_files (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      authors TEXT,
      year INTEGER,
      doi TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS citations (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      reference_id TEXT REFERENCES references_files(id) ON DELETE CASCADE,
      quote_text TEXT NOT NULL,
      page_number INTEGER,
      anchor_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      title,
      content
    );
  `);

  // Migrations for existing databases
  try { db.exec("ALTER TABLE notes ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;"); } catch {}
  try { db.exec("ALTER TABLE notes ADD COLUMN is_public INTEGER DEFAULT 0;"); } catch {}
  try { db.exec("ALTER TABLE notes ADD COLUMN share_token TEXT;"); } catch {}
  try { db.exec("ALTER TABLE notes ADD COLUMN share_include_sources INTEGER DEFAULT 0;"); } catch {}
  try { db.exec("ALTER TABLE notes ADD COLUMN share_include_related INTEGER DEFAULT 0;"); } catch {}
  try { db.exec("ALTER TABLE folders ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;"); } catch {}
  try { db.exec("ALTER TABLE categories ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;"); } catch {}

  // Ensure default user exists
  const defaultUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as { id: string } | undefined;
  let adminUserId = defaultUser?.id;
  if (!adminUserId) {
    adminUserId = 'user-admin';
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(adminUserId, 'admin', hashPassword('admin123'), 'Pesquisador');
  }

  // Ensure notes have an associated user_id
  db.prepare('UPDATE notes SET user_id = ? WHERE user_id IS NULL').run(adminUserId);
  db.prepare('UPDATE folders SET user_id = ? WHERE user_id IS NULL').run(adminUserId);
  db.prepare('UPDATE categories SET user_id = ? WHERE user_id IS NULL').run(adminUserId);

  // Seed starter content if empty
  const noteCount = (db.prepare('SELECT count(*) as count FROM notes').get() as { count: number }).count;
  if (noteCount === 0) {
    seedStarterData(adminUserId);
  }
}

function seedStarterData(userId: string) {
  const defaultCategoryId = 'cat-ciencia-computacao';
  db.prepare(`
    INSERT OR IGNORE INTO categories (id, user_id, name, color, icon)
    VALUES (?, ?, ?, ?, ?)
  `).run(defaultCategoryId, userId, 'Ciência da Computação', '#eab308', 'code');

  const defaultFolderId = 'folder-inteligencia-artificial';
  db.prepare(`
    INSERT OR IGNORE INTO folders (id, user_id, name, parent_id)
    VALUES (?, ?, ?, ?)
  `).run(defaultFolderId, userId, 'Inteligência Artificial', null);

  const tagId = 'tag-ia';
  db.prepare(`
    INSERT OR IGNORE INTO tags (id, name)
    VALUES (?, ?)
  `).run(tagId, 'ia');

  const noteId1 = 'note-redes-neurais';
  const title1 = 'Redes Neurais Artificiais';
  const content1 = `# Redes Neurais Artificiais

As Redes Neurais Artificiais (RNAs) são modelos computacionais inspirados no sistema nervoso central.

## Fundamentos
O modelo basilar de aprendizado supervisionado linear é o [[Perceptron]], proposto por Frank Rosenblatt em 1958.

## Aplicações Modernas
- Visão Computacional
- Processamento de Linguagem Natural
- Sistemas de Recomendação`;

  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, category_id, folder_id, is_favorite, is_public, share_token)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'share-redes-neurais')
  `).run(noteId1, userId, title1, content1, defaultCategoryId, defaultFolderId);

  const noteId2 = 'note-perceptron';
  const title2 = 'Perceptron';
  const content2 = `# Perceptron

O **Perceptron** é o algoritmo de classificação binária supervisionada mais elementar de redes neurais artificiais.

Foi concebido para simular o comportamento de um neurônio biológico com pesos sinápticos e função de ativação degrau.

Ver também: [[Redes Neurais Artificiais]]`;

  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, category_id, folder_id, is_favorite, is_public, share_token)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, null)
  `).run(noteId2, userId, title2, content2, defaultCategoryId, defaultFolderId);

  // Link note_tags
  db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId1, tagId);
  db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId2, tagId);

  // Index into FTS5
  db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(noteId1, title1, content1);
  db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(noteId2, title2, content2);

  // Seed a sample bookmark
  db.prepare(`
    INSERT OR IGNORE INTO bookmarks (id, note_id, title, comment, color)
    VALUES ('bm-1', ?, 'Fundamentos do Perceptron', 'Revisar convergência do algoritmo de treino', '#eab308')
  `).run(noteId1);
}
