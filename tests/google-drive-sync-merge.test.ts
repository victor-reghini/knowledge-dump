import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { server } from '../server/index.js';
import { db } from '../server/db.js';
import {
  computeAcervoHash,
  generateBackupPackage,
  uploadToGoogleDrive,
  syncGoogleDriveBackup,
  getLatestGoogleDriveBackup,
  mergeBackupPackageIntoDatabase,
  clearMockGoogleDriveStore,
  mockGoogleDriveStore
} from '../server/backup.js';

describe('Sincronização com Google Drive: Validação por Hash e Combinação de Dados', () => {
  const testUserId = `user-sync-test-${Date.now()}`;

  beforeEach(() => {
    clearMockGoogleDriveStore();
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, 'hash', 'Test User')
    `).run(testUserId, `user_${testUserId}`);
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM folders WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM bookmarks WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)').run(testUserId);
  });

  test('1. computeAcervoHash gera o mesmo hash para estados idênticos e hash diferente ao alterar dados', () => {
    // Insere categoria e nota
    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(`cat-1-${testUserId}`, testUserId, 'Categoria Teste', '#eab308', 'folder');

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, file_type, is_favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'docx', 0, '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(`note-1-${testUserId}`, testUserId, 'Nota Inicial', 'Conteúdo inicial da nota', `cat-1-${testUserId}`);

    const hash1 = computeAcervoHash(testUserId);
    const hash2 = computeAcervoHash(testUserId);
    assert.equal(hash1, hash2, 'Hash deve ser 100% determinístico para o mesmo estado');

    // Edita o conteúdo da nota
    db.prepare(`
      UPDATE notes SET content = ?, updated_at = '2026-10-19T10:05:00.000Z' WHERE id = ?
    `).run('Conteúdo alterado da nota', `note-1-${testUserId}`);

    const hash3 = computeAcervoHash(testUserId);
    assert.notEqual(hash1, hash3, 'Hash deve mudar quando qualquer nota ou entidade for alterada');
  });

  test('2. Sincronização inicial quando a nuvem está vazia envia o primeiro backup', async () => {
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(`note-init-${testUserId}`, testUserId, 'Nota Nuvem Vazia', 'Conteúdo A');

    const res = await syncGoogleDriveBackup(testUserId, 'mock-token');

    assert.equal(res.success, true);
    assert.equal(res.action, 'pushed_initial');
    assert.ok(res.hash);
    assert.ok(res.file.fileId);
    assert.equal(mockGoogleDriveStore.length, 1);
  });

  test('3. Sincronização com dados iguais não envia backup redundante (validação por hash)', async () => {
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(`note-same-${testUserId}`, testUserId, 'Nota Igual', 'Conteúdo Igual');

    // Primeira sincronização -> realiza upload
    const firstSync = await syncGoogleDriveBackup(testUserId, 'mock-token');
    assert.equal(firstSync.action, 'pushed_initial');
    assert.equal(mockGoogleDriveStore.length, 1);

    // Segunda sincronização sem alterações -> deve validar hash e ignorar envio
    const secondSync = await syncGoogleDriveBackup(testUserId, 'mock-token');
    assert.equal(secondSync.success, true);
    assert.equal(secondSync.action, 'in_sync');
    assert.equal(secondSync.skipped, true);
    assert.equal(secondSync.reason, 'identical_data');
    assert.equal(secondSync.hash, firstSync.hash);
    // Nenhuma nova gravação no mock Google Drive
    assert.equal(mockGoogleDriveStore.length, 1, 'Não deve adicionar novo arquivo no Drive se dados são iguais');
  });

  test('4. Quando há diferenças entre local e nuvem, o sistema combina os dados sem sobrescrever', async () => {
    const cloudUserId = `user-cloud-${Date.now()}`;
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, 'hash', 'Cloud User')
    `).run(cloudUserId, `cloud_${cloudUserId}`);

    // Cria nota A no acervo do usuário (local)
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T09:00:00.000Z', '2026-10-19T09:00:00.000Z')
    `).run(`note-local-${testUserId}`, testUserId, 'Nota Criada Localmente', 'Conteúdo exclusivo local');

    // Simula que na nuvem existe um backup contendo Nota B (criada em outro dispositivo)
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T09:30:00.000Z', '2026-10-19T09:30:00.000Z')
    `).run(`note-cloud-${cloudUserId}`, cloudUserId, 'Nota Criada na Nuvem', 'Conteúdo exclusivo da nuvem');

    // Gera pacote da nuvem e envia para o mock drive
    const cloudPkg = await generateBackupPackage(cloudUserId);
    await uploadToGoogleDrive(cloudPkg.buffer, 'cloud-backup.zip', 'mock-token', cloudPkg.hash);

    // Remove a nota da nuvem do banco local para simular que o dispositivo local ainda não a possui
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(cloudUserId);

    assert.equal(mockGoogleDriveStore.length, 1);

    // Agora executa a sincronização para o testUserId (que só tem Nota A)
    const syncRes = await syncGoogleDriveBackup(testUserId, 'mock-token');

    assert.equal(syncRes.success, true);
    // Como os dados eram diferentes e local tinha Nota A, deve ter mesclado e enviado o pacote unificado
    assert.equal(syncRes.action, 'merged_and_pushed');
    assert.ok(syncRes.mergeStats);
    assert.ok(syncRes.mergeStats.notes_added >= 1);

    // Valida que o banco local agora possui AMBAS as notas (combinadas!)
    const localNoteA = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(`note-local-${testUserId}`) as any;
    const localNoteB = db.prepare('SELECT id, title FROM notes WHERE id = ?').get(`note-cloud-${cloudUserId}`) as any;

    assert.ok(localNoteA, 'Nota criada localmente NÃO deve ter sido apagada');
    assert.equal(localNoteA.title, 'Nota Criada Localmente');
    assert.ok(localNoteB, 'Nota da nuvem deve ter sido adicionada ao banco local');
    assert.equal(localNoteB.title, 'Nota Criada na Nuvem');
  });

  test('5. Atualização inteligente de nota existente: timestamp mais recente vence e tags são mesclados', async () => {
    const noteId = `note-conflict-${testUserId}`;

    // 1. Cria a nota na versão atualizada da nuvem
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T08:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(noteId, testUserId, 'Título Atualizado na Nuvem', 'Versão mais nova da nuvem');

    const cloudPkg = await generateBackupPackage(testUserId);
    await uploadToGoogleDrive(cloudPkg.buffer, 'cloud-backup.zip', 'mock-token', cloudPkg.hash);

    // 2. Agora simula que localmente o banco está desatualizado (versão anterior às 08:00)
    db.prepare(`
      UPDATE notes
      SET title = ?, content = ?, updated_at = '2026-10-19T08:00:00.000Z'
      WHERE id = ?
    `).run('Título Antigo Local', 'Versão antiga local', noteId);

    // 3. Executa sincronização -> deve consultar a nuvem, ver que a nuvem é mais nova e atualizar localmente
    const syncRes = await syncGoogleDriveBackup(testUserId, 'mock-token');

    assert.equal(syncRes.success, true);
    assert.equal(syncRes.action, 'pulled');

    const updatedNote = db.prepare('SELECT id, title, content FROM notes WHERE id = ?').get(noteId) as any;
    assert.equal(updatedNote.title, 'Título Atualizado na Nuvem');
    assert.equal(updatedNote.content, 'Versão mais nova da nuvem');
  });

  test('6. Endpoint POST /api/backup/google-drive/sync executa sincronização e valida hash via HTTP', async () => {
    await server.ready();

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(`note-http-${testUserId}`, testUserId, 'Nota HTTP Teste', 'Conteúdo HTTP');

    // Primeira sincronização -> realiza envio
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/sync',
      headers: { 'x-user-id': testUserId },
      payload: { access_token: 'mock-token' }
    });

    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.equal(body1.success, true);
    assert.equal(body1.action, 'pushed_initial');
    assert.ok(body1.hash);

    // Segunda chamada sem alterações -> skipped: true, reason: identical_data
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/sync',
      headers: { 'x-user-id': testUserId },
      payload: { access_token: 'mock-token' }
    });

    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.success, true);
    assert.equal(body2.action, 'in_sync');
    assert.equal(body2.skipped, true);
    assert.equal(body2.reason, 'identical_data');
  });

  test('7. Endpoint POST /api/backup/google-drive/upload ignora envio se dados já são idênticos', async () => {
    await server.ready();

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'docx', '2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')
    `).run(`note-up-${testUserId}`, testUserId, 'Nota Upload Teste', 'Conteúdo Upload');

    // Primeiro upload -> envia normalmente
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/upload',
      headers: { 'x-user-id': testUserId },
      payload: { access_token: 'mock-token' }
    });

    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.equal(body1.success, true);

    // Segundo upload com dados inalterados -> valida hash e pula envio
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/upload',
      headers: { 'x-user-id': testUserId },
      payload: { access_token: 'mock-token' }
    });

    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.success, true);
    assert.equal(body2.skipped, true);
    assert.equal(body2.reason, 'identical_data');
  });

  test('8. Backups no Google Drive são vinculados à pasta Knowledge Dump Backups', async () => {
    const pkg = await generateBackupPackage(testUserId);
    const driveRes = await uploadToGoogleDrive(pkg.buffer, 'knowledge-dump-backup-test.zip', 'mock-token', pkg.hash);

    assert.equal(driveRes.folderName, 'Knowledge Dump Backups');
    assert.ok(mockGoogleDriveStore[0].parents?.includes('mock-folder-knowledge-dump-backups'));
  });

  test('9. Backups no Google Drive mantêm no máximo 3 arquivos (remove excedentes mais antigos)', async () => {
    clearMockGoogleDriveStore();
    const pkg = await generateBackupPackage(testUserId);

    // Envia 5 backups sucessivos
    for (let i = 1; i <= 5; i++) {
      await uploadToGoogleDrive(pkg.buffer, `knowledge-dump-backup-test-${i}.zip`, 'mock-token', `${pkg.hash}-${i}`);
    }

    // Deve manter no máximo 3 arquivos no store
    assert.equal(mockGoogleDriveStore.length, 3, 'Deve manter no máximo 3 backups no Google Drive');
    // Os backups mantidos devem ser os mais recentes (5, 4, 3)
    assert.equal(mockGoogleDriveStore[0].name, 'knowledge-dump-backup-test-5.zip');
    assert.equal(mockGoogleDriveStore[1].name, 'knowledge-dump-backup-test-4.zip');
    assert.equal(mockGoogleDriveStore[2].name, 'knowledge-dump-backup-test-3.zip');
  });
});
