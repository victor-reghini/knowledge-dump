import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { db, initDatabase, DATA_DIR, REFS_DIR } from '../server/db.js';
import { server } from '../server/index.js';
import { saveDocxFile, parseDocxFile } from '../server/docx.js';
import { createMockPptxBuffer, parsePptxBuffer, parsePptxFile } from '../server/pptx.js';

describe('Suporte a Novos Formatos (.txt, .md, .pptx) e Edição Direta (.txt, .doc, .docx, .tex)', () => {
  const testTxtId = `ref-txt-${Date.now()}`;
  const testMdId = `ref-md-${Date.now()}`;
  const testPptxId = `ref-pptx-${Date.now()}`;
  const testDocxId = `ref-docx-${Date.now()}`;
  const testTexId = `ref-tex-${Date.now()}`;
  const testPdfId = `ref-pdf-${Date.now()}`;

  const txtFilename = `teste_${Date.now()}.txt`;
  const mdFilename = `teste_${Date.now()}.md`;
  const pptxFilename = `apresentacao_${Date.now()}.pptx`;
  const docxFilename = `artigo_${Date.now()}.docx`;
  const texFilename = `paper_${Date.now()}.tex`;
  const pdfFilename = `documento_${Date.now()}.pdf`;

  const txtPath = path.join(REFS_DIR, txtFilename);
  const mdPath = path.join(REFS_DIR, mdFilename);
  const pptxPath = path.join(REFS_DIR, pptxFilename);
  const docxPath = path.join(REFS_DIR, docxFilename);
  const texPath = path.join(REFS_DIR, texFilename);
  const pdfPath = path.join(REFS_DIR, pdfFilename);

  before(async () => {
    initDatabase();

    // 1. Arquivo .txt
    fs.writeFileSync(txtPath, 'Conteúdo original em texto plano.\nLinha 2 de anotações.', 'utf8');
    db.prepare(`
      INSERT INTO references_files (id, title, file_path, file_type, authors, year)
      VALUES (?, 'Anotações em Texto', ?, 'txt', 'Autor Teste', 2026)
    `).run(testTxtId, `references/${txtFilename}`);

    // 2. Arquivo .md
    fs.writeFileSync(mdPath, '# Titulo Original Markdown\n\nTexto descritivo em markdown.', 'utf8');
    db.prepare(`
      INSERT INTO references_files (id, title, file_path, file_type, authors, year)
      VALUES (?, 'Guia Markdown', ?, 'md', 'Autor MD', 2026)
    `).run(testMdId, `references/${mdFilename}`);

    // 3. Arquivo .pptx
    const pptxBuf = createMockPptxBuffer('Apresentação de Inteligência Artificial', [
      {
        title: 'Introdução à IA',
        bullets: ['História das Redes Neurais', 'Perceptron e Backpropagation', 'Avanços Recentes']
      },
      {
        title: 'Modelos de Linguagem',
        bullets: ['Transformers e Atenção', 'Aplicações no Knowledge Dump']
      }
    ]);
    fs.writeFileSync(pptxPath, pptxBuf);
    db.prepare(`
      INSERT INTO references_files (id, title, file_path, file_type, authors, year)
      VALUES (?, 'Slides de IA', ?, 'pptx', 'Palestrante IA', 2026)
    `).run(testPptxId, `references/${pptxFilename}`);

    // 4. Arquivo .docx
    saveDocxFile(docxPath, 'Parágrafo 1 inicial do Word.\n\nParágrafo 2 com dados da pesquisa.');
    db.prepare(`
      INSERT INTO references_files (id, title, file_path, file_type, authors, year)
      VALUES (?, 'Documento Word', ?, 'docx', 'Pesquisador Word', 2026)
    `).run(testDocxId, `references/${docxFilename}`);

    // 5. Arquivo .tex
    fs.writeFileSync(texPath, '\\documentclass{article}\n\\begin{document}\nTexto original LaTeX.\n\\end{document}', 'utf8');
    db.prepare(`
      INSERT INTO references_files (id, title, file_path, file_type, authors, year)
      VALUES (?, 'Artigo LaTeX', ?, 'tex', 'Pesquisador TeX', 2026)
    `).run(testTexId, `references/${texFilename}`);

    // 6. Arquivo .pdf para teste de validação negativa de edição
    fs.writeFileSync(pdfPath, '%PDF-1.4\n%MockPDF', 'utf8');
    db.prepare(`
      INSERT INTO references_files (id, title, file_path, file_type, authors, year)
      VALUES (?, 'Paper PDF Imutável', ?, 'pdf', 'Autor PDF', 2026)
    `).run(testPdfId, `references/${pdfFilename}`);

    await server.ready();
  });

  after(() => {
    // Limpeza de arquivos criados e registros no banco
    const ids = [testTxtId, testMdId, testPptxId, testDocxId, testTexId, testPdfId];
    for (const id of ids) {
      try {
        db.prepare('DELETE FROM references_files WHERE id = ?').run(id);
      } catch {}
    }
    const paths = [txtPath, mdPath, pptxPath, docxPath, texPath, pdfPath];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
  });

  // =========================================================================
  // CENÁRIO 1: Análise e Extração de Apresentações PowerPoint (.pptx / .ppt)
  // =========================================================================
  describe('Cenário 1: Leitura e Estruturação de Apresentações PowerPoint (.pptx)', () => {
    test('parsePptxBuffer deve extrair contagem de slides, títulos e bullet points', () => {
      const buf = fs.readFileSync(pptxPath);
      const parsed = parsePptxBuffer(buf);

      assert.strictEqual(parsed.slideCount, 2, 'Deve conter exatamente 2 slides');
      assert.strictEqual(parsed.slides[0].title, 'Introdução à IA');
      assert.ok(parsed.slides[0].bullets.some((b) => b.includes('Backpropagation')));
      assert.strictEqual(parsed.slides[1].title, 'Modelos de Linguagem');
      assert.ok(parsed.slides[1].bullets.some((b) => b.includes('Transformers')));
    });

    test('GET /api/references/:id/content deve retornar payload estruturado de slides para PPTX', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${testPptxId}/content`
      });

      assert.strictEqual(response.statusCode, 200);
      const data = response.json();
      assert.strictEqual(data.file_type, 'pptx');
      assert.strictEqual(data.slideCount, 2);
      assert.ok(Array.isArray(data.slides));
      assert.strictEqual(data.slides[0].slideNumber, 1);
      assert.strictEqual(data.slides[0].title, 'Introdução à IA');
    });
  });

  // =========================================================================
  // CENÁRIO 2: Leitura de Conteúdo em Formatos de Texto (.txt, .md, .docx, .tex)
  // =========================================================================
  describe('Cenário 2: Leitura de Conteúdo Formatado (.txt, .md, .docx, .tex)', () => {
    test('GET /api/references/:id/content para .txt deve retornar texto plano', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${testTxtId}/content`
      });

      assert.strictEqual(response.statusCode, 200);
      const data = response.json();
      assert.strictEqual(data.file_type, 'txt');
      assert.ok(data.text.includes('Conteúdo original em texto plano.'));
    });

    test('GET /api/references/:id/content para .md deve retornar conteúdo markdown', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${testMdId}/content`
      });

      assert.strictEqual(response.statusCode, 200);
      const data = response.json();
      assert.strictEqual(data.file_type, 'md');
      assert.ok(data.text.includes('# Titulo Original Markdown'));
    });

    test('GET /api/references/:id/content para .docx deve retornar parágrafos estruturados', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/references/${testDocxId}/content`
      });

      assert.strictEqual(response.statusCode, 200);
      const data = response.json();
      assert.strictEqual(data.file_type, 'docx');
      assert.ok(Array.isArray(data.paragraphs));
      assert.ok(data.paragraphs.length >= 2);
      assert.ok(data.paragraphs[0].text.includes('Parágrafo 1 inicial'));
    });
  });

  // =========================================================================
  // CENÁRIO 3: Edição Direta e Persistência no Disco (PUT /api/references/:id/content)
  // =========================================================================
  describe('Cenário 3: Edição Direta e Persistência no Disco (.txt, .md, .docx, .tex)', () => {
    test('PUT /api/references/:id/content em .txt deve atualizar arquivo físico no disco', async () => {
      const novoTexto = 'Novo texto editado pelo usuário.\nPersistido com sucesso no disco.';
      const res = await server.inject({
        method: 'PUT',
        url: `/api/references/${testTxtId}/content`,
        headers: { 'Content-Type': 'application/json' },
        payload: { text: novoTexto }
      });

      assert.strictEqual(res.statusCode, 200);
      const body = res.json();
      assert.strictEqual(body.success, true);

      // Verifica no disco
      const lidoDisco = fs.readFileSync(txtPath, 'utf8');
      assert.strictEqual(lidoDisco, novoTexto);

      // Verifica via GET content
      const getRes = await server.inject({ method: 'GET', url: `/api/references/${testTxtId}/content` });
      assert.strictEqual(getRes.json().text, novoTexto);
    });

    test('PUT /api/references/:id/content em .md deve atualizar arquivo markdown no disco', async () => {
      const novoMd = '# Novo Título Markdown\n\n- Item atualizado 1\n- Item atualizado 2';
      const res = await server.inject({
        method: 'PUT',
        url: `/api/references/${testMdId}/content`,
        headers: { 'Content-Type': 'application/json' },
        payload: { text: novoMd }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);

      const lidoDisco = fs.readFileSync(mdPath, 'utf8');
      assert.strictEqual(lidoDisco, novoMd);
    });

    test('PUT /api/references/:id/content em .tex deve atualizar código-fonte LaTeX no disco', async () => {
      const novoTex = '\\section{Resultados}\nTexto científico atualizado no disco.';
      const res = await server.inject({
        method: 'PUT',
        url: `/api/references/${testTexId}/content`,
        headers: { 'Content-Type': 'application/json' },
        payload: { text: novoTex }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);

      const lidoDisco = fs.readFileSync(texPath, 'utf8');
      assert.strictEqual(lidoDisco, novoTex);
    });

    test('PUT /api/references/:id/content em .docx deve reempacotar e atualizar arquivo Word no disco', async () => {
      const novoDocxTexto = 'Parágrafo 1 atualizado da tese.\n\nParágrafo 2 com nova conclusão.';
      const res = await server.inject({
        method: 'PUT',
        url: `/api/references/${testDocxId}/content`,
        headers: { 'Content-Type': 'application/json' },
        payload: { text: novoDocxTexto }
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.json().success, true);

      // Analisa o DOCX reempacotado diretamente do disco
      const docxData = parseDocxFile(docxPath);
      assert.ok(docxData.paragraphs.length >= 2);
      assert.ok(docxData.paragraphs[0].text.includes('Parágrafo 1 atualizado da tese.'));
      assert.ok(docxData.paragraphs[1].text.includes('Parágrafo 2 com nova conclusão.'));
    });

    test('PUT /api/references/:id/content em formato não editável (PDF) deve retornar erro 400', async () => {
      const res = await server.inject({
        method: 'PUT',
        url: `/api/references/${testPdfId}/content`,
        headers: { 'Content-Type': 'application/json' },
        payload: { text: 'Tentando editar PDF diretamente' }
      });

      assert.strictEqual(res.statusCode, 400);
      const body = res.json();
      assert.ok(body.error.includes('não permite edição direta'));
    });
  });
});
