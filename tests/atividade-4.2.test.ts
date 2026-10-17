import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';
import { db } from '../server/db.js';
import { generateBackupPackage, uploadToGoogleDrive } from '../server/backup.js';
import { extractZipEntries } from '../server/docx.js';
import { BackupStatus, BackupDriveUploadResult } from '../src/types.js';

describe('Atividade 4.2: Backup Geral com Upload Direto para o Google Drive', () => {
  const testUserId = `user-backup-${Date.now()}`;
  const testFolderId = `fold-bk-${Date.now()}`;
  const testCatId = `cat-bk-${Date.now()}`;
  const testNoteId = `note-bk-${Date.now()}`;

  before(async () => {
    await server.ready();

    // 1. Cria usuário de teste
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, `backup_user_${Date.now()}`, 'hash_test', 'Dra. Ada Lovelace');

    // 2. Cria pasta e categoria
    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `).run(testCatId, testUserId, 'História da Computação', '#eab308', 'book');

    db.prepare(`
      INSERT INTO folders (id, user_id, name)
      VALUES (?, ?, ?)
    `).run(testFolderId, testUserId, 'Pioneiros');

    // 3. Cria nota com tags e links
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, folder_id, is_favorite, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testNoteId,
      testUserId,
      'Motor Analítico e Algoritmo de Bernoulli',
      '# Motor Analítico\n\nPrimeiro algoritmo concebido para ser processado por máquina.',
      testCatId,
      testFolderId,
      1,
      'docx'
    );

    // Tags
    db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run('tag-algoritmo', 'algoritmo');
    db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run('tag-historia', 'historia');
    db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(testNoteId, 'tag-algoritmo');
    db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(testNoteId, 'tag-historia');

    // Marcador
    db.prepare(`
      INSERT INTO bookmarks (id, note_id, title, comment, color)
      VALUES (?, ?, ?, ?, ?)
    `).run(`bm-${Date.now()}`, testNoteId, 'Nota Histórica Central', 'Revisar cálculo dos números de Bernoulli', '#3b82f6');
  });

  after(() => {
    db.prepare('DELETE FROM bookmarks WHERE note_id = ?').run(testNoteId);
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(testNoteId);
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM folders WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  test('4.2.1: generateBackupPackage deve gerar buffer ZIP íntegro com formato universal (Markdown/YAML) e manifesto', async () => {
    const { buffer, filename, manifest } = await generateBackupPackage(testUserId);

    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 100);
    assert.ok(filename.endsWith('.zip'));
    assert.ok(filename.startsWith('knowledge-dump-backup-'));

    // Valida estrutura do manifesto
    assert.equal(manifest.user_id, testUserId);
    assert.equal(manifest.format, 'universal-markdown-yaml-zip');
    assert.ok(manifest.counts.notes >= 1);
    assert.ok(manifest.counts.categories >= 1);
    assert.ok(manifest.counts.folders >= 1);

    // Descompacta entradas do arquivo ZIP gerado
    const entries = extractZipEntries(buffer);
    const entryNames = Object.keys(entries);

    // Deve conter manifesto e README explicativo
    assert.ok(entryNames.includes('manifest.json'), 'ZIP deve conter manifest.json');
    assert.ok(entryNames.includes('README.md'), 'ZIP deve conter README.md');

    // Deve conter metadados em JSON
    assert.ok(entryNames.includes('metadata/categories.json'));
    assert.ok(entryNames.includes('metadata/folders.json'));
    assert.ok(entryNames.includes('metadata/bookmarks.json'));

    // Deve conter nota em formato Markdown universal
    const noteEntry = entryNames.find(name => name.startsWith('notes/') && name.endsWith('.md'));
    assert.ok(noteEntry, 'ZIP deve conter notas em pasta notes/*.md');

    const noteContent = entries[noteEntry!].toString('utf8');
    assert.ok(noteContent.startsWith('---'), 'Nota deve possuir YAML frontmatter');
    assert.ok(noteContent.includes(`id: "${testNoteId}"`));
    assert.ok(noteContent.includes('title: "Motor Analítico e Algoritmo de Bernoulli"'));
    assert.ok(noteContent.includes('category: "História da Computação"'));
    assert.ok(noteContent.includes('folder: "Pioneiros"'));
    assert.ok(noteContent.includes('Primeiro algoritmo concebido'));
  });

  test('4.2.2: Endpoint GET /api/backup/status deve retornar contadores e formato pronto para exportação', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/backup/status',
      headers: { 'x-user-id': testUserId }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as BackupStatus;
    assert.equal(body.status, 'ready');
    assert.equal(body.user_id, testUserId);
    assert.equal(body.format, 'zip');
    assert.ok(body.counts.notes >= 1);
    assert.ok(body.counts.categories >= 1);
    assert.ok(body.counts.folders >= 1);
    assert.ok(body.counts.bookmarks >= 1);
  });

  test('4.2.3: Endpoint GET /api/backup/download deve retornar arquivo binário compactado .zip para download local', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/backup/download',
      headers: { 'x-user-id': testUserId }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/zip');
    assert.ok(String(res.headers['content-disposition']).includes('attachment; filename="knowledge-dump-backup-'));
    assert.ok(res.rawPayload.length > 0);

    // Valida que o payload baixado é um ZIP válido descompactável
    const entries = extractZipEntries(res.rawPayload);
    assert.ok(entries['manifest.json']);
    const manifest = JSON.parse(entries['manifest.json'].toString('utf8'));
    assert.equal(manifest.user_id, testUserId);
  });

  test('4.2.4: Endpoint POST /api/backup/google-drive/upload deve validar falta de token e rejeitar com 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/upload',
      headers: { 'x-user-id': testUserId },
      payload: { access_token: '' }
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('Access Token do Google Drive não fornecido'));
  });

  test('4.2.5: Endpoint POST /api/backup/google-drive/upload com token válido deve realizar envio com sucesso e retornar ID do Drive', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/upload',
      headers: { 'x-user-id': testUserId },
      payload: { access_token: 'test-token' }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as BackupDriveUploadResult;
    assert.equal(body.success, true);
    assert.ok(body.file.fileId);
    assert.ok(body.file.name.endsWith('.zip'));
    assert.ok(body.file.size > 0);
    assert.ok(body.file.webViewLink?.includes('drive.google.com'));
    assert.equal(body.manifest.format, 'universal-markdown-yaml-zip');
  });

  test('4.2.6: uploadToGoogleDrive unitário com token mock deve gerar dados consistentes de arquivo no Drive', async () => {
    const sampleBuffer = Buffer.from('PK\x03\x04test-zip-content');
    const result = await uploadToGoogleDrive(sampleBuffer, 'teste-backup.zip', 'mock-token');

    assert.equal(result.name, 'teste-backup.zip');
    assert.ok(result.fileId.startsWith('gdrive-mock-'));
    assert.equal(result.size, sampleBuffer.length);
    assert.ok(result.webViewLink?.includes('drive.google.com'));
  });

  test('4.2.7: Endpoint POST /api/auth/google deve cadastrar/atualizar usuário Google e armazenar token OAuth', async () => {
    const googleEmail = `google_user_${Date.now()}@gmail.com`;
    const googleId = `gid-${Date.now()}`;
    const testToken = `oauth-token-${Date.now()}`;

    // 1. Rejeita se email não fornecido
    const failRes = await server.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { email: '' }
    });
    assert.equal(failRes.statusCode, 400);

    // 2. Cria conta vinculada com sucesso
    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: {
        email: googleEmail,
        name: 'Pesquisador Google Teste',
        google_id: googleId,
        access_token: testToken,
        avatar_url: 'https://lh3.googleusercontent.com/a/test'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.user);
    assert.equal(body.user.email, googleEmail);
    assert.equal(body.user.name, 'Pesquisador Google Teste');
    assert.equal(body.user.google_id, googleId);
    assert.equal(body.access_token, testToken);

    // Limpeza
    db.prepare('DELETE FROM users WHERE email = ?').run(googleEmail);
  });

  test('4.2.8: Endpoint POST /api/backup/google-drive/upload deve utilizar gdrive_token salvo no banco se omitido na requisição', async () => {
    const autoUserId = `user-auto-${Date.now()}`;
    const autoToken = `stored-token-${Date.now()}`;

    db.prepare(`
      INSERT INTO users (id, username, password_hash, name, email, gdrive_token, gdrive_auto_sync)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(autoUserId, `auto_${Date.now()}`, 'hash_test', 'Auto Sync User', `${autoUserId}@test.com`, autoToken);

    // Requisição SEM access_token no body: deve recuperar o autoToken do usuário
    const res = await server.inject({
      method: 'POST',
      url: '/api/backup/google-drive/upload',
      headers: { 'x-user-id': autoUserId },
      payload: {}
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.ok(body.file.fileId);

    // Limpeza
    db.prepare('DELETE FROM users WHERE id = ?').run(autoUserId);
  });
});
