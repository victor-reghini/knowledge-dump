import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';
import { db, recordTombstone } from '../server/db.js';
import { SyncPushPayload, SyncResponse, SyncStatus } from '../src/types.js';

describe('Atividade 4.1: API de Sincronização Incremental para Clientes PWA', () => {
  const testUserId = `user-sync-${Date.now()}`;
  let initialServerTime = '';

  before(async () => {
    await server.ready();

    // Cria usuário de teste para sincronização
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, `sync_user_${Date.now()}`, 'hash_test', 'Sincronizador PWA');
  });

  after(() => {
    // Limpeza de dados gerados no teste
    db.prepare('DELETE FROM sync_tombstones WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM folders WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  test('4.1.1: Endpoint GET /api/sync/status deve retornar integridade e contadores do acervo', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/sync/status',
      headers: { 'x-user-id': testUserId }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as SyncStatus;
    assert.equal(body.status, 'online');
    assert.ok(body.server_time);
    assert.equal(typeof body.counts.notes, 'number');
    assert.equal(typeof body.counts.folders, 'number');
    assert.equal(typeof body.counts.categories, 'number');
    assert.equal(typeof body.counts.bookmarks, 'number');
    assert.equal(typeof body.counts.tombstones, 'number');
    initialServerTime = body.server_time;
  });

  test('4.1.2: Initial Full Pull via POST /api/sync (sem timestamp previo) retorna todos os registros do usuário', async () => {
    // Insere registros prévios no servidor
    const catId = `cat-pre-${Date.now()}`;
    const foldId = `fold-pre-${Date.now()}`;
    const noteId = `note-pre-${Date.now()}`;

    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `).run(catId, testUserId, 'Categoria Nuvem', '#3b82f6', 'cloud');

    db.prepare(`
      INSERT INTO folders (id, user_id, name)
      VALUES (?, ?, ?)
    `).run(foldId, testUserId, 'Pasta Nuvem');

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, folder_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(noteId, testUserId, 'Nota na Nuvem', 'Conteúdo já sincronizado', catId, foldId);

    const res = await server.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { 'x-user-id': testUserId },
      payload: {
        client_id: 'pwa-mobile-device-1',
        last_synced_at: null,
        changes: {}
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as SyncResponse;
    assert.ok(body.server_time);
    assert.ok(Array.isArray(body.delta.notes));
    assert.ok(Array.isArray(body.delta.folders));
    assert.ok(Array.isArray(body.delta.categories));

    const foundNote = body.delta.notes.find(n => n.id === noteId);
    assert.ok(foundNote, 'Nota prévia do servidor deve vir no full pull inicial');
    assert.equal(foundNote.title, 'Nota na Nuvem');

    const foundCat = body.delta.categories.find(c => c.id === catId);
    assert.ok(foundCat, 'Categoria prévia deve constar no delta inicial');

    const foundFold = body.delta.folders.find(f => f.id === foldId);
    assert.ok(foundFold, 'Pasta prévia deve constar no delta inicial');
  });

  test('4.1.3: Delta Push: Cliente envia alterações criadas offline e servidor aplica com sucesso', async () => {
    const offlineNoteId = `note-offline-${Date.now()}`;
    const offlineCatId = `cat-offline-${Date.now()}`;
    const offlineFolderId = `fold-offline-${Date.now()}`;
    const offlineBookmarkId = `bm-offline-${Date.now()}`;

    const clientTimestamp = new Date(Date.now() + 1000).toISOString();

    const pushPayload: SyncPushPayload = {
      client_id: 'pwa-mobile-device-1',
      last_synced_at: initialServerTime,
      changes: {
        categories: [
          {
            id: offlineCatId,
            name: 'Categoria Criada Offline',
            color: '#10b981',
            icon: 'wifi-off',
            created_at: clientTimestamp,
            updated_at: clientTimestamp
          }
        ],
        folders: [
          {
            id: offlineFolderId,
            name: 'Pasta Criada Offline',
            created_at: clientTimestamp,
            updated_at: clientTimestamp
          }
        ],
        notes: [
          {
            id: offlineNoteId,
            title: 'Resumo Redigido Offline no Metrô',
            content: 'Notas teóricas ricas com [[Wikilink Offline]] e fórmula $E = mc^2$',
            category_id: offlineCatId,
            folder_id: offlineFolderId,
            file_type: 'docx',
            is_favorite: true,
            tags: ['offline', 'pwa', 'resiliencia'],
            created_at: clientTimestamp,
            updated_at: clientTimestamp
          }
        ],
        bookmarks: [
          {
            id: offlineBookmarkId,
            note_id: offlineNoteId,
            title: 'Marcador Offline',
            comment: 'Lembrar de revisar ao reconectar',
            created_at: clientTimestamp,
            updated_at: clientTimestamp
          }
        ]
      }
    };

    const res = await server.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { 'x-user-id': testUserId },
      payload: pushPayload
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as SyncResponse;

    // Confirmação de alterações aplicadas
    assert.equal(body.applied.categories, 1);
    assert.equal(body.applied.folders, 1);
    assert.equal(body.applied.notes, 1);
    assert.equal(body.applied.bookmarks, 1);
    assert.equal(body.applied.conflicts.length, 0);

    // Validação de persistência física no SQLite
    const persistedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(offlineNoteId) as any;
    assert.ok(persistedNote);
    assert.equal(persistedNote.title, 'Resumo Redigido Offline no Metrô');
    assert.equal(persistedNote.category_id, offlineCatId);
    assert.equal(persistedNote.folder_id, offlineFolderId);
    assert.equal(persistedNote.is_favorite, 1);

    const persistedTags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
    `).all(offlineNoteId) as Array<{ name: string }>;
    assert.equal(persistedTags.length, 3);
    assert.ok(persistedTags.some(t => t.name === 'offline'));

    const persistedFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(offlineFolderId) as any;
    assert.ok(persistedFolder);
    assert.equal(persistedFolder.name, 'Pasta Criada Offline');

    const persistedCategory = db.prepare('SELECT * FROM categories WHERE id = ?').get(offlineCatId) as any;
    assert.ok(persistedCategory);
    assert.equal(persistedCategory.name, 'Categoria Criada Offline');

    const persistedBm = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(offlineBookmarkId) as any;
    assert.ok(persistedBm);
    assert.equal(persistedBm.title, 'Marcador Offline');
  });

  test('4.1.4: Resolução de Conflitos Last-Write-Wins (LWW): Servidor mais recente prevalece sobre cliente atrasado', async () => {
    const noteConflictId = `note-conflict-${Date.now()}`;

    // 1. Cria a nota no servidor com timestamp recente
    const serverTime = '2026-10-17 12:30:00';
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(noteConflictId, testUserId, 'Versão Mais Recente do Servidor', 'Servidor editado às 12:30', serverTime);

    // 2. Cliente tenta enviar versão com timestamp anterior (ex: 12:00)
    const oldClientTime = '2026-10-17T12:00:00.000Z';
    const res = await server.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { 'x-user-id': testUserId },
      payload: {
        client_id: 'pwa-lagged-client',
        last_synced_at: '2026-10-17T11:00:00.000Z',
        changes: {
          notes: [
            {
              id: noteConflictId,
              title: 'Versão Obsoleta do Cliente',
              content: 'Edição offline antiga que não deve sobrescrever o servidor',
              updated_at: oldClientTime
            }
          ]
        }
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as SyncResponse;

    // Servidor deve registrar o conflito e não aplicar a alteração
    assert.equal(body.applied.notes, 0);
    assert.equal(body.applied.conflicts.length, 1);
    assert.equal(body.applied.conflicts[0].entity_id, noteConflictId);
    assert.equal(body.applied.conflicts[0].reason, 'server_newer');

    // Valida que o conteúdo original do servidor foi preservado
    const checkNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteConflictId) as any;
    assert.equal(checkNote.title, 'Versão Mais Recente do Servidor');
  });

  test('4.1.5: Tombstones e Propagação de Exclusões: Deleção gera rastro de remoção para sincronização delta', async () => {
    const noteToDeleteId = `note-to-del-${Date.now()}`;

    // 1. Cria nota
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content)
      VALUES (?, ?, ?, ?)
    `).run(noteToDeleteId, testUserId, 'Nota a Ser Deletada', 'Conteúdo efémero');

    const markTimestamp = new Date(Date.now() - 2000).toISOString();

    // 2. Deleta a nota via endpoint oficial DELETE /api/notes/:id
    const deleteRes = await server.inject({
      method: 'DELETE',
      url: `/api/notes/${noteToDeleteId}`,
      headers: { 'x-user-id': testUserId }
    });
    assert.equal(deleteRes.statusCode, 200);

    // 3. Outro dispositivo sincroniza desde `markTimestamp`
    const syncRes = await server.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { 'x-user-id': testUserId },
      payload: {
        client_id: 'pwa-secondary-device',
        last_synced_at: markTimestamp,
        changes: {}
      }
    });

    assert.equal(syncRes.statusCode, 200);
    const syncBody = JSON.parse(syncRes.body) as SyncResponse;

    const foundTombstone = syncBody.tombstones.find(t => t.entity_id === noteToDeleteId);
    assert.ok(foundTombstone, 'Tombstone da nota deletada deve ser retornado para os clientes');
    assert.equal(foundTombstone.entity_type, 'note');
  });
});
