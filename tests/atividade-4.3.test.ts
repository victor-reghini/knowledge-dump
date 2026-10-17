import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { server } from '../server/index.js';
import { db, recordTombstone } from '../server/db.js';
import { SyncPushPayload, SyncResponse, BackupDriveUploadResult } from '../src/types.js';

describe('Atividade 4.3: Homologação Mobile e Resiliência Offline (Cenário BDD 4)', () => {
  const testUserId = `user-mob-${Date.now()}`;
  const desktopClientId = 'desktop-mac-app';
  const mobileClientId = 'smartphone-pwa-client';

  const baseNoteId = `note-multi-${Date.now()}`;
  const baseCatId = `cat-multi-${Date.now()}`;
  const baseFoldId = `fold-multi-${Date.now()}`;

  let syncCheckpointTime = '';

  before(async () => {
    await server.ready();

    // 1. Cria usuário de teste
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name, gdrive_token, gdrive_auto_sync)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(testUserId, `mobile_user_${Date.now()}`, 'hash_test', 'Dra. Pesquisadora Mobile', 'mock-gdrive-token');

    // 2. Cria categoria, pasta e nota inicial compartilhada
    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `).run(baseCatId, testUserId, 'Pesquisa de Campo', '#10b981', 'compass');

    db.prepare(`
      INSERT INTO folders (id, user_id, name)
      VALUES (?, ?, ?)
    `).run(baseFoldId, testUserId, 'Coleta');

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, folder_id, is_favorite, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      baseNoteId,
      testUserId,
      'Hipótese Preliminar de Pesquisa',
      '# Hipótese\n\nTexto original digitado no laboratório.',
      baseCatId,
      baseFoldId,
      0,
      'docx'
    );

    // Registra timestamp inicial (levemente no passado para garantir delta pull preciso)
    syncCheckpointTime = new Date(Date.now() - 5000).toISOString();
  });

  after(() => {
    db.prepare('DELETE FROM bookmarks WHERE note_id = ?').run(baseNoteId);
    db.prepare('DELETE FROM sync_tombstones WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM folders WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM categories WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  // =========================================================================
  // CENÁRIO 4 BDD: Sincronização Multi-Dispositivo e Backup no Google Drive
  // =========================================================================
  describe('Cenário 4 BDD: Sincronização Multi-Dispositivo e Backup no Google Drive', () => {
    const newBookmarkId = `bm-desk-${Date.now()}`;
    const updatedTitle = 'Hipótese Preliminar de Pesquisa (Revisada no Desktop)';
    const updatedContent = '# Hipótese Revisada\n\nTexto atualizado no computador com novas evidências e [[Wikilink Teórico]].';

    test('Passo 1: Dado que o usuário alterou uma anotação e criou um marcador no computador conectado à internet', async () => {
      // Simula alteração do Desktop no servidor
      const updateRes = await server.inject({
        method: 'PUT',
        url: `/api/notes/${baseNoteId}`,
        headers: { 'x-user-id': testUserId },
        payload: {
          title: updatedTitle,
          content: updatedContent,
          is_favorite: 1
        }
      });
      assert.equal(updateRes.statusCode, 200);

      // Simula inserção de novo marcador contextual no Desktop
      const bookmarkRes = await server.inject({
        method: 'POST',
        url: '/api/bookmarks',
        headers: { 'x-user-id': testUserId },
        payload: {
          id: newBookmarkId,
          note_id: baseNoteId,
          title: 'Revisar Citação Bibliográfica',
          comment: 'Verificar se confere com o paper original',
          color: '#f59e0b'
        }
      });
      assert.equal(bookmarkRes.statusCode, 200);
    });

    test('Passo 2: Quando o usuário abrir o aplicativo no smartphone após a sincronização (delta pull)', async () => {
      // Smartphone requisita sincronização passando seu último timestamp conhecido
      const syncRes = await server.inject({
        method: 'POST',
        url: '/api/sync',
        headers: { 'x-user-id': testUserId },
        payload: {
          client_id: mobileClientId,
          last_synced_at: syncCheckpointTime,
          changes: {}
        }
      });

      assert.equal(syncRes.statusCode, 200);
      const syncBody = JSON.parse(syncRes.body) as SyncResponse;

      // Passo 3: Então as edições e novos marcadores devem estar refletidos no dispositivo móvel
      const receivedNote = syncBody.delta.notes.find(n => n.id === baseNoteId);
      assert.ok(receivedNote, 'Anotação editada deve vir no delta para o smartphone');
      assert.equal(receivedNote.title, updatedTitle);
      assert.equal(receivedNote.content, updatedContent);

      const receivedBookmark = syncBody.delta.bookmarks.find(b => b.id === newBookmarkId);
      assert.ok(receivedBookmark, 'Novo marcador criado no desktop deve vir no delta para o smartphone');
      assert.equal(receivedBookmark.title, 'Revisar Citação Bibliográfica');
      assert.equal(receivedBookmark.note_id, baseNoteId);
    });

    test('Passo 3: E ao solicitar "Backup Geral com Envio para Google Drive", o sistema deve autenticar, compactar e confirmar upload na nuvem', async () => {
      // Smartphone aciona upload do backup no Google Drive (usando token salvo do usuário)
      const uploadRes = await server.inject({
        method: 'POST',
        url: '/api/backup/google-drive/upload',
        headers: { 'x-user-id': testUserId },
        payload: {} // fallback para gdrive_token do banco
      });

      assert.equal(uploadRes.statusCode, 200);
      const uploadBody = JSON.parse(uploadRes.body) as BackupDriveUploadResult;

      assert.equal(uploadBody.success, true);
      assert.ok(uploadBody.file.fileId.startsWith('gdrive-mock-'));
      assert.ok(uploadBody.file.name.endsWith('.zip'));
      assert.ok(uploadBody.file.name.startsWith('knowledge-dump-backup-'));
      assert.ok(uploadBody.file.size > 0);
      assert.ok(uploadBody.file.webViewLink?.includes('drive.google.com'));

      // Valida integridade do manifesto gerado no acervo compactado
      assert.equal(uploadBody.manifest.user_id, testUserId);
      assert.equal(uploadBody.manifest.format, 'universal-markdown-yaml-zip');
      assert.ok(uploadBody.manifest.counts.notes >= 1);
      assert.ok(uploadBody.manifest.counts.bookmarks >= 1);
    });
  });

  // =========================================================================
  // CENÁRIO 2: Resiliência Offline & Resolução de Conflitos Last-Write-Wins (LWW)
  // =========================================================================
  describe('Resiliência Offline & Resolução de Conflitos LWW (RNF-07, RN-06)', () => {
    test('4.3.1: Em caso de edição concorrente offline, regra LWW preserva a versão com timestamp mais recente', async () => {
      const conflictNoteId = `note-conf-${Date.now()}`;

      // Inserção inicial no servidor
      db.prepare(`
        INSERT INTO notes (id, user_id, title, content, updated_at)
        VALUES (?, ?, ?, ?, '2026-10-17T12:00:00.000Z')
      `).run(conflictNoteId, testUserId, 'Nota Concorrente Original', 'Versão 0');

      // Desktop edita no servidor com timestamp 12:05:00
      db.prepare(`
        UPDATE notes
        SET title = 'Versão Desktop Mais Recente',
            content = 'Conteúdo do Desktop com timestamps mais avançados',
            updated_at = '2026-10-17T12:05:00.000Z'
        WHERE id = ?
      `).run(conflictNoteId);

      // Mobile tenta enviar alteração offline antiga com timestamp 12:02:00
      const pushPayload: SyncPushPayload = {
        client_id: mobileClientId,
        last_synced_at: '2026-10-17T12:00:00.000Z',
        changes: {
          notes: [
            {
              id: conflictNoteId,
              title: 'Versão Mobile Mais Antiga',
              content: 'Conteúdo mais antigo digitado offline',
              created_at: '2026-10-17T12:00:00.000Z',
              updated_at: '2026-10-17T12:02:00.000Z'
            }
          ]
        }
      };

      const syncRes = await server.inject({
        method: 'POST',
        url: '/api/sync',
        headers: { 'x-user-id': testUserId },
        payload: pushPayload
      });

      assert.equal(syncRes.statusCode, 200);
      const syncBody = JSON.parse(syncRes.body) as SyncResponse;

      // Deve catalogar conflito
      assert.ok(syncBody.applied.conflicts.length > 0, 'Deve reportar conflito resolvido por LWW');
      const conflict = syncBody.applied.conflicts.find(c => c.entity_id === conflictNoteId);
      assert.ok(conflict);
      assert.equal(conflict.reason, 'server_newer');

      // No banco de dados, o título do Desktop prevalece
      const dbRow = db.prepare('SELECT title, content FROM notes WHERE id = ?').get(conflictNoteId) as any;
      assert.equal(dbRow.title, 'Versão Desktop Mais Recente');

      // Limpeza
      db.prepare('DELETE FROM notes WHERE id = ?').run(conflictNoteId);
    });

    test('4.3.2: Propagação de tombstones: item excluído no computador gera registro para remoção no smartphone', async () => {
      const deleteNoteId = `note-del-${Date.now()}`;

      // Cria e depois remove a nota no servidor gerando tombstone
      db.prepare(`
        INSERT INTO notes (id, user_id, title, content)
        VALUES (?, ?, 'Nota a ser Apagada', 'Conteúdo temporário')
      `).run(deleteNoteId, testUserId);

      // Simula exclusão através do endpoint ou função recordTombstone
      recordTombstone('note', deleteNoteId, testUserId);
      db.prepare('DELETE FROM notes WHERE id = ?').run(deleteNoteId);

      // Smartphone realiza delta pull
      const pullRes = await server.inject({
        method: 'POST',
        url: '/api/sync',
        headers: { 'x-user-id': testUserId },
        payload: {
          client_id: mobileClientId,
          last_synced_at: syncCheckpointTime,
          changes: {}
        }
      });

      assert.equal(pullRes.statusCode, 200);
      const pullBody = JSON.parse(pullRes.body) as SyncResponse;

      // Valida entrega do tombstone no delta
      const tomb = pullBody.tombstones.find(t => t.entity_id === deleteNoteId);
      assert.ok(tomb, 'Tombstone da nota excluída deve ser entregue ao smartphone');
      assert.equal(tomb.entity_type, 'note');
    });
  });

  // =========================================================================
  // CENÁRIO 3: Homologação PWA, Service Worker e Especificações de Mobile
  // =========================================================================
  describe('Homologação PWA Mobile & Service Worker (RNF-07)', () => {
    test('4.3.3: dist/manifest.webmanifest deve conter configuração completa de PWA instalável móvel', () => {
      const manifestPath = path.resolve(process.cwd(), 'dist/manifest.webmanifest');
      assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest deve existir na pasta dist');

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(manifest.display, 'standalone', 'Display mode deve ser standalone para tela cheia móvel');
      assert.equal(manifest.start_url, '/', 'start_url deve ser raiz');
      assert.ok(manifest.name.includes('Knowledge Dump'));
      assert.ok(manifest.short_name);
      assert.ok(manifest.theme_color);
      assert.ok(manifest.background_color);
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
    });

    test('4.3.4: dist/sw.js deve conter lógica de precache e estratégias de Service Worker offline', () => {
      const swPath = path.resolve(process.cwd(), 'dist/sw.js');
      assert.ok(fs.existsSync(swPath), 'sw.js deve existir na pasta dist');

      const swContent = fs.readFileSync(swPath, 'utf8');
      assert.ok(swContent.length > 50, 'sw.js deve possuir lógica de interceptação de requisições');
    });

    test('4.3.5: index.html deve conter meta tags essenciais para iOS Safari e Android Chrome', () => {
      const indexPath = path.resolve(process.cwd(), 'index.html');
      assert.ok(fs.existsSync(indexPath), 'index.html deve existir na raiz');

      const indexContent = fs.readFileSync(indexPath, 'utf8');
      assert.ok(indexContent.includes('apple-mobile-web-app-capable'), 'Deve conter suporte a web app no iOS');
      assert.ok(indexContent.includes('viewport'), 'Deve conter configuração de viewport');
      assert.ok(indexContent.includes('theme-color'), 'Deve conter cor de tema para barra de status');
    });

    test('4.3.6: src/index.css deve possuir regras de responsividade mobile (@media max-width: 768px)', () => {
      const cssPath = path.resolve(process.cwd(), 'src/index.css');
      assert.ok(fs.existsSync(cssPath), 'index.css deve existir');

      const cssContent = fs.readFileSync(cssPath, 'utf8');
      assert.ok(cssContent.includes('@media (max-width: 768px)'), 'Deve conter media query para telas mobile');
      assert.ok(cssContent.includes('z-index: 999'), 'Sidebar no mobile deve atuar como overlay elevado');
      assert.ok(cssContent.includes('touch-action: manipulation'), 'Botões móveis devem ter toque otimizado');
    });
  });
});
