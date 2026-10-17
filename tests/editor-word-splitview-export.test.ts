import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../server/db.js';
import { server } from '../server/index.js';
import { buildDocxFromContent, extractZipEntries } from '../server/docx.js';

describe('Editor de Texto Completo estilo Word/Docs, Formatos e Exportação', () => {
  const noteDocxId = `note-docx-test-${Date.now()}`;
  const noteMdId = `note-md-test-${Date.now()}`;

  before(async () => {
    initDatabase();
  });

  after(() => {
    try {
      db.prepare('DELETE FROM notes WHERE id IN (?, ?)').run(noteDocxId, noteMdId);
    } catch {}
  });

  test('buildDocxFromContent deve gerar Buffer de documento Word OpenXML válido', () => {
    const title = 'Documento de Teste de Redes Neurais';
    const content = `
      <h1>Introdução</h1>
      <p>Este documento foi gerado a partir do editor completo Word.</p>
      <h2>Fundamentos</h2>
      <blockquote>A inteligência artificial é baseada em conexões.</blockquote>
      <li>Conexão 1</li>
      <li>Conexão 2</li>
    `;

    const buffer = buildDocxFromContent(title, content);
    assert.ok(buffer instanceof Buffer, 'Retorno deve ser um Buffer');
    assert.ok(buffer.length > 500, 'Tamanho do buffer deve ser superior a 500 bytes');

    // Descompacta as entradas OpenXML
    const entries = extractZipEntries(buffer);
    assert.ok(entries['[Content_Types].xml'], 'Deve conter [Content_Types].xml');
    assert.ok(entries['_rels/.rels'], 'Deve conter _rels/.rels');
    assert.ok(entries['word/document.xml'], 'Deve conter word/document.xml');

    const docXml = entries['word/document.xml'].toString('utf8');
    assert.ok(docXml.includes('Documento de Teste de Redes Neurais'), 'XML deve conter o título');
    assert.ok(docXml.includes('Heading1'), 'XML deve conter Heading1');
    assert.ok(docXml.includes('Fundamentos'), 'XML deve conter seção de fundamentos');
    assert.ok(docXml.includes('A inteligência artificial é baseada em conexões.'), 'XML deve conter a citação');
  });

  test('POST /api/notes deve criar nota com file_type docx por padrão', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-admin' },
      payload: {
        title: 'Minha Nota DOCX',
        content: '<p>Conteúdo formatado no Word</p>'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.file_type, 'docx', 'Padrão deve ser formato docx');

    // Verifica persistência no SQLite
    const saved = db.prepare('SELECT * FROM notes WHERE id = ?').get(body.id) as any;
    assert.ok(saved, 'Nota deve existir no banco');
    assert.equal(saved.file_type, 'docx', 'file_type no banco deve ser docx');

    // Limpa
    db.prepare('DELETE FROM notes WHERE id = ?').run(body.id);
  });

  test('POST /api/notes deve aceitar e persistir file_type md quando especificado', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-admin' },
      payload: {
        title: 'Minha Nota Markdown',
        content: '# Cabeçalho MD\n\nTexto em markdown.',
        file_type: 'md'
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.file_type, 'md', 'file_type retornado deve ser md');

    const saved = db.prepare('SELECT * FROM notes WHERE id = ?').get(body.id) as any;
    assert.ok(saved, 'Nota deve existir no banco');
    assert.equal(saved.file_type, 'md', 'file_type no banco deve ser md');

    // Limpa
    db.prepare('DELETE FROM notes WHERE id = ?').run(body.id);
  });

  test('PUT /api/notes/:id deve atualizar file_type', async () => {
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type)
      VALUES (?, 'user-admin', 'Nota Para Conversão', 'Conteúdo', 'docx')
    `).run(noteDocxId);

    const updateRes = await server.inject({
      method: 'PUT',
      url: `/api/notes/${noteDocxId}`,
      headers: { 'content-type': 'application/json', 'x-user-id': 'user-admin' },
      payload: {
        file_type: 'md'
      }
    });

    assert.equal(updateRes.statusCode, 200);
    const saved = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteDocxId) as any;
    assert.equal(saved.file_type, 'md', 'file_type deve ter sido atualizado para md');
  });

  test('GET /api/notes/:id/export deve exportar arquivo DOCX com cabeçalhos corretos', async () => {
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type)
      VALUES (?, 'user-admin', 'Artigo de Pesquisa', '<h1>Introdução</h1><p>Texto</p>', 'docx')
    `).run(noteMdId);

    const exportRes = await server.inject({
      method: 'GET',
      url: `/api/notes/${noteMdId}/export?format=docx`
    });

    assert.equal(exportRes.statusCode, 200);
    assert.equal(
      exportRes.headers['content-type'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    assert.ok(
      exportRes.headers['content-disposition']?.includes('attachment; filename="Artigo_de_Pesquisa.docx"'),
      'Content-Disposition deve ter nome de arquivo .docx'
    );
    assert.ok(exportRes.rawPayload.length > 500, 'Payload binário deve ser arquivo DOCX válido');
  });

  test('GET /api/notes/:id/export?format=md deve exportar nota como Markdown', async () => {
    const exportRes = await server.inject({
      method: 'GET',
      url: `/api/notes/${noteMdId}/export?format=md`
    });

    assert.equal(exportRes.statusCode, 200);
    assert.ok(exportRes.headers['content-type']?.includes('text/markdown'), 'Content-Type deve ser text/markdown');
    assert.ok(
      exportRes.headers['content-disposition']?.includes('.md'),
      'Content-Disposition deve ter extensão .md'
    );
    assert.ok(exportRes.payload.includes('# Artigo de Pesquisa'), 'Conteúdo deve conter cabeçalho Markdown');
  });
});
