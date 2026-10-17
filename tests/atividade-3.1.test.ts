import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../server/db.js';
import { server } from '../server/index.js';
import { GraphData, GraphNode, GraphLink } from '../src/types.js';

describe('Atividade 3.1: Mapa Interativo em Grafo (RF-32 e RF-33)', () => {
  const testUserId = `user-graph-${Date.now()}`;
  const catAiId = `cat-ai-${Date.now()}`;
  const catNeuroId = `cat-neuro-${Date.now()}`;
  const folderId = `folder-studies-${Date.now()}`;

  const note1Id = `note-perceptron-${Date.now()}`;
  const note2Id = `note-backprop-${Date.now()}`;
  const note3Id = `note-isolated-${Date.now()}`;

  const ref1Id = `ref-rosenblatt-${Date.now()}`;
  const ref2Id = `ref-hopfield-${Date.now()}`;

  const citation1Id = `cit-rosenblatt-${Date.now()}`;

  before(async () => {
    initDatabase();

    // 1. Criar usuário e categorias de teste
    db.prepare(`
      INSERT INTO users (id, username, password_hash, name)
      VALUES (?, ?, 'hash123', 'Pesquisador Grafo')
    `).run(testUserId, `pesquisador_${Date.now()}`);

    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon)
      VALUES (?, ?, 'Inteligência Artificial', '#eab308', 'cpu')
    `).run(catAiId, testUserId);

    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon)
      VALUES (?, ?, 'Neurociência', '#10b981', 'brain')
    `).run(catNeuroId, testUserId);

    db.prepare(`
      INSERT INTO folders (id, user_id, name)
      VALUES (?, ?, 'Estudos Avançados')
    `).run(folderId, testUserId);

    // 2. Criar Referências Bibliográficas (Fontes)
    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, category_id, folder_id, authors, year)
      VALUES (?, ?, 'Rosenblatt 1958 - Principles of Neurodynamics', 'references/rosenblatt.pdf', 'pdf', ?, ?, 'Frank Rosenblatt', 1958)
    `).run(ref1Id, testUserId, catAiId, folderId);

    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, category_id, folder_id, authors, year)
      VALUES (?, ?, 'Hopfield 1982 - Neural Networks', 'references/hopfield.tex', 'tex', ?, ?, 'John Hopfield', 1982)
    `).run(ref2Id, testUserId, catNeuroId, folderId);

    // 3. Criar Notas com Wikilinks cruzados
    // Note 1 aponta para Note 2 via [[Backpropagation#Algoritmo]]
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, folder_id, file_type)
      VALUES (?, ?, 'Perceptron Multicamadas', '<p>Estudo que evolui para [[Backpropagation#Algoritmo]].</p>', ?, ?, 'docx')
    `).run(note1Id, testUserId, catAiId, folderId);

    // Note 2
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, folder_id, file_type)
      VALUES (?, ?, 'Backpropagation', '<p>Baseado no [[Perceptron Multicamadas]].</p>', ?, ?, 'docx')
    `).run(note2Id, testUserId, catAiId, folderId);

    // Note 3: Nota isolada (sem links)
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, category_id, folder_id, file_type)
      VALUES (?, ?, 'Nota Isolada de Rascunho', '<p>Apenas texto solto sem links.</p>', ?, ?, 'md')
    `).run(note3Id, testUserId, catNeuroId, folderId);

    // Inserir Wikilinks no banco
    db.prepare(`
      INSERT INTO wikilinks (id, source_note_id, target_title, target_anchor, target_note_id)
      VALUES ('wl-test-1', ?, 'Backpropagation', 'Algoritmo', ?)
    `).run(note1Id, note2Id);

    db.prepare(`
      INSERT INTO wikilinks (id, source_note_id, target_title, target_anchor, target_note_id)
      VALUES ('wl-test-2', ?, 'Perceptron Multicamadas', NULL, ?)
    `).run(note2Id, note1Id);

    // 4. Criar Citação: Note 1 cita Rosenblatt 1958
    db.prepare(`
      INSERT INTO citations (id, note_id, reference_id, quote_text, page_number)
      VALUES (?, ?, ?, 'The perceptron is the simplest model of a learning machine', 7)
    `).run(citation1Id, note1Id, ref1Id);
  });

  after(() => {
    // Limpeza dos dados de teste
    try {
      db.prepare('DELETE FROM citations WHERE id = ?').run(citation1Id);
      db.prepare('DELETE FROM wikilinks WHERE id IN (?, ?)').run('wl-test-1', 'wl-test-2');
      db.prepare('DELETE FROM notes WHERE id IN (?, ?, ?)').run(note1Id, note2Id, note3Id);
      db.prepare('DELETE FROM references_files WHERE id IN (?, ?)').run(ref1Id, ref2Id);
      db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
      db.prepare('DELETE FROM categories WHERE id IN (?, ?)').run(catAiId, catNeuroId);
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    } catch {}
  });

  // =========================================================================
  // CENÁRIO 1: Geração de Nós e Arestas do Grafo (RF-32)
  // =========================================================================
  describe('Cenário 1: Extração e Mapeamento de Nós e Arestas (RF-32)', () => {
    test('GET /api/graph deve retornar nós e arestas completos para o usuário autenticado', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/graph',
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const graph = JSON.parse(res.body) as GraphData;

      assert.ok(Array.isArray(graph.nodes), 'Deve retornar array de nós');
      assert.ok(Array.isArray(graph.links), 'Deve retornar array de arestas');
      assert.ok(graph.nodes.length >= 5, 'Deve conter as notas e referências criadas');

      // Verifica presença de nós de notas
      const perceptronNode = graph.nodes.find((n) => n.id === note1Id);
      assert.ok(perceptronNode, 'Nó Perceptron Multicamadas deve existir');
      assert.equal(perceptronNode?.type, 'note');
      assert.equal(perceptronNode?.title, 'Perceptron Multicamadas');
      assert.equal(perceptronNode?.category_id, catAiId);
      assert.equal(perceptronNode?.category_name, 'Inteligência Artificial');

      // Verifica presença de nó de referência
      const refNode = graph.nodes.find((n) => n.id === ref1Id);
      assert.ok(refNode, 'Nó Rosenblatt 1958 deve existir');
      assert.equal(refNode?.type, 'reference');
      assert.equal(refNode?.file_type, 'pdf');
    });

    test('Arestas de Wikilink devem conectar notas bidirecionalmente com labels opcionais', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/graph',
        headers: { 'x-user-id': testUserId }
      });

      const graph = JSON.parse(res.body) as GraphData;

      const wikilink = graph.links.find(
        (l) => l.source === note1Id && l.target === note2Id && l.type === 'wikilink'
      );
      assert.ok(wikilink, 'Deve existir aresta de wikilink de note1 para note2');
      assert.equal(wikilink?.label, '#Algoritmo', 'Deve preservar âncora como label');
    });

    test('Arestas de Citação devem conectar notas a referências bibliográficas', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/graph',
        headers: { 'x-user-id': testUserId }
      });

      const graph = JSON.parse(res.body) as GraphData;

      const citationLink = graph.links.find(
        (l) => l.source === note1Id && l.target === ref1Id && l.type === 'citation'
      );
      assert.ok(citationLink, 'Deve existir aresta de citação de Perceptron para Rosenblatt');
      assert.equal(citationLink?.label, 'pág. 7', 'Deve conter indicador de página na citação');
    });

    test('Cálculo de Grau (Degree) e Conexões deve ser consistente', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/graph',
        headers: { 'x-user-id': testUserId }
      });

      const graph = JSON.parse(res.body) as GraphData;

      const perceptronNode = graph.nodes.find((n) => n.id === note1Id);
      // note1 tem: wikilink saindo para note2, wikilink chegando de note2, citação para ref1 -> grau >= 2
      assert.ok(perceptronNode!.degree >= 2, `Grau de note1 deve ser pelo menos 2 (atual: ${perceptronNode?.degree})`);

      const isolatedNode = graph.nodes.find((n) => n.id === note3Id);
      assert.equal(isolatedNode?.degree, 0, 'Nó isolado deve possuir grau 0 de conexões');
    });
  });

  // =========================================================================
  // CENÁRIO 2: Filtros de Categoria, Pasta e Densidade (RF-33)
  // =========================================================================
  describe('Cenário 2: Filtros Interativos no Grafo (RF-33)', () => {
    test('Filtro por Categoria deve retornar apenas nós da categoria e arestas internas', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/graph?category_id=${catAiId}`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const graph = JSON.parse(res.body) as GraphData;

      // Todos os nós retornados devem pertencer a catAiId
      assert.ok(graph.nodes.length > 0, 'Deve retornar nós filtrados');
      for (const n of graph.nodes) {
        assert.equal(n.category_id, catAiId, `Nó ${n.title} deve pertencer à categoria AI`);
      }

      // Nó da categoria Neurociência não deve estar presente
      const neuroNode = graph.nodes.find((n) => n.id === note3Id);
      assert.equal(neuroNode, undefined, 'Nota de outra categoria deve ser filtrada');
    });

    test('Filtro por Densidade Mínima de Conexões (min_degree) deve isolar nós periféricos', async () => {
      // Filtrar apenas nós com pelo menos 1 conexão
      const res = await server.inject({
        method: 'GET',
        url: '/api/graph?min_degree=1',
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const graph = JSON.parse(res.body) as GraphData;

      for (const n of graph.nodes) {
        assert.ok(n.degree >= 1, `Nó ${n.title} deve ter grau >= 1 (atual: ${n.degree})`);
      }

      const isolatedNode = graph.nodes.find((n) => n.id === note3Id);
      assert.equal(isolatedNode, undefined, 'Nó isolado (grau 0) deve ser filtrado por min_degree=1');
    });

    test('Filtro por Pasta deve isolar nós da pasta especificada', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/graph?folder_id=${folderId}`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const graph = JSON.parse(res.body) as GraphData;

      for (const n of graph.nodes) {
        assert.equal(n.folder_id, folderId, `Nó ${n.title} deve pertencer à pasta selecionada`);
      }
    });
  });

  // =========================================================================
  // CENÁRIO 3: Resiliência e Integridade Referencial
  // =========================================================================
  describe('Cenário 3: Resiliência e Integridade Referencial', () => {
    test('Ao excluir uma nota, as arestas conectadas devem ser removidas', async () => {
      // Deletar note2
      const delRes = await server.inject({
        method: 'DELETE',
        url: `/api/notes/${note2Id}`,
        headers: { 'x-user-id': testUserId }
      });
      assert.equal(delRes.statusCode, 200);

      // Reconsultar grafo
      const res = await server.inject({
        method: 'GET',
        url: '/api/graph',
        headers: { 'x-user-id': testUserId }
      });

      const graph = JSON.parse(res.body) as GraphData;

      // Note 2 não deve existir nos nós
      const n2 = graph.nodes.find((n) => n.id === note2Id);
      assert.equal(n2, undefined, 'Nó deletado não deve constar no grafo');

      // Nenhuma aresta deve apontar para note2
      const deadEdge = graph.links.find((l) => l.source === note2Id || l.target === note2Id);
      assert.equal(deadEdge, undefined, 'Arestas órfãs para note2 não devem ser retornadas');
    });
  });
});
