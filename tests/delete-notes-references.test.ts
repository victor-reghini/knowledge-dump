import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { server } from '../server/index.js';
import { db, DATA_DIR, REFS_DIR } from '../server/db.js';

describe('Exclusão de Notas e Arquivos de Referência', () => {
  const testUserId = 'test-user-delete-suite';

  before(async () => {
    await server.ready();
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name, email)
      VALUES (?, 'deluser', 'hash123', 'Delete User', 'del@test.com')
    `).run(testUserId);
  });

  after(async () => {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    await server.close();
  });

  test('DELETE /api/notes/:id deve remover a nota e limpar dados associados', async () => {
    const noteId = `note-test-del-${Date.now()}`;
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content)
      VALUES (?, ?, 'Nota Temporaria', 'Conteudo para remocao')
    `).run(noteId, testUserId);

    db.prepare(`
      INSERT INTO bookmarks (id, note_id, title)
      VALUES (?, ?, 'Marcador da Nota')
    `).run(`bm-${noteId}`, noteId);

    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/notes/${noteId}`,
      headers: { 'x-user-id': testUserId }
    });

    assert.equal(delRes.statusCode, 200);
    const body = JSON.parse(delRes.body);
    assert.equal(body.success, true);

    const noteCheck = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId);
    assert.equal(noteCheck, undefined, 'Nota deve ser removida do banco de dados');

    const bmCheck = db.prepare('SELECT id FROM bookmarks WHERE note_id = ?').get(noteId);
    assert.equal(bmCheck, undefined, 'Marcadores vinculados à nota devem ser removidos');
  });

  test('DELETE /api/references/:id deve remover referência, citações e arquivo físico do disco', async () => {
    const refId = `ref-test-del-${Date.now()}`;
    const filename = `temp_del_${Date.now()}.txt`;
    const fullPath = path.join(REFS_DIR, filename);

    // Cria arquivo físico de teste
    fs.writeFileSync(fullPath, 'Conteudo do arquivo de referencia para exclusao');
    assert.ok(fs.existsSync(fullPath), 'Arquivo físico deve existir antes da exclusão');

    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type)
      VALUES (?, ?, 'Referencia Temporaria', ?, 'txt')
    `).run(refId, testUserId, `references/${filename}`);

    const delRes = await server.inject({
      method: 'DELETE',
      url: `/api/references/${refId}`,
      headers: { 'x-user-id': testUserId }
    });

    assert.equal(delRes.statusCode, 200);
    const body = JSON.parse(delRes.body);
    assert.equal(body.success, true);

    const refCheck = db.prepare('SELECT id FROM references_files WHERE id = ?').get(refId);
    assert.equal(refCheck, undefined, 'Referência deve ser removida da tabela references_files');

    assert.equal(fs.existsSync(fullPath), false, 'Arquivo físico no disco deve ser excluído');
  });
});
