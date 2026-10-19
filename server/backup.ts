import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, DATA_DIR, hasFts5 } from './db.js';
import { packZipEntries, extractZipEntries } from './docx.js';

export interface BackupManifest {
  knowledge_dump_version: string;
  backup_created_at: string;
  user_id: string;
  data_hash?: string;
  counts: {
    notes: number;
    references: number;
    categories: number;
    folders: number;
    bookmarks: number;
    articles: number;
    study_plans: number;
  };
  format: 'universal-markdown-yaml-zip';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'item';
}

function formatYamlFrontmatter(data: Record<string, any>): string {
  const lines = ['---'];
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.map(item => JSON.stringify(item)).join(', ')}]`);
    } else if (typeof val === 'string') {
      lines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Calcula um hash SHA-256 determinístico de todo o acervo do usuário (notas, categorias, pastas, marcadores e referências)
 */
export function computeAcervoHash(userId: string = 'user-admin'): string {
  const notes = db.prepare(`
    SELECT n.id, n.title, n.content, n.category_id, n.folder_id, n.file_type, n.is_favorite, n.updated_at
    FROM notes n
    WHERE n.user_id = ? OR n.user_id IS NULL
    ORDER BY n.id ASC
  `).all(userId) as any[];

  for (const n of notes) {
    const tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
      ORDER BY t.name ASC
    `).all(n.id) as Array<{ name: string }>;
    n.tags = tags.map(t => t.name);
  }

  const categories = db.prepare(`
    SELECT id, name, color, icon, parent_id, updated_at
    FROM categories
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY id ASC
  `).all(userId) as any[];

  const folders = db.prepare(`
    SELECT id, name, parent_id, updated_at
    FROM folders
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY id ASC
  `).all(userId) as any[];

  const bookmarks = db.prepare(`
    SELECT b.id, b.note_id, b.reference_id, b.title, b.page_or_pos, b.comment, b.color, b.updated_at
    FROM bookmarks b
    LEFT JOIN notes n ON b.note_id = n.id
    WHERE n.user_id = ? OR n.user_id IS NULL OR b.note_id IS NULL
    ORDER BY b.id ASC
  `).all(userId) as any[];

  const references = db.prepare(`
    SELECT id, title, file_path, file_type, authors, year, doi, folder_id, category_id, updated_at
    FROM references_files
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY id ASC
  `).all(userId) as any[];

  const payload = JSON.stringify({
    notes,
    categories,
    folders,
    bookmarks,
    references
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Compila todo o acervo em um arquivo .ZIP universal padronizado (RN-06, RNF-08)
 */
export async function generateBackupPackage(userId: string = 'user-admin'): Promise<{
  buffer: Buffer;
  filename: string;
  manifest: BackupManifest;
  hash: string;
}> {
  const timestamp = new Date().toISOString();
  const dateSlug = timestamp.slice(0, 10);
  const timeSlug = timestamp.slice(11, 16).replace(':', '');
  const filename = `knowledge-dump-backup-${dateSlug}-${timeSlug}.zip`;

  // 1. Carrega dados do acervo para o usuário
  const notes = db.prepare(`
    SELECT n.*, c.name as category_name, f.name as folder_name
    FROM notes n
    LEFT JOIN categories c ON n.category_id = c.id
    LEFT JOIN folders f ON n.folder_id = f.id
    WHERE n.user_id = ? OR n.user_id IS NULL
    ORDER BY n.created_at ASC
  `).all(userId) as any[];

  const categories = db.prepare(`
    SELECT * FROM categories
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY name ASC
  `).all(userId) as any[];

  const folders = db.prepare(`
    SELECT * FROM folders
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY name ASC
  `).all(userId) as any[];

  const bookmarks = db.prepare(`
    SELECT b.*, n.title as note_title
    FROM bookmarks b
    LEFT JOIN notes n ON b.note_id = n.id
    WHERE n.user_id = ? OR n.user_id IS NULL OR b.note_id IS NULL
    ORDER BY b.created_at ASC
  `).all(userId) as any[];

  const references = db.prepare(`
    SELECT * FROM references_files
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY title ASC
  `).all(userId) as any[];

  const citations = db.prepare(`
    SELECT c.*, rf.title as reference_title, n.title as note_title
    FROM citations c
    JOIN notes n ON c.note_id = n.id
    JOIN references_files rf ON c.reference_id = rf.id
    WHERE n.user_id = ? OR n.user_id IS NULL
  `).all(userId) as any[];

  let articles: any[] = [];
  try {
    articles = db.prepare(`
      SELECT * FROM articles
      WHERE user_id = ? OR user_id IS NULL
      ORDER BY created_at ASC
    `).all(userId) as any[];
  } catch {}

  let studyPlans: any[] = [];
  try {
    studyPlans = db.prepare(`
      SELECT * FROM study_plans
      WHERE user_id = ? OR user_id IS NULL
      ORDER BY created_at ASC
    `).all(userId) as any[];
  } catch {}

  const entries: Record<string, Buffer> = {};

  // 2. Processa notas -> arquivos Markdown universais com Frontmatter e metadados JSON
  const usedNoteFilenames = new Set<string>();
  const notesWithTags = notes.map((note) => {
    const tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
      ORDER BY t.name ASC
    `).all(note.id) as Array<{ name: string }>;
    const tagNames = tags.map(t => t.name);

    const frontmatter = formatYamlFrontmatter({
      id: note.id,
      title: note.title,
      category: note.category_name || null,
      folder: note.folder_name || null,
      file_type: note.file_type || 'docx',
      is_favorite: Boolean(note.is_favorite),
      tags: tagNames,
      created_at: note.created_at,
      updated_at: note.updated_at
    });

    const fileContent = `${frontmatter}\n\n${note.content || ''}\n`;
    const folderPrefix = note.folder_name ? `${sanitizeFilename(note.folder_name)}/` : '';
    let baseFilename = `notes/${folderPrefix}${sanitizeFilename(note.title)}.md`;

    // Evita colisão de nomes
    let counter = 1;
    while (usedNoteFilenames.has(baseFilename)) {
      baseFilename = `notes/${folderPrefix}${sanitizeFilename(note.title)}-${counter}.md`;
      counter++;
    }
    usedNoteFilenames.add(baseFilename);

    entries[baseFilename] = Buffer.from(fileContent, 'utf8');

    return {
      ...note,
      tags: tagNames
    };
  });

  // 3. Processa referências anexas (incluindo arquivo físico no disco se existir)
  for (const ref of references) {
    if (ref.file_path) {
      const resolvedPath = path.isAbsolute(ref.file_path)
        ? ref.file_path
        : path.resolve(DATA_DIR, ref.file_path);

      if (fs.existsSync(resolvedPath)) {
        try {
          const fileBuf = fs.readFileSync(resolvedPath);
          const zipRefPath = `references/${path.basename(ref.file_path)}`;
          entries[zipRefPath] = fileBuf;
        } catch (err) {
          console.warn(`[Backup] Falha ao ler arquivo anexo ${resolvedPath}:`, err);
        }
      }
    }
  }

  // 4. Processa artigos acadêmicos
  for (const art of articles) {
    let keywords: string[] = [];
    try {
      keywords = JSON.parse(art.keywords || '[]');
    } catch {}

    const artFrontmatter = formatYamlFrontmatter({
      id: art.id,
      title: art.title,
      subtitle: art.subtitle,
      status: art.status,
      target_venue: art.target_venue,
      keywords,
      created_at: art.created_at,
      updated_at: art.updated_at
    });

    const artContent = `${artFrontmatter}\n\n# ${art.title}\n${art.subtitle ? `*${art.subtitle}*\n\n` : ''}${art.abstract ? `> **Resumo**: ${art.abstract}\n\n` : ''}${art.content}\n`;
    entries[`articles/${sanitizeFilename(art.title)}.md`] = Buffer.from(artContent, 'utf8');
  }

  // 5. Metadados estruturados em JSON
  entries['metadata/notes.json'] = Buffer.from(JSON.stringify(notesWithTags, null, 2), 'utf8');
  entries['metadata/categories.json'] = Buffer.from(JSON.stringify(categories, null, 2), 'utf8');
  entries['metadata/folders.json'] = Buffer.from(JSON.stringify(folders, null, 2), 'utf8');
  entries['metadata/bookmarks.json'] = Buffer.from(JSON.stringify(bookmarks, null, 2), 'utf8');
  entries['metadata/references.json'] = Buffer.from(JSON.stringify(references, null, 2), 'utf8');
  entries['metadata/citations.json'] = Buffer.from(JSON.stringify(citations, null, 2), 'utf8');
  entries['metadata/study_plans.json'] = Buffer.from(JSON.stringify(studyPlans, null, 2), 'utf8');

  // 6. Calcula hash determinístico do acervo
  const dataHash = computeAcervoHash(userId);

  // 7. Manifesto do backup
  const manifest: BackupManifest = {
    knowledge_dump_version: '1.4.0',
    backup_created_at: timestamp,
    user_id: userId,
    data_hash: dataHash,
    counts: {
      notes: notes.length,
      references: references.length,
      categories: categories.length,
      folders: folders.length,
      bookmarks: bookmarks.length,
      articles: articles.length,
      study_plans: studyPlans.length
    },
    format: 'universal-markdown-yaml-zip'
  };

  entries['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');

  // 8. README.md explicativo
  const readme = `# Knowledge Dump - Pacote de Backup Geral do Acervo

**Gerado em:** ${timestamp}  
**Usuário:** ${userId}  
**Hash do Acervo:** ${dataHash}  
**Total de Itens:** ${notes.length} notas, ${references.length} documentos anexos, ${categories.length} categorias.

---

### Estrutura do Pacote
- \`/notes/\`: Anotações completas convertidas em Markdown aberto com cabeçalho YAML frontmatter. Podem ser importadas no Obsidian, Logseq, Foam ou qualquer editor universal (RN-06).
- \`/references/\`: Arquivos originais de referência (PDF, DOCX, LaTeX, vídeo, áudio, imagens).
- \`/articles/\`: Artigos científicos e ensaios redigidos no ambiente de escrita.
- \`/metadata/\`: Índices relacionais completos em formato JSON (notas, categorias, pastas, marcadores, citações e trilhas de estudo).
- \`manifest.json\`: Manifesto de validação de integridade contendo data_hash.

### Restauração
Para restaurar este acervo em uma nova instância do Knowledge Dump, coloque os arquivos de referência em \`./data/references\` ou utilize a sincronização/importação.
`;
  entries['README.md'] = Buffer.from(readme, 'utf8');

  const zipBuffer = packZipEntries(entries);

  return {
    buffer: zipBuffer,
    filename,
    manifest,
    hash: dataHash
  };
}

export const GOOGLE_DRIVE_BACKUP_FOLDER_NAME = 'Knowledge Dump Backups';
export const GOOGLE_DRIVE_MAX_BACKUPS = 3;

export interface MockDriveFile {
  fileId: string;
  name: string;
  webViewLink: string;
  size: number;
  buffer: Buffer;
  dataHash: string;
  createdTime: string;
  parents?: string[];
}

export const mockGoogleDriveStore: MockDriveFile[] = [];

export function clearMockGoogleDriveStore(): void {
  mockGoogleDriveStore.length = 0;
}

/**
 * Obtém ou cria a pasta "Knowledge Dump Backups" no Google Drive
 */
export async function getOrCreateBackupsFolder(accessToken: string): Promise<string> {
  if (!accessToken || !accessToken.trim()) return '';

  if (accessToken === 'mock-token' || accessToken === 'test-token' || process.env.NODE_ENV === 'test') {
    return 'mock-folder-knowledge-dump-backups';
  }

  try {
    // 1. Procura se a pasta já existe
    const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${GOOGLE_DRIVE_BACKUP_FOLDER_NAME}' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const data = (await searchRes.json()) as any;
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // 2. Não existe, cria a pasta
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: GOOGLE_DRIVE_BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Pasta de backups automáticos do Knowledge Dump'
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.warn(`[GoogleDrive] Falha ao criar pasta "${GOOGLE_DRIVE_BACKUP_FOLDER_NAME}": ${errText}`);
      return '';
    }

    const created = (await createRes.json()) as any;
    return created.id || '';
  } catch (err) {
    console.warn(`[GoogleDrive] Erro ao obter/criar pasta "${GOOGLE_DRIVE_BACKUP_FOLDER_NAME}":`, err);
    return '';
  }
}

/**
 * Remove backups antigos no Google Drive para manter no máximo keepCount (padrão 3)
 */
export async function pruneOldGoogleDriveBackups(
  accessToken: string,
  keepCount: number = GOOGLE_DRIVE_MAX_BACKUPS
): Promise<string[]> {
  if (!accessToken || !accessToken.trim()) return [];

  // Modo mock / ambiente de testes
  if (accessToken === 'mock-token' || accessToken === 'test-token' || process.env.NODE_ENV === 'test') {
    if (mockGoogleDriveStore.length <= keepCount) return [];
    const removed = mockGoogleDriveStore.splice(keepCount);
    return removed.map((f) => f.fileId);
  }

  try {
    const folderId = await getOrCreateBackupsFolder(accessToken).catch(() => '');
    const query = folderId
      ? `'${folderId}' in parents and name contains 'knowledge-dump-backup' and trashed = false`
      : "name contains 'knowledge-dump-backup' and trashed = false";
    const q = encodeURIComponent(query);
    const fields = encodeURIComponent('files(id,name,createdTime)');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=100&fields=${fields}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) return [];

    const data = (await res.json()) as any;
    const files: Array<{ id: string; name: string }> = data.files || [];
    if (files.length <= keepCount) return [];

    const toDelete = files.slice(keepCount);
    const deletedIds: string[] = [];
    for (const file of toDelete) {
      try {
        const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (delRes.ok || delRes.status === 204 || delRes.status === 404) {
          deletedIds.push(file.id);
        }
      } catch (delErr) {
        console.warn(`[GoogleDrive] Falha ao excluir backup antigo ${file.id} (${file.name}):`, delErr);
      }
    }
    return deletedIds;
  } catch (err) {
    console.warn('[GoogleDrive] Falha ao rotacionar backups antigos:', err);
    return [];
  }
}

/**
 * Envia o pacote de backup diretamente para a pasta "Knowledge Dump Backups" no Google Drive via REST API v3
 * e remove backups antigos para manter no máximo 3 arquivos
 */
export async function uploadToGoogleDrive(
  zipBuffer: Buffer,
  filename: string,
  accessToken: string,
  dataHash?: string
): Promise<{
  fileId: string;
  name: string;
  webViewLink?: string;
  size: number;
  dataHash?: string;
  folderId?: string;
  folderName?: string;
  deletedOldBackups?: string[];
}> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('Access Token do Google Drive não informado');
  }

  const folderId = await getOrCreateBackupsFolder(accessToken).catch(() => '');

  // Suporte a modo simulado/mock em ambiente de testes ou tokens de teste
  if (accessToken === 'mock-token' || accessToken === 'test-token' || process.env.NODE_ENV === 'test') {
    const fileId = `gdrive-mock-${Date.now()}`;
    const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
    const mockFile: MockDriveFile = {
      fileId,
      name: filename,
      webViewLink,
      size: zipBuffer.length,
      buffer: zipBuffer,
      dataHash: dataHash || '',
      createdTime: new Date().toISOString(),
      parents: folderId ? [folderId] : []
    };
    mockGoogleDriveStore.unshift(mockFile);
    const deletedOldBackups = await pruneOldGoogleDriveBackups(accessToken, GOOGLE_DRIVE_MAX_BACKUPS);
    return {
      fileId,
      name: filename,
      webViewLink,
      size: zipBuffer.length,
      dataHash: mockFile.dataHash,
      folderId,
      folderName: GOOGLE_DRIVE_BACKUP_FOLDER_NAME,
      deletedOldBackups
    };
  }

  const boundary = `-------KDBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: any = {
    name: filename,
    mimeType: 'application/zip',
    description: dataHash ? `Backup completo do acervo pessoal Knowledge Dump. kd_data_hash:${dataHash}` : 'Backup completo do acervo pessoal Knowledge Dump (notas, referências e metadados)'
  };
  if (dataHash) {
    metadata.appProperties = { kd_data_hash: dataHash };
  }
  if (folderId) {
    metadata.parents = [folderId];
  }

  const multipartRequestBody = Buffer.concat([
    Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/zip\r\n\r\n'
    ),
    zipBuffer,
    Buffer.from(closeDelimiter)
  ]);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink,appProperties,description,parents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(multipartRequestBody.length)
    },
    body: multipartRequestBody
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API retornou status ${res.status}: ${errorText}`);
  }

  const data = await res.json() as any;
  const deletedOldBackups = await pruneOldGoogleDriveBackups(accessToken, GOOGLE_DRIVE_MAX_BACKUPS);

  return {
    fileId: data.id,
    name: data.name || filename,
    webViewLink: data.webViewLink,
    size: Number(data.size || zipBuffer.length),
    dataHash: data.appProperties?.kd_data_hash || dataHash,
    folderId,
    folderName: GOOGLE_DRIVE_BACKUP_FOLDER_NAME,
    deletedOldBackups
  };
}

