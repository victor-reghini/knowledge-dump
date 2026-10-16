import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../server/db.js';
import { server } from '../server/index.js';
import { countFolderNotes } from '../src/components/FolderTree.js';
import { countCategoryNotes } from '../src/components/CategoryTree.js';
import { Folder, Category, Note, ReferenceFile } from '../src/types.js';

describe('Organização de Arquivos em Pastas e Categorias', () => {
  const testFolderId = `fld-test-${Date.now()}`;
  const testCategoryId = `cat-test-${Date.now()}`;
  const testRefId = `ref-test-${Date.now()}`;

  before(async () => {
    initDatabase();

    // Cria pasta de teste
    db.prepare(`
      INSERT INTO folders (id, name, parent_id, created_at, updated_at)
      VALUES (?, 'Pesquisa IA', NULL, datetime('now'), datetime('now'))
    `).run(testFolderId);

    // Cria categoria de teste
    db.prepare(`
      INSERT INTO categories (id, name, color, icon, parent_id, created_at)
      VALUES (?, 'Machine Learning', '#3b82f6', 'cpu', NULL, datetime('now'))
    `).run(testCategoryId);

    // Cria referência de teste inicial (sem pasta/categoria)
    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year)
      VALUES (?, NULL, 'Paper Hopfield 1982', 'references/hopfield1982_redes.tex', 'tex', 'John Hopfield', 1982)
    `).run(testRefId);

    await server.ready();
  });

  after(() => {
    try {
      db.prepare('DELETE FROM references_files WHERE id = ?').run(testRefId);
      db.prepare('DELETE FROM folders WHERE id = ?').run(testFolderId);
      db.prepare('DELETE FROM categories WHERE id = ?').run(testCategoryId);
    } catch (err) {
      console.error('Erro na limpeza:', err);
    }
  });

  // =========================================================================
  // CENÁRIO 1: Persistência e Associação de Pasta e Categoria em Arquivos
  // =========================================================================
  describe('Cenário 1: Atualização e Persistência de Pasta e Categoria em Arquivos (API & Banco)', () => {
    test('PUT /api/references/:id deve associar o arquivo a uma pasta e categoria', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: `/api/references/${testRefId}`,
        headers: { 'Content-Type': 'application/json' },
        payload: {
          folder_id: testFolderId,
          category_id: testCategoryId
        }
      });

      assert.equal(response.statusCode, 200);
      const data = JSON.parse(response.body);
      assert.equal(data.id, testRefId);
      assert.equal(data.folder_id, testFolderId);
      assert.equal(data.category_id, testCategoryId);
      assert.equal(data.folder_name, 'Pesquisa IA');
      assert.equal(data.category_name, 'Machine Learning');
      assert.equal(data.category_color, '#3b82f6');
    });

    test('GET /api/references deve retornar metadados expandidos com pasta e categoria', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references?folder_id=${testFolderId}`
      });

      assert.equal(response.statusCode, 200);
      const list = JSON.parse(response.body);
      assert.ok(Array.isArray(list));
      const found = list.find((r: any) => r.id === testRefId);
      assert.ok(found, 'Arquivo deve ser listado ao filtrar pela pasta');
      assert.equal(found.folder_name, 'Pesquisa IA');
      assert.equal(found.category_name, 'Machine Learning');
    });

    test('GET /api/references filtrando por categoria deve listar o arquivo', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references?category_id=${testCategoryId}`
      });

      assert.equal(response.statusCode, 200);
      const list = JSON.parse(response.body);
      const found = list.find((r: any) => r.id === testRefId);
      assert.ok(found, 'Arquivo deve ser listado ao filtrar pela categoria');
    });
  });

  // =========================================================================
  // CENÁRIO 2: Contagem Integrada de Notas e Arquivos nas Árvores de Pastas e Categorias
  // =========================================================================
  describe('Cenário 2: Contabilização Unificada de Notas e Arquivos nas Árvores', () => {
    test('countFolderNotes deve somar notas e arquivos de referência pertencentes à pasta', () => {
      const folders: Folder[] = [
        { id: 'f1', name: 'Artigos', parent_id: null, created_at: '', updated_at: '' },
        { id: 'f2', name: 'Sub-Artigos', parent_id: 'f1', created_at: '', updated_at: '' }
      ];

      const notes: Note[] = [
        { id: 'n1', title: 'Nota 1', content: '', category_id: null, folder_id: 'f1', is_favorite: 0, created_at: '', updated_at: '' }
      ];

      const refs: ReferenceFile[] = [
        { id: 'r1', title: 'PDF Livro', file_path: 'ref.pdf', file_type: 'pdf', folder_id: 'f1' },
        { id: 'r2', title: 'Artigo TeX', file_path: 'ref.tex', file_type: 'tex', folder_id: 'f2' }
      ];

      // A pasta f1 possui 1 nota e 1 arquivo diretamente, mais 1 arquivo na subpasta f2 -> total 3 itens
      const totalCount = countFolderNotes('f1', folders, notes, refs);
      assert.equal(totalCount, 3, 'Pasta raiz f1 deve somar 1 nota e 2 arquivos descendentes');

      const subCount = countFolderNotes('f2', folders, notes, refs);
      assert.equal(subCount, 1, 'Subpasta f2 deve contabilizar 1 arquivo');
    });

    test('countCategoryNotes deve somar notas e arquivos de referência pertencentes à categoria', () => {
      const categories: Category[] = [
        { id: 'c1', name: 'Computação', color: '#eab308', icon: 'folder', parent_id: null, created_at: '' }
      ];

      const notes: Note[] = [
        { id: 'n1', title: 'Nota A', content: '', category_id: 'c1', folder_id: null, is_favorite: 0, created_at: '', updated_at: '' },
        { id: 'n2', title: 'Nota B', content: '', category_id: 'c1', folder_id: null, is_favorite: 0, created_at: '', updated_at: '' }
      ];

      const refs: ReferenceFile[] = [
        { id: 'r1', title: 'Paper DOCX', file_path: 'ref.docx', file_type: 'docx', category_id: 'c1' }
      ];

      const catCount = countCategoryNotes('c1', categories, notes, refs);
      assert.equal(catCount, 3, 'Categoria c1 deve contabilizar 2 notas e 1 arquivo');
    });
  });

  // =========================================================================
  // CENÁRIO 3: Integridade Referencial e Preservação de Arquivos na Exclusão de Pasta
  // =========================================================================
  describe('Cenário 3: Integridade Referencial e Preservação de Arquivos ao Excluir Pastas', () => {
    test('Ao excluir pasta, arquivo deve permanecer no acervo com folder_id desvinculado (SET NULL)', () => {
      const tempFolderId = `fld-temp-${Date.now()}`;
      const tempRefId = `ref-temp-${Date.now()}`;

      // Cria pasta temporária e associa arquivo
      db.prepare("INSERT INTO folders (id, name, parent_id) VALUES (?, 'Temporária', NULL)").run(tempFolderId);
      db.prepare(`
        INSERT INTO references_files (id, user_id, title, file_path, file_type, folder_id)
        VALUES (?, NULL, 'Doc Teste Integridade', 'path.pdf', 'pdf', ?)
      `).run(tempRefId, tempFolderId);

      // Exclui a pasta
      db.prepare('DELETE FROM folders WHERE id = ?').run(tempFolderId);

      // O arquivo deve continuar existindo no banco
      const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get(tempRefId) as any;
      assert.ok(ref, 'Arquivo não deve ser excluído ao deletar pasta');

      // Limpeza
      db.prepare('DELETE FROM references_files WHERE id = ?').run(tempRefId);
    });
  });
});
