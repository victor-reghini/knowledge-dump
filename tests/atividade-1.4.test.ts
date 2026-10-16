import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db, initDatabase, DATA_DIR, REFS_DIR } from '../server/db.js';
import { buildFolderTree, countFolderNotes } from '../src/components/FolderTree.js';
import { Folder, Note } from '../src/types.js';

describe('Atividade 1.4: Árvore de Pastas e Visualizador PDF com Deep-Link', () => {
  // Test 1: Folder Tree Hierarchy
  test('buildFolderTree deve construir árvore hierárquica a partir de lista plana com parent_id', () => {
    const folders: Folder[] = [
      { id: 'f1', name: 'Inteligência Artificial', parent_id: null, created_at: '', updated_at: '' },
      { id: 'f2', name: 'Modelos Conexionistas', parent_id: 'f1', created_at: '', updated_at: '' },
      { id: 'f3', name: 'Perceptrons', parent_id: 'f2', created_at: '', updated_at: '' },
      { id: 'f4', name: 'Matemática', parent_id: null, created_at: '', updated_at: '' }
    ];

    const tree = buildFolderTree(folders);

    assert.equal(tree.length, 2, 'Devem existir 2 pastas raiz');
    assert.equal(tree[0].id, 'f1');
    assert.equal(tree[0].level, 0);
    assert.equal(tree[0].children.length, 1);

    const child = tree[0].children[0];
    assert.equal(child.id, 'f2');
    assert.equal(child.level, 1);
    assert.equal(child.children.length, 1);

    const grandChild = child.children[0];
    assert.equal(grandChild.id, 'f3');
    assert.equal(grandChild.level, 2);
    assert.equal(grandChild.children.length, 0);

    assert.equal(tree[1].id, 'f4');
    assert.equal(tree[1].level, 0);
    assert.equal(tree[1].children.length, 0);
  });

  test('countFolderNotes deve contabilizar notas em pastas e em todas as suas subpastas descendentes', () => {
    const folders: Folder[] = [
      { id: 'f1', name: 'IA', parent_id: null, created_at: '', updated_at: '' },
      { id: 'f2', name: 'Redes', parent_id: 'f1', created_at: '', updated_at: '' }
    ];

    const notes: Note[] = [
      { id: 'n1', title: 'Nota 1', content: '', category_id: null, folder_id: 'f1', is_favorite: 0, created_at: '', updated_at: '' },
      { id: 'n2', title: 'Nota 2', content: '', category_id: null, folder_id: 'f2', is_favorite: 0, created_at: '', updated_at: '' },
      { id: 'n3', title: 'Nota 3', content: '', category_id: null, folder_id: null, is_favorite: 0, created_at: '', updated_at: '' }
    ];

    const countRoot = countFolderNotes('f1', folders, notes);
    const countSub = countFolderNotes('f2', folders, notes);

    assert.equal(countRoot, 2, 'Pasta raiz f1 deve somar notas de f1 e f2');
    assert.equal(countSub, 1, 'Subpasta f2 deve ter apenas 1 nota');
  });

  // Test 2: Database Schema & Seed Data
  test('initDatabase deve garantir referência do paper e citação com deep-link na página 7', () => {
    initDatabase();

    // Verify sample reference
    const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get('ref-rosenblatt-1958') as {
      id: string;
      title: string;
      file_path: string;
      authors: string;
      year: number;
    } | undefined;

    assert.ok(ref, 'Referência do Rosenblatt deve existir');
    assert.equal(ref.authors, 'Frank Rosenblatt');
    assert.equal(ref.year, 1958);

    // Verify PDF file exists on disk
    const pdfPath = path.isAbsolute(ref.file_path) ? ref.file_path : path.join(DATA_DIR, ref.file_path);
    assert.ok(fs.existsSync(pdfPath), `Arquivo PDF deve existir no disco em: ${pdfPath}`);
    const stat = fs.statSync(pdfPath);
    assert.ok(stat.size > 1000, 'Arquivo PDF deve ter tamanho válido');

    // Verify citation on page 7 (Cenário 2 BDD)
    const citation = db.prepare('SELECT * FROM citations WHERE reference_id = ?').get('ref-rosenblatt-1958') as {
      id: string;
      note_id: string;
      page_number: number;
      quote_text: string;
    } | undefined;

    assert.ok(citation, 'Citação vinculada ao paper deve existir');
    assert.equal(citation.page_number, 7, 'Citação deve apontar especificamente para a página 7');
    assert.match(citation.quote_text, /linearmente separável/i, 'Citação deve conter o texto chave do Cenário 2');

    // Verify note content contains the markdown deep link
    const note = db.prepare('SELECT content FROM notes WHERE id = ?').get('note-perceptron') as { content: string };
    assert.ok(note.content.includes('pdf://ref-rosenblatt-1958?page=7'), 'Nota Perceptron deve conter link deep-link para pág. 7');
  });

  // Test 3: Citation CRUD
  test('Citations: deve permitir criar e excluir nova citação vinculada a nota e página', () => {
    const citeId = `test-cite-${Date.now()}`;
    db.prepare(`
      INSERT INTO citations (id, note_id, reference_id, quote_text, page_number, anchor_data)
      VALUES (?, 'note-redes-neurais', 'ref-rosenblatt-1958', 'Trecho de teste selecionado no visualizador', 3, 'p=3')
    `).run(citeId);

    const inserted = db.prepare('SELECT * FROM citations WHERE id = ?').get(citeId) as { page_number: number; quote_text: string };
    assert.equal(inserted.page_number, 3);
    assert.equal(inserted.quote_text, 'Trecho de teste selecionado no visualizador');

    db.prepare('DELETE FROM citations WHERE id = ?').run(citeId);
    const afterDelete = db.prepare('SELECT * FROM citations WHERE id = ?').get(citeId);
    assert.equal(afterDelete, undefined);
  });
});