/**
 * Consulta o backup mais recente existente na pasta de backups do Google Drive
 */
export async function getLatestGoogleDriveBackup(
  accessToken: string
): Promise<{ fileId: string; name: string; webViewLink?: string; size: number; dataHash?: string | null; buffer?: Buffer } | null> {
  if (!accessToken || !accessToken.trim()) return null;

  if (accessToken === 'mock-token' || accessToken === 'test-token' || process.env.NODE_ENV === 'test') {
    if (mockGoogleDriveStore.length === 0) return null;
    const latest = mockGoogleDriveStore[0];
    return {
      fileId: latest.fileId,
      name: latest.name,
      webViewLink: latest.webViewLink,
      size: latest.size,
      dataHash: latest.dataHash,
      buffer: latest.buffer
    };
  }

  const folderId = await getOrCreateBackupsFolder(accessToken).catch(() => '');
  const query = folderId
    ? `'${folderId}' in parents and name contains 'knowledge-dump-backup' and trashed = false`
    : "name contains 'knowledge-dump-backup' and trashed = false";
  const q = encodeURIComponent(query);
  const fields = encodeURIComponent('files(id,name,size,webViewLink,createdTime,description,appProperties,md5Checksum)');
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=1&fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API retornou status ${res.status}: ${errorText}`);
  }

  const data = (await res.json()) as any;
  const file = data.files?.[0];
  if (!file) return null;

  const dataHash = file.appProperties?.kd_data_hash || file.description?.match(/kd_data_hash:([a-f0-9]+)/)?.[1] || null;

  return {
    fileId: file.id,
    name: file.name,
    webViewLink: file.webViewLink,
    size: Number(file.size || 0),
    dataHash
  };
}

/**
 * Baixa o binário de um backup específico no Google Drive
 */
export async function downloadFromGoogleDrive(fileId: string, accessToken: string): Promise<Buffer> {
  if (accessToken === 'mock-token' || accessToken === 'test-token' || process.env.NODE_ENV === 'test') {
    const found = mockGoogleDriveStore.find(f => f.fileId === fileId);
    if (found) return found.buffer;
    throw new Error(`Arquivo ${fileId} não encontrado no Google Drive simulado`);
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Google Drive download falhou com status ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export interface MergeStats {
  notes_added: number;
  notes_updated: number;
  notes_skipped: number;
  categories_added: number;
  categories_updated: number;
  folders_added: number;
  folders_updated: number;
  bookmarks_added: number;
  bookmarks_updated: number;
  references_added: number;
  references_updated: number;
}

/**
 * Combina os dados de um pacote ZIP de backup no banco de dados local sem sobrescrever cegamente
 */
export function mergeBackupPackageIntoDatabase(
  zipBuffer: Buffer,
  userId: string = 'user-admin'
): MergeStats {
  const entries = extractZipEntries(zipBuffer);
  const stats: MergeStats = {
    notes_added: 0,
    notes_updated: 0,
    notes_skipped: 0,
    categories_added: 0,
    categories_updated: 0,
    folders_added: 0,
    folders_updated: 0,
    bookmarks_added: 0,
    bookmarks_updated: 0,
    references_added: 0,
    references_updated: 0
  };

  // 1. Categorias
  if (entries['metadata/categories.json']) {
    try {
      const cats = JSON.parse(entries['metadata/categories.json'].toString('utf8'));
      if (Array.isArray(cats)) {
        for (const cat of cats) {
          if (!cat.id || !cat.name) continue;
          const existing = db.prepare('SELECT id, updated_at FROM categories WHERE id = ?').get(cat.id) as any;
          if (!existing) {
            db.prepare(`
              INSERT INTO categories (id, user_id, name, color, icon, parent_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(cat.id, userId, cat.name, cat.color || '#eab308', cat.icon || 'folder', cat.parent_id || null, cat.created_at || new Date().toISOString(), cat.updated_at || new Date().toISOString());
            stats.categories_added++;
          } else {
            const existingTime = new Date(existing.updated_at || 0).getTime();
            const incomingTime = new Date(cat.updated_at || 0).getTime();
            if (incomingTime > existingTime) {
              db.prepare(`
                UPDATE categories
                SET name = ?, color = ?, icon = ?, parent_id = ?, updated_at = ?
                WHERE id = ?
              `).run(cat.name, cat.color || '#eab308', cat.icon || 'folder', cat.parent_id || null, cat.updated_at || new Date().toISOString(), cat.id);
              stats.categories_updated++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Merge] Erro ao mesclar categorias:', err);
    }
  }

  // 2. Pastas
  if (entries['metadata/folders.json']) {
    try {
      const folders = JSON.parse(entries['metadata/folders.json'].toString('utf8'));
      if (Array.isArray(folders)) {
        for (const f of folders) {
          if (!f.id || !f.name) continue;
          const existing = db.prepare('SELECT id, updated_at FROM folders WHERE id = ?').get(f.id) as any;
          if (!existing) {
            db.prepare(`
              INSERT INTO folders (id, user_id, name, parent_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(f.id, userId, f.name, f.parent_id || null, f.created_at || new Date().toISOString(), f.updated_at || new Date().toISOString());
            stats.folders_added++;
          } else {
            const existingTime = new Date(existing.updated_at || 0).getTime();
            const incomingTime = new Date(f.updated_at || 0).getTime();
            if (incomingTime > existingTime) {
              db.prepare(`
                UPDATE folders
                SET name = ?, parent_id = ?, updated_at = ?
                WHERE id = ?
              `).run(f.name, f.parent_id || null, f.updated_at || new Date().toISOString(), f.id);
              stats.folders_updated++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Merge] Erro ao mesclar pastas:', err);
    }
  }

  // 3. Notas
  let incomingNotes: any[] = [];
  if (entries['metadata/notes.json']) {
    try {
      incomingNotes = JSON.parse(entries['metadata/notes.json'].toString('utf8'));
    } catch {}
  } else {
    // Fallback: parse notes/*.md or notes/**/*.md
    for (const [filePath, buf] of Object.entries(entries)) {
      if (filePath.startsWith('notes/') && filePath.endsWith('.md')) {
        const text = buf.toString('utf8');
        const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
        if (match) {
          const yamlBlock = match[1];
          const content = match[2].trim();
          const noteMeta: any = {};
          yamlBlock.split('\n').forEach(line => {
            const [k, ...vParts] = line.split(':');
            if (k && vParts.length > 0) {
              const rawVal = vParts.join(':').trim();
              try {
                noteMeta[k.trim()] = JSON.parse(rawVal);
              } catch {
                noteMeta[k.trim()] = rawVal;
              }
            }
          });
          if (noteMeta.id && noteMeta.title) {
            incomingNotes.push({
              id: noteMeta.id,
              title: noteMeta.title,
              content,
              file_type: noteMeta.file_type || 'docx',
              is_favorite: Boolean(noteMeta.is_favorite),
              category_id: noteMeta.category_id || null,
              folder_id: noteMeta.folder_id || null,
              tags: Array.isArray(noteMeta.tags) ? noteMeta.tags : [],
              created_at: noteMeta.created_at,
              updated_at: noteMeta.updated_at
            });
          }
        }
      }
    }
  }

  for (const note of incomingNotes) {
    if (!note.id || !note.title) continue;
    const existing = db.prepare('SELECT id, title, content, updated_at FROM notes WHERE id = ?').get(note.id) as any;
    const catId = note.category_id || null;
    const folderId = note.folder_id || null;
    const fileType = note.file_type || 'docx';
    const isFav = note.is_favorite ? 1 : 0;
    const content = note.content || '';

    if (!existing) {
      db.prepare(`
        INSERT INTO notes (id, user_id, title, content, category_id, folder_id, file_type, is_favorite, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        note.id,
        userId,
        note.title,
        content,
        catId,
        folderId,
        fileType,
        isFav,
        note.created_at || new Date().toISOString(),
        note.updated_at || new Date().toISOString()
      );
      if (hasFts5) {
        try {
          db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(note.id, note.title, content);
        } catch {}
      }
      if (Array.isArray(note.tags)) {
        for (const tagName of note.tags) {
          const trimmed = tagName.trim().toLowerCase();
          if (!trimmed) continue;
          db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(`tag-${trimmed}`, trimmed);
          const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: string } | undefined;
          if (tagRow) {
            db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(note.id, tagRow.id);
          }
        }
      }
      stats.notes_added++;
    } else {
      const existingTime = new Date(existing.updated_at || 0).getTime();
      const incomingTime = new Date(note.updated_at || 0).getTime();

      if (incomingTime > existingTime) {
        db.prepare(`
          UPDATE notes
          SET title = ?, content = ?, category_id = ?, folder_id = ?, file_type = ?, is_favorite = ?, updated_at = ?
          WHERE id = ?
        `).run(note.title, content, catId, folderId, fileType, isFav, note.updated_at || new Date().toISOString(), note.id);

        if (hasFts5) {
          try {
            db.prepare('DELETE FROM notes_fts WHERE note_id = ?').run(note.id);
            db.prepare('INSERT INTO notes_fts (note_id, title, content) VALUES (?, ?, ?)').run(note.id, note.title, content);
          } catch {}
        }
        if (Array.isArray(note.tags)) {
          db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(note.id);
          for (const tagName of note.tags) {
            const trimmed = tagName.trim().toLowerCase();
            if (!trimmed) continue;
            db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(`tag-${trimmed}`, trimmed);
            const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: string } | undefined;
            if (tagRow) {
              db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(note.id, tagRow.id);
            }
          }
        }
        stats.notes_updated++;
      } else {
        // Local é mais recente ou idêntico. Faz union dos tags para não perder tags adicionados
        if (Array.isArray(note.tags)) {
          for (const tagName of note.tags) {
            const trimmed = tagName.trim().toLowerCase();
            if (!trimmed) continue;
            db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(`tag-${trimmed}`, trimmed);
            const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: string } | undefined;
            if (tagRow) {
              db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(note.id, tagRow.id);
            }
          }
        }
        stats.notes_skipped++;
      }
    }
  }

  // 4. Marcadores
  if (entries['metadata/bookmarks.json']) {
    try {
      const bms = JSON.parse(entries['metadata/bookmarks.json'].toString('utf8'));
      if (Array.isArray(bms)) {
        for (const bm of bms) {
          if (!bm.id || !bm.title) continue;
          const existing = db.prepare('SELECT id, updated_at FROM bookmarks WHERE id = ?').get(bm.id) as any;
          if (!existing) {
            db.prepare(`
              INSERT INTO bookmarks (id, note_id, reference_id, title, page_or_pos, comment, color, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(bm.id, bm.note_id || null, bm.reference_id || null, bm.title, bm.page_or_pos || null, bm.comment || null, bm.color || '#eab308', bm.created_at || new Date().toISOString(), bm.updated_at || new Date().toISOString());
            stats.bookmarks_added++;
          } else {
            const existingTime = new Date(existing.updated_at || 0).getTime();
            const incomingTime = new Date(bm.updated_at || 0).getTime();
            if (incomingTime > existingTime) {
              db.prepare(`
                UPDATE bookmarks
                SET note_id = ?, reference_id = ?, title = ?, page_or_pos = ?, comment = ?, color = ?, updated_at = ?
                WHERE id = ?
              `).run(bm.note_id || null, bm.reference_id || null, bm.title, bm.page_or_pos || null, bm.comment || null, bm.color || '#eab308', bm.updated_at || new Date().toISOString(), bm.id);
              stats.bookmarks_updated++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Merge] Erro ao mesclar bookmarks:', err);
    }
  }

  // 5. Referências e arquivos físicos
  if (entries['metadata/references.json']) {
    try {
      const refs = JSON.parse(entries['metadata/references.json'].toString('utf8'));
      if (Array.isArray(refs)) {
        for (const ref of refs) {
          if (!ref.id || !ref.title) continue;

          // Se o arquivo existir no pacote ZIP, extrai para o disco se ainda não existir
          if (ref.file_path) {
            const zipKey = `references/${path.basename(ref.file_path)}`;
            if (entries[zipKey]) {
              const fullDiskPath = path.isAbsolute(ref.file_path)
                ? ref.file_path
                : path.resolve(DATA_DIR, ref.file_path);
              if (!fs.existsSync(fullDiskPath)) {
                try {
                  fs.mkdirSync(path.dirname(fullDiskPath), { recursive: true });
                  fs.writeFileSync(fullDiskPath, entries[zipKey]);
                } catch (err) {
                  console.warn(`[Merge] Falha ao extrair anexo ${ref.file_path}:`, err);
                }
              }
            }
          }

          const existing = db.prepare('SELECT id, updated_at FROM references_files WHERE id = ?').get(ref.id) as any;
          if (!existing) {
            db.prepare(`
              INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year, doi, folder_id, category_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              ref.id,
              userId,
              ref.title,
              ref.file_path,
              ref.file_type || 'pdf',
              ref.authors || null,
              ref.year || null,
              ref.doi || null,
              ref.folder_id || null,
              ref.category_id || null,
              ref.created_at || new Date().toISOString(),
              ref.updated_at || new Date().toISOString()
            );
            stats.references_added++;
          } else {
            const existingTime = new Date(existing.updated_at || 0).getTime();
            const incomingTime = new Date(ref.updated_at || 0).getTime();
            if (incomingTime > existingTime) {
              db.prepare(`
                UPDATE references_files
                SET title = ?, file_path = ?, file_type = ?, authors = ?, year = ?, doi = ?, folder_id = ?, category_id = ?, updated_at = ?
                WHERE id = ?
              `).run(
                ref.title,
                ref.file_path,
                ref.file_type || 'pdf',
                ref.authors || null,
                ref.year || null,
                ref.doi || null,
                ref.folder_id || null,
                ref.category_id || null,
                ref.updated_at || new Date().toISOString(),
                ref.id
              );
              stats.references_updated++;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Merge] Erro ao mesclar referências:', err);
    }
  }

  return stats;
}

/**
 * Executa o fluxo completo de sincronização inteligente com o Google Drive:
 * 1. Consulta backup na nuvem primeiro.
 * 2. Valida hash se os dados são iguais. Se forem iguais, não envia nada (skipped: true).
 * 3. Se forem diferentes, combina os dados locais com a nuvem e só depois envia o pacote atualizado.
 */
export async function syncGoogleDriveBackup(userId: string = 'user-admin', accessToken: string): Promise<{
  success: boolean;
  action: 'pushed_initial' | 'in_sync' | 'pulled' | 'merged_and_pushed';
  hash: string;
  skipped?: boolean;
  reason?: string;
  mergeStats?: MergeStats;
  file?: any;
}> {
  const localHashBefore = computeAcervoHash(userId);
  const latest = await getLatestGoogleDriveBackup(accessToken);

  // Caso 1: Ainda não existe nenhum backup no Google Drive -> realiza primeiro envio
  if (!latest) {
    const { buffer, filename, hash } = await generateBackupPackage(userId);
    const driveResult = await uploadToGoogleDrive(buffer, filename, accessToken, hash);
    return {
      success: true,
      action: 'pushed_initial',
      hash,
      file: driveResult
    };
  }

  let cloudBuffer: Buffer | null = latest.buffer || null;
  let cloudHash = latest.dataHash;

  // Se o hash não estiver nos metadados, baixa o arquivo para ler o manifest.json
  if (!cloudHash) {
    cloudBuffer = await downloadFromGoogleDrive(latest.fileId, accessToken);
    const entries = extractZipEntries(cloudBuffer);
    if (entries['manifest.json']) {
      try {
        const manifest = JSON.parse(entries['manifest.json'].toString('utf8'));
        cloudHash = manifest.data_hash || null;
      } catch {}
    }
  }

  // Caso 2: Hashes idênticos -> dados locais e nuvem são iguais, nenhuma alteração necessária
  if (cloudHash && cloudHash === localHashBefore) {
    return {
      success: true,
      action: 'in_sync',
      skipped: true,
      reason: 'identical_data',
      hash: localHashBefore,
      file: latest
    };
  }

  // Caso 3: Dados diferentes -> faz download do cloud backup e combina com o banco local primeiro
  if (!cloudBuffer) {
    cloudBuffer = await downloadFromGoogleDrive(latest.fileId, accessToken);
  }

  const mergeStats = mergeBackupPackageIntoDatabase(cloudBuffer, userId);
  const localHashAfter = computeAcervoHash(userId);

  // Se após a combinação o estado local for idêntico ao da nuvem (apenas puxamos novidades da nuvem):
  if (localHashAfter === cloudHash) {
    return {
      success: true,
      action: 'pulled',
      hash: localHashAfter,
      mergeStats,
      file: latest
    };
  }

  // Se o banco local possuía dados mais recentes ou novos itens que não estavam na nuvem,
  // envia o pacote combinado para a nuvem
  const { buffer, filename, hash } = await generateBackupPackage(userId);
  const driveResult = await uploadToGoogleDrive(buffer, filename, accessToken, hash);

  return {
    success: true,
    action: 'merged_and_pushed',
    hash,
    mergeStats,
    file: driveResult
  };
}
