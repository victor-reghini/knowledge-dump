import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';
import { db } from '../server/db.js';
import { Article, ArticleCitation } from '../src/types.js';
import { extractZipEntries } from '../server/docx.js';

describe('Atividade 3.3: Modo de Redação e Exportação Científica (RF-30 e RF-31)', () => {
  const testUserId = `user-academic-${Date.now()}`;
  let articleId = '';
  let citationId = '';
  let refId = '';
  let noteId = '';

  before(async () => {
    await server.ready();

    // Cria usuário de teste
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, `academic_${Date.now()}`, 'hash_test', 'Dra. Ada Lovelace');

    // Cria referência de teste
    refId = `ref-${Date.now()}`;
    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year, doi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      refId,
      testUserId,
      'Attention Is All You Need',
      'references/attention.pdf',
      'pdf',
      'Vaswani, A., Shazeer, N., Parmar, N.',
      2017,
      '10.48550/arXiv.1706.03762'
    );

    // Cria nota de teste
    noteId = `note-${Date.now()}`;
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content)
      VALUES (?, ?, ?, ?)
    `).run(
      noteId,
      testUserId,
      'Fundamentos de Transformers',
      'Mecanismos de auto-atenção projetam matrizes Q, K e V para calcular pontuações de similaridade contextual.'
    );
  });

  after(async () => {
    if (articleId) {
      db.prepare('DELETE FROM articles WHERE id = ?').run(articleId);
    }
    if (refId) {
      db.prepare('DELETE FROM references_files WHERE id = ?').run(refId);
    }
    if (noteId) {
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  describe('CRUD de Artigos Científicos (RF-30)', () => {
    test('POST /api/articles deve criar manuscrito com metadados estruturados', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/articles',
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Arquiteturas Neurais de Atenção em Processamento de Linguagem Natural',
          subtitle: 'Uma análise comparativa entre Transformers e Redes Recorrentes',
          abstract: 'Investigamos a capacidade de generalização de modelos baseados exclusivamente em mecanismos de atenção.',
          content: '# 1. Introdução\n\nA introdução do mecanismo de atenção permitiu paralelizar o processamento sequencial.\n\n# 2. Metodologia\n\nComparamos tempos de convergência e perda de gradiente.',
          keywords: ['Deep Learning', 'Transformers', 'Atenção'],
          status: 'draft',
          target_venue: 'Revista Brasileira de Inteligência Artificial'
        }
      });

      assert.equal(res.statusCode, 200);
      const article = JSON.parse(res.body) as Article;
      assert.ok(article.id);
      assert.equal(article.title, 'Arquiteturas Neurais de Atenção em Processamento de Linguagem Natural');
      assert.equal(article.author_name, 'Dra. Ada Lovelace');
      assert.equal(article.status, 'draft');
      assert.ok(article.word_count && article.word_count > 10, 'Deve computar contagem de palavras');
      assert.ok(article.estimated_reading_minutes && article.estimated_reading_minutes >= 1, 'Deve estimar tempo de leitura');
      articleId = article.id;
    });

    test('GET /api/articles deve listar artigos com contagem de palavras e citações', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/articles',
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const articles = JSON.parse(res.body) as Article[];
      assert.ok(Array.isArray(articles));
      const found = articles.find(a => a.id === articleId);
      assert.ok(found, 'O artigo recém-criado deve constar na listagem');
      assert.equal(found.citations_count, 0);
    });

    test('GET /api/articles/:id deve retornar detalhes completos e autor', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const art = JSON.parse(res.body) as Article;
      assert.equal(art.id, articleId);
      assert.deepEqual(art.keywords, ['Deep Learning', 'Transformers', 'Atenção']);
      assert.equal(art.target_venue, 'Revista Brasileira de Inteligência Artificial');
    });

    test('PUT /api/articles/:id deve atualizar conteúdo e status', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/articles/${articleId}`,
        headers: { 'x-user-id': testUserId },
        payload: {
          status: 'review',
          target_venue: 'IEEE Transactions on Neural Networks'
        }
      });

      assert.equal(res.statusCode, 200);
      const updated = JSON.parse(res.body) as Article;
      assert.equal(updated.status, 'review');
      assert.equal(updated.target_venue, 'IEEE Transactions on Neural Networks');
    });
  });

  describe('Gaveta de Citações e Vínculo com o Acervo (RF-30)', () => {
    test('POST /api/articles/:id/citations deve vincular paper de referência', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/articles/${articleId}/citations`,
        headers: { 'x-user-id': testUserId },
        payload: {
          reference_id: refId,
          page_number: 3
        }
      });

      assert.equal(res.statusCode, 200);
      const cit = JSON.parse(res.body) as ArticleCitation;
      assert.ok(cit.id);
      assert.equal(cit.reference_id, refId);
      assert.equal(cit.reference_title, 'Attention Is All You Need');
      assert.ok(cit.citation_key, 'Deve gerar chave de citação bibliográfica');
      citationId = cit.id;
    });

    test('GET /api/articles/:id deve listar as referências vinculadas na gaveta', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const art = JSON.parse(res.body) as Article;
      assert.equal(art.citations_count, 1);
      assert.equal(art.citations?.[0].id, citationId);
      assert.equal(art.citations?.[0].reference_year, 2017);
    });
  });

  describe('Compilação e Exportação Científica Multi-formato (RF-31)', () => {
    test('POST /api/export/compile em Markdown deve gerar frontmatter YAML e seção de referências', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        headers: { 'x-user-id': testUserId },
        payload: {
          format: 'md',
          data: {
            title: 'Artigo Teste Markdown',
            subtitle: 'Subtítulo do Estudo',
            authors: 'Dra. Ada Lovelace',
            abstract: 'Resumo sobre inteligência analítica.',
            keywords: ['IA', 'Lógica'],
            content: '# 1. Introdução\n\nTexto expositivo inicial.',
            citations: [
              {
                key: 'vaswani2017',
                title: 'Attention Is All You Need',
                authors: 'Vaswani et al.',
                year: 2017
              }
            ]
          },
          options: {
            citationStyle: 'ABNT',
            includeFrontmatter: true,
            includeAbstract: true,
            includeBibliography: true
          }
        }
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.format, 'md');
      assert.ok(json.compiled.includes('---'), 'Deve conter abertura de YAML frontmatter');
      assert.ok(json.compiled.includes('title: "Artigo Teste Markdown"'), 'Deve conter título no frontmatter');
      assert.ok(json.compiled.includes('## Resumo'), 'Deve conter seção de resumo');
      assert.ok(json.compiled.includes('## Referências Bibliográficas'), 'Deve conter seção de referências bibliográficas');
      assert.ok(json.compiled.includes('VASWANI ET AL.'), 'Deve conter autor formatado em caixa alta ABNT');
    });

    test('POST /api/export/compile em LaTeX deve gerar preâmbulo acadêmico válido e thebibliography', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        headers: { 'x-user-id': testUserId },
        payload: {
          format: 'tex',
          data: {
            title: 'Transformers & Atenção',
            authors: 'Dra. Ada Lovelace',
            abstract: 'Análise matemática do produto escalar escalonado.',
            keywords: ['Atenção', 'Álgebra Linear'],
            content: '# 1. Formulação Algébrica\n\nSeja $Q, K, V$ matrizes de projeção linear.\n\n## 1.1 Complexidade Computacional\n\nO custo é quadrático.',
            citations: [
              {
                key: 'vaswani2017',
                title: 'Attention Is All You Need',
                authors: 'Vaswani et al.',
                year: 2017
              }
            ]
          },
          options: {
            citationStyle: 'IEEE',
            includeAbstract: true,
            includeBibliography: true
          }
        }
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.format, 'tex');
      assert.ok(json.compiled.includes('\\documentclass[12pt,a4paper]{article}'), 'Deve conter documentclass padrão');
      assert.ok(json.compiled.includes('\\begin{document}'), 'Deve conter início do documento');
      assert.ok(json.compiled.includes('\\begin{abstract}'), 'Deve conter ambiente abstract');
      assert.ok(json.compiled.includes('\\section{1. Formulação Algébrica}'), 'Deve converter cabeçalho para section');
      assert.ok(json.compiled.includes('\\subsection{1.1 Complexidade Computacional}'), 'Deve converter para subsection');
      assert.ok(json.compiled.includes('\\begin{thebibliography}{99}'), 'Deve conter ambiente thebibliography');
      assert.ok(json.compiled.includes('\\bibitem{vaswani2017}'), 'Deve conter item bibitem com a chave');
      assert.ok(json.compiled.includes('\\end{document}'), 'Deve fechar documento');
    });

    test('POST /api/export/compile em DOCX deve gerar arquivo zip estruturado válido', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        headers: { 'x-user-id': testUserId },
        payload: {
          format: 'docx',
          data: {
            title: 'Paper em Formato Word',
            subtitle: 'Subtítulo do Paper',
            authors: 'Dra. Ada Lovelace',
            abstract: 'Resumo para exportação DOCX.',
            content: '# 1. Introdução\n\nParágrafo de teste.',
            citations: [
              {
                key: 'ref1',
                title: 'Attention Is All You Need',
                authors: 'Vaswani et al.',
                year: 2017
              }
            ]
          }
        }
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.format, 'docx');
      assert.ok(json.base64, 'Deve conter payload binário em base64');

      const buf = Buffer.from(json.base64, 'base64');
      const entries = extractZipEntries(buf);
      assert.ok(entries['[Content_Types].xml'], 'DOCX deve possuir [Content_Types].xml');
      assert.ok(entries['word/document.xml'], 'DOCX deve possuir word/document.xml');
    });

    test('POST /api/export/compile em PDF deve gerar binário PDF 1.4 válido', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        headers: { 'x-user-id': testUserId },
        payload: {
          format: 'pdf',
          data: {
            title: 'Paper em Formato PDF',
            subtitle: 'Subtítulo do Paper',
            authors: 'Dra. Ada Lovelace',
            abstract: 'Resumo com delimitação formal do problema e demonstração de teoremas.',
            content: '# 1. Introdução\n\nEste artigo demonstra a geração de PDF acadêmico puro.\n\n# 2. Conclusão\n\nConcluímos com sucesso.',
            citations: [
              {
                key: 'ref1',
                title: 'Attention Is All You Need',
                authors: 'Vaswani et al.',
                year: 2017
              }
            ]
          }
        }
      });

      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.format, 'pdf');
      assert.ok(json.base64);

      const buf = Buffer.from(json.base64, 'base64');
      const header = buf.subarray(0, 8).toString('utf8');
      assert.ok(header.startsWith('%PDF-1.4'), 'Buffer gerado deve ser um PDF 1.4 válido');
      assert.ok(buf.toString('latin1').includes('%%EOF'), 'PDF deve possuir marcador de término %%EOF');
    });

    test('GET /api/articles/:id/export?format=md deve retornar arquivo Markdown via download direto', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}/export?format=md`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type']?.includes('text/markdown'));
      assert.ok(res.headers['content-disposition']?.includes('.md'));
      assert.ok(res.body.includes('Arquiteturas Neurais de Atenção'));
      assert.ok(res.body.includes('Attention Is All You Need'));
    });

    test('GET /api/articles/:id/export?format=tex deve retornar arquivo LaTeX via download direto', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}/export?format=tex`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type']?.includes('application/x-latex'));
      assert.ok(res.headers['content-disposition']?.includes('.tex'));
      assert.ok(res.body.includes('\\documentclass'));
      assert.ok(res.body.includes('\\begin{document}'));
    });

    test('GET /api/articles/:id/export?format=docx deve retornar buffer DOCX via download direto', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}/export?format=docx`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
      assert.ok(res.headers['content-disposition']?.includes('.docx'));
      const entries = extractZipEntries(res.rawPayload);
      assert.ok(entries['word/document.xml']);
    });

    test('GET /api/articles/:id/export?format=pdf deve retornar buffer PDF via download direto', async () => {
      const res = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}/export?format=pdf`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type']?.includes('application/pdf'));
      assert.ok(res.headers['content-disposition']?.includes('.pdf'));
      const header = res.rawPayload.subarray(0, 8).toString('utf8');
      assert.ok(header.startsWith('%PDF-1.4'));
    });
  });

  describe('Remoção de Citações e Artigos', () => {
    test('DELETE /api/articles/:id/citations/:citationId deve remover citação da gaveta', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/articles/${articleId}/citations/${citationId}`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const artRes = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}`,
        headers: { 'x-user-id': testUserId }
      });
      const art = JSON.parse(artRes.body) as Article;
      assert.equal(art.citations_count, 0);
    });

    test('DELETE /api/articles/:id deve excluir o artigo do sistema', async () => {
      const res = await server.inject({
        method: 'DELETE',
        url: `/api/articles/${articleId}`,
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const checkRes = await server.inject({
        method: 'GET',
        url: `/api/articles/${articleId}`,
        headers: { 'x-user-id': testUserId }
      });
      assert.equal(checkRes.statusCode, 404);
      articleId = '';
    });
  });
});
