import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db, initDatabase, DATA_DIR, REFS_DIR } from '../server/db.js';
import { server } from '../server/index.js';

describe('Atividade 2.4: Testes de Carga e Arquivos Volumosos (PDFs 100MB+)', () => {
  const LARGE_FILE_SIZE = 105 * 1024 * 1024; // 105 MB (110.100.480 bytes)
  const largePdfFilename = 'teste_livro_volumoso_100mb.pdf';
  const largePdfPath = path.join(REFS_DIR, largePdfFilename);
  const largeRefId = `ref-carga-test-${Date.now()}`;

  before(async () => {
    initDatabase();

    // Cria arquivo esparso de 105MB com marcadores específicos para validar leitura de páginas
    const fd = fs.openSync(largePdfPath, 'w');
    // Header PDF no início
    const headerBuf = Buffer.from('%PDF-1.7\n%KnowledgeDump Test Document\n');
    fs.writeSync(fd, headerBuf, 0, headerBuf.length, 0);

    // Marcador intermediário no offset 50MB (52.428.800 bytes)
    const midOffset = 50 * 1024 * 1024;
    const midBuf = Buffer.from('\n42 0 obj\n<< /Type /Page /Contents [43 0 R] >>\nendobj\n');
    fs.writeSync(fd, midBuf, 0, midBuf.length, midOffset);

    // Trailer / xref no final do arquivo (105MB - 200 bytes)
    const eofOffset = LARGE_FILE_SIZE - 128;
    const trailerBuf = Buffer.from('\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1000 /Root 1 0 R >>\nstartxref\n110100350\n%%EOF\n');
    fs.writeSync(fd, trailerBuf, 0, trailerBuf.length, eofOffset);

    // Garante que o arquivo atinge exatamente 105MB
    fs.ftruncateSync(fd, LARGE_FILE_SIZE);
    fs.closeSync(fd);

    // Cadastra referência no banco de dados SQLite
    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year)
      VALUES (?, NULL, ?, ?, 'pdf', 'Deep Learning Group', 2026)
    `).run(largeRefId, 'Livro Didático Pesado 100MB', `references/${largePdfFilename}`);

    await server.ready();
  });

  after(() => {
    // Limpeza dos dados de teste
    try {
      if (fs.existsSync(largePdfPath)) {
        fs.unlinkSync(largePdfPath);
      }
      db.prepare('DELETE FROM references_files WHERE id = ?').run(largeRefId);
      db.prepare("DELETE FROM notes WHERE id LIKE 'note-carga-%'").run();
      db.prepare("DELETE FROM notes_fts WHERE note_id LIKE 'note-carga-%'").run();
    } catch (err) {
      console.error('Erro na limpeza:', err);
    }
  });

  // =========================================================================
  // CENÁRIO 1: Protocolo HTTP Byte-Range e Streaming Parcial (RFC 7233)
  // =========================================================================
  describe('Cenário 1: Protocolo de Streaming HTTP e Requisições de Faixa de Bytes (RFC 7233)', () => {
    test('Requisição sem cabeçalho Range deve retornar 200 OK com Accept-Ranges: bytes e Content-Length total', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${largeRefId}/file`
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers['accept-ranges'], 'bytes');
      assert.equal(response.headers['content-type'], 'application/pdf');
      assert.equal(response.headers['content-length'], String(LARGE_FILE_SIZE));
    });

    test('Faixa inicial bytes=0-1023 deve retornar 206 Partial Content com exatamente 1024 bytes e cabeçalho PDF', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${largeRefId}/file`,
        headers: {
          range: 'bytes=0-1023'
        }
      });

      assert.equal(response.statusCode, 206);
      assert.equal(response.headers['accept-ranges'], 'bytes');
      assert.equal(response.headers['content-range'], `bytes 0-1023/${LARGE_FILE_SIZE}`);
      assert.equal(response.headers['content-length'], '1024');

      const raw = response.rawPayload;
      assert.equal(raw.length, 1024);
      assert.ok(raw.toString('utf-8').startsWith('%PDF-1.7'), 'Deve conter assinatura inicial do PDF');
    });

    test('Faixa intermediária no offset 50MB deve ler bloco de página sem carregar o arquivo inteiro', async () => {
      const midStart = 50 * 1024 * 1024;
      const midEnd = midStart + 511;

      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${largeRefId}/file`,
        headers: {
          range: `bytes=${midStart}-${midEnd}`
        }
      });

      assert.equal(response.statusCode, 206);
      assert.equal(response.headers['content-range'], `bytes ${midStart}-${midEnd}/${LARGE_FILE_SIZE}`);
      assert.equal(response.headers['content-length'], '512');
      assert.ok(response.body.includes('/Type /Page'), 'Deve ler dados da página intermediária com fidelidade');
    });

    test('Faixa de sufixo bytes=-128 (últimos 128 bytes) deve ler trailer e marcador %%EOF', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${largeRefId}/file`,
        headers: {
          range: 'bytes=-128'
        }
      });

      assert.equal(response.statusCode, 206);
      const expectedStart = LARGE_FILE_SIZE - 128;
      const expectedEnd = LARGE_FILE_SIZE - 1;
      assert.equal(response.headers['content-range'], `bytes ${expectedStart}-${expectedEnd}/${LARGE_FILE_SIZE}`);
      assert.equal(response.headers['content-length'], '128');
      assert.ok(response.body.includes('%%EOF'), 'Deve ler marcador %%EOF essencial para PDF.js');
    });

    test('Faixa fora dos limites ou invertida deve retornar 416 Range Not Satisfiable', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${largeRefId}/file`,
        headers: {
          range: `bytes=${LARGE_FILE_SIZE + 5000}-`
        }
      });

      assert.equal(response.statusCode, 416);
      assert.equal(response.headers['content-range'], `bytes */${LARGE_FILE_SIZE}`);
    });

    test('Referência inexistente deve retornar 404 com erro explicativo em JSON', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/references/ref-inexistente-xyz/file'
      });

      assert.equal(response.statusCode, 404);
      const data = JSON.parse(response.body);
      assert.ok(data.error.includes('não encontrada'));
    });
  });

  // =========================================================================
  // CENÁRIO 2: Validação de Performance de I/O e Limites de Memória (RNF-03)
  // =========================================================================
  describe('Cenário 2: Arquivos Volumosos (100MB+) e Estabilidade de Memória (RNF-03)', () => {
    test('Arquivo de 105MB deve ter tamanho binário comprovado no volume de dados', () => {
      assert.ok(fs.existsSync(largePdfPath));
      const stats = fs.statSync(largePdfPath);
      assert.equal(stats.size, LARGE_FILE_SIZE);
      assert.ok(stats.size > 100 * 1024 * 1024, 'Tamanho deve ser superior a 100MB');
    });

    test('Leitura aleatória de páginas de 64KB sob demanda deve responder em menos de 25ms por requisição', async () => {
      const sampleOffsets = [
        0,
        10 * 1024 * 1024,
        25 * 1024 * 1024,
        50 * 1024 * 1024,
        75 * 1024 * 1024,
        100 * 1024 * 1024
      ];

      for (const offset of sampleOffsets) {
        const start = performance.now();
        const response = await server.inject({
          method: 'GET',
          url: `/api/references/${largeRefId}/file`,
          headers: {
            range: `bytes=${offset}-${offset + 65535}`
          }
        });
        const duration = performance.now() - start;

        assert.equal(response.statusCode, 206);
        assert.ok(duration < 25, `Leitura no offset ${offset} demorou ${duration.toFixed(2)}ms (limite 25ms)`);
      }
    });

    test('Leitura de múltiplos blocos não deve inflar a memória heap do Node.js de forma proporcional ao arquivo', async () => {
      if (global.gc) global.gc();
      const initialHeap = process.memoryUsage().heapUsed;

      // Realiza 20 leituras parciais consecutivas simulando usuário folheando o livro
      for (let i = 0; i < 20; i++) {
        const offset = i * 4 * 1024 * 1024;
        await server.inject({
          method: 'GET',
          url: `/api/references/${largeRefId}/file`,
          headers: {
            range: `bytes=${offset}-${offset + 32767}`
          }
        });
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

      // Como o streaming é sob demanda, a variação de memória deve ser inferior a 15MB mesmo manipulando arquivo de 105MB
      assert.ok(heapDeltaMb < 15, `Variação de heap foi de ${heapDeltaMb.toFixed(2)}MB, demonstrando proteção contra OOM`);
    });
  });

  // =========================================================================
  // CENÁRIO 3: Performance de Carga e Busca FTS5 em Lote (RNF-01)
  // =========================================================================
  describe('Cenário 3: Performance de Carga e Busca FTS5 em Alta Escala (RNF-01)', () => {
    test('Inserção em lote de 1.000 notas acadêmicas com FTS5 ativo e busca concorrente (< 50ms)', () => {
      // Inserção em transação SQLite de alta performance
      const insertNote = db.prepare(`
        INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
        VALUES (?, NULL, ?, ?, datetime('now'), datetime('now'))
      `);
      const insertFts = db.prepare(`
        INSERT INTO notes_fts (note_id, title, content)
        VALUES (?, ?, ?)
      `);

      const startInsert = performance.now();
      db.exec('BEGIN TRANSACTION');
      for (let i = 1; i <= 1000; i++) {
        const noteId = `note-carga-${i}`;
        const title = `Nota Científica de Carga #${i} sobre Redes Neurais`;
        const content = `Este é o parágrafo explicativo da nota #${i}. O algoritmo de retropropagação do gradiente descendente estocástico minimiza a função de perda quadrática com taxa de convergência rápida no modelo de perceptron multicamadas. Referência ao paper Hopfield 1982 e Backpropagation.`;
        insertNote.run(noteId, title, content);
        insertFts.run(noteId, title, content);
      }
      db.exec('COMMIT');
      const insertDuration = performance.now() - startInsert;
      assert.ok(insertDuration < 3000, `Inserção em lote demorou ${insertDuration.toFixed(2)}ms`);

      // Validação da busca FTS5 (RNF-01 estipula retorno em menos de 500ms para até 10.000 notas)
      const startQuery = performance.now();
      const results = db.prepare(`
        SELECT n.id, n.title, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 20) as snippet
        FROM notes_fts
        JOIN notes n ON notes_fts.note_id = n.id
        WHERE notes_fts MATCH ?
        LIMIT 20
      `).all('"retropropagação"*');
      const queryDuration = performance.now() - startQuery;

      assert.ok(results.length >= 20, 'Deve retornar os 20 resultados do limite');
      assert.ok(queryDuration < 50, `Busca FTS5 executou em ${queryDuration.toFixed(2)}ms (muito abaixo do limiar de 500ms do RNF-01)`);
      assert.ok(String((results[0] as any).snippet).includes('<mark>'), 'Snippet FTS5 deve conter marcações de destaque');
    });

    test('Endpoint de busca rápida (/api/search?q=) deve retornar resultados em alta velocidade sob carga', async () => {
      const start = performance.now();
      const response = await server.inject({
        method: 'GET',
        url: '/api/search?q=retropropagação'
      });
      const duration = performance.now() - start;

      assert.equal(response.statusCode, 200);
      const results = JSON.parse(response.body);
      assert.ok(Array.isArray(results));
      assert.ok(results.length > 0);
      assert.ok(duration < 100, `Busca na API sob carga levou ${duration.toFixed(2)}ms (limiar 500ms)`);
    });
  });

  // =========================================================================
  // CENÁRIO 4: Integridade do Acervo e Metadados de Referência Pesada
  // =========================================================================
  describe('Cenário 4: Integridade do Acervo e Metadados de Referências Volumosas', () => {
    test('Consulta de metadados da referência deve retornar tipo, autores e caminho no disco', () => {
      const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get(largeRefId) as any;
      assert.ok(ref, 'Referência deve existir no banco');
      assert.equal(ref.file_type, 'pdf');
      assert.equal(ref.title, 'Livro Didático Pesado 100MB');
      assert.equal(ref.authors, 'Deep Learning Group');
      assert.equal(ref.year, 2026);
    });

    test('Endpoint /api/references/:id/content para PDF volumoso deve retornar URL de streaming sem carregar bytes brutos', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${largeRefId}/content`
      });

      assert.equal(response.statusCode, 200);
      const data = JSON.parse(response.body);
      assert.equal(data.id, largeRefId);
      assert.equal(data.file_type, 'pdf');
      assert.equal(data.file_url, `/api/references/${largeRefId}/file`);
      assert.equal(data.text, undefined, 'PDF não deve carregar conteúdo de texto bruto na memória');
    });
  });
});
