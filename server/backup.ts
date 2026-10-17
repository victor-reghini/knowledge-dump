import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from './db.js';
import { packZipEntries } from './docx.js';

export interface BackupManifest {
  knowledge_dump_version: string;
  backup_created_at: string;
  user_id: string;
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
 * Compila todo o acervo em um arquivo .ZIP universal padronizado (RN-06, RNF-08)
 */
export async function generateBackupPackage(userId: string = 'user-admin'): Promise<{
  buffer: Buffer;
  filename: string;
  manifest: BackupManifest;
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

  // 2. Processa notas -> arquivos Markdown universais com Frontmatter
  const usedNoteFilenames = new Set<string>();
  for (const note of notes) {
    const tags = db.prepare(`
      SELECT t.name FROM tags t
      JOIN note_tags nt ON t.id = nt.tag_id
      WHERE nt.note_id = ?
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
  }

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
  entries['metadata/categories.json'] = Buffer.from(JSON.stringify(categories, null, 2), 'utf8');
  entries['metadata/folders.json'] = Buffer.from(JSON.stringify(folders, null, 2), 'utf8');
  entries['metadata/bookmarks.json'] = Buffer.from(JSON.stringify(bookmarks, null, 2), 'utf8');
  entries['metadata/references.json'] = Buffer.from(JSON.stringify(references, null, 2), 'utf8');
  entries['metadata/citations.json'] = Buffer.from(JSON.stringify(citations, null, 2), 'utf8');
  entries['metadata/study_plans.json'] = Buffer.from(JSON.stringify(studyPlans, null, 2), 'utf8');

  // 6. Manifesto do backup
  const manifest: BackupManifest = {
    knowledge_dump_version: '1.4.0',
    backup_created_at: timestamp,
    user_id: userId,
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

  // 7. README.md explicativo
  const readme = `# Knowledge Dump - Pacote de Backup Geral do Acervo

**Gerado em:** ${timestamp}  
**Usuário:** ${userId}  
**Total de Itens:** ${notes.length} notas, ${references.length} documentos anexos, ${categories.length} categorias.

---

### Estrutura do Pacote
- \`/notes/\`: Anotações completas convertidas em Markdown aberto com cabeçalho YAML frontmatter. Podem ser importadas no Obsidian, Logseq, Foam ou qualquer editor universal (RN-06).
- \`/references/\`: Arquivos originais de referência (PDF, DOCX, LaTeX, vídeo, áudio, imagens).
- \`/articles/\`: Artigos científicos e ensaios redigidos no ambiente de escrita.
- \`/metadata/\`: Índices relacionais completos em formato JSON (categorias, pastas, marcadores, citações e trilhas de estudo).
- \`manifest.json\`: Manifesto de validação de integridade.

### Restauração
Para restaurar este acervo em uma nova instância do Knowledge Dump, coloque os arquivos de referência em \`./data/references\` ou utilize a interface de importação.
`;
  entries['README.md'] = Buffer.from(readme, 'utf8');

  const zipBuffer = packZipEntries(entries);

  return {
    buffer: zipBuffer,
    filename,
    manifest
  };
}

/**
 * Envia o pacote de backup diretamente para a conta do usuário no Google Drive via REST API v3
 */
export async function uploadToGoogleDrive(
  zipBuffer: Buffer,
  filename: string,
  accessToken: string
): Promise<{ fileId: string; name: string; webViewLink?: string; size: number }> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('Access Token do Google Drive não informado');
  }

  // Suporte a modo simulado/mock em ambiente de testes ou tokens de teste
  if (accessToken === 'mock-token' || accessToken === 'test-token' || process.env.NODE_ENV === 'test') {
    return {
      fileId: `gdrive-mock-${Date.now()}`,
      name: filename,
      webViewLink: `https://drive.google.com/file/d/gdrive-mock-${Date.now()}/view`,
      size: zipBuffer.length
    };
  }

  const boundary = `-------KDBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    mimeType: 'application/zip',
    description: 'Backup completo do acervo pessoal Knowledge Dump (notas, referências e metadados)'
  };

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

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink', {
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
  return {
    fileId: data.id,
    name: data.name || filename,
    webViewLink: data.webViewLink,
    size: Number(data.size || zipBuffer.length)
  };
}
