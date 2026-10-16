import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../server/db.js';
import { buildCategoryTree, countCategoryNotes } from '../src/components/CategoryTree.js';
import { buildFolderTree, countFolderNotes } from '../src/components/FolderTree.js';
import { Category, Folder, Note } from '../src/types.js';

describe('Gestão de Categorias, Subcategorias, Pastas e Subpastas', () => {
  // Test 1: Category Tree Hierarchy
  test('buildCategoryTree deve construir árvore hierárquica a partir de lista plana com parent_id', () => {
    const categories: Category[] = [
      { id: 'c1', name: 'Ciência da Computação', color: '#eab308', icon: 'code', parent_id: null, created_at: '' },
      { id: 'c2', name: 'Inteligência Artificial', color: '#3b82f6', icon: 'cpu', parent_id: 'c1', created_at: '' },
      { id: 'c3', name: 'Deep Learning', color: '#a855f7', icon: 'layers', parent_id: 'c2', created_at: '' },
      { id: 'c4', name: 'Filosofia', color: '#22c55e', icon: 'book', parent_id: null, created_at: '' }
    ];

    const tree = buildCategoryTree(categories);

    assert.equal(tree.length, 2, 'Devem existir 2 categorias raiz');
    assert.equal(tree[0].id, 'c1');
    assert.equal(tree[0].level, 0);
    assert.equal(tree[0].children.length, 1);

    const child = tree[0].children[0];
    assert.equal(child.id, 'c2');
    assert.equal(child.level, 1);
    assert.equal(child.children.length, 1);

    const grandChild = child.children[0];
    assert.equal(grandChild.id, 'c3');
    assert.equal(grandChild.level, 2);
    assert.equal(grandChild.children.length, 0);

    assert.equal(tree[1].id, 'c4');
    assert.equal(tree[1].level, 0);
  });

  test('countCategoryNotes deve contabilizar notas em categorias e em subcategorias descendentes', () => {
    const categories: Category[] = [
      { id: 'c1', name: 'Exatas', color: '#eab308', icon: 'folder', parent_id: null, created_at: '' },
      { id: 'c2', name: 'Física', color: '#3b82f6', icon: 'folder', parent_id: 'c1', created_at: '' }
    ];

    const notes: Note[] = [
      { id: 'n1', title: 'Nota 1', content: '', category_id: 'c1', folder_id: null, is_favorite: 0, created_at: '', updated_at: '' },
      { id: 'n2', title: 'Nota 2', content: '', category_id: 'c2', folder_id: null, is_favorite: 0, created_at: '', updated_at: '' },
      { id: 'n3', title: 'Nota 3', content: '', category_id: null, folder_id: null, is_favorite: 0, created_at: '', updated_at: '' }
    ];

    const countRoot = countCategoryNotes('c1', categories, notes);
    const countSub = countCategoryNotes('c2', categories, notes);

    assert.equal(countRoot, 2, 'Categoria raiz c1 deve somar notas de c1 e c2');
    assert.equal(countSub, 1, 'Subcategoria c2 deve ter 1 nota');
  });

  // Test 2: Database Category CRUD & Moving
  test('Categorias: deve permitir criar, atualizar (renomear, mudar cor e mover) e excluir', () => {
    initDatabase();

    const rootId = `test-cat-root-${Date.now()}`;
    const subId = `test-cat-sub-${Date.now()}`;

    // Create root
    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon, parent_id)
      VALUES (?, 'user-admin', 'Categoria Teste Raiz', '#eab308', 'folder', NULL)
    `).run(rootId);

    // Create subcategory
    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon, parent_id)
      VALUES (?, 'user-admin', 'Subcategoria Teste', '#3b82f6', 'folder', ?)
    `).run(subId, rootId);

    const sub = db.prepare('SELECT * FROM categories WHERE id = ?').get(subId) as { parent_id: string; name: string; color: string };
    assert.equal(sub.parent_id, rootId);
    assert.equal(sub.name, 'Subcategoria Teste');

    // Update / Move subcategory to root
    db.prepare('UPDATE categories SET name = ?, color = ?, parent_id = NULL WHERE id = ?').run(
      'Subcategoria Promovida a Raiz',
      '#22c55e',
      subId
    );

    const updatedSub = db.prepare('SELECT * FROM categories WHERE id = ?').get(subId) as { parent_id: string | null; name: string; color: string };
    assert.equal(updatedSub.parent_id, null, 'Deve ter sido promovida a raiz');
    assert.equal(updatedSub.name, 'Subcategoria Promovida a Raiz');
    assert.equal(updatedSub.color, '#22c55e');

    // Delete
    db.prepare('DELETE FROM categories WHERE id = ?').run(rootId);
    db.prepare('DELETE FROM categories WHERE id = ?').run(subId);

    assert.equal(db.prepare('SELECT * FROM categories WHERE id = ?').get(rootId), undefined);
    assert.equal(db.prepare('SELECT * FROM categories WHERE id = ?').get(subId), undefined);
  });

  // Test 3: Database Folder CRUD & Moving
  test('Pastas: deve permitir criar subpasta, renomear, mover para outra pasta e excluir', () => {
    initDatabase();

    const f1Id = `test-f1-${Date.now()}`;
    const f2Id = `test-f2-${Date.now()}`;
    const subId = `test-fsub-${Date.now()}`;

    db.prepare('INSERT INTO folders (id, user_id, name, parent_id) VALUES (?, ?, ?, ?)').run(f1Id, 'user-admin', 'Pasta 1', null);
    db.prepare('INSERT INTO folders (id, user_id, name, parent_id) VALUES (?, ?, ?, ?)').run(f2Id, 'user-admin', 'Pasta 2', null);
    db.prepare('INSERT INTO folders (id, user_id, name, parent_id) VALUES (?, ?, ?, ?)').run(subId, 'user-admin', 'Subpasta Inicial', f1Id);

    const insertedSub = db.prepare('SELECT * FROM folders WHERE id = ?').get(subId) as { parent_id: string };
    assert.equal(insertedSub.parent_id, f1Id);

    // Move to f2 and rename
    db.prepare('UPDATE folders SET name = ?, parent_id = ? WHERE id = ?').run('Subpasta Movida para F2', f2Id, subId);
    const movedSub = db.prepare('SELECT * FROM folders WHERE id = ?').get(subId) as { parent_id: string; name: string };
    assert.equal(movedSub.parent_id, f2Id);
    assert.equal(movedSub.name, 'Subpasta Movida para F2');

    // Delete folders
    db.prepare('DELETE FROM folders WHERE id = ?').run(subId);
    db.prepare('DELETE FROM folders WHERE id = ?').run(f1Id);
    db.prepare('DELETE FROM folders WHERE id = ?').run(f2Id);

    assert.equal(db.prepare('SELECT * FROM folders WHERE id = ?').get(subId), undefined);
  });
});
