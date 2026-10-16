import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db, initDatabase, DATA_DIR, REFS_DIR } from '../server/db.js';
import { parseDocxFile } from '../server/docx.js';
import { ReferenceFile, Citation } from '../src/types.js';

describe('Atividade 2.3: Visualizadores de DOCX, LaTeX e Mídia', () => {

  // =========================================================================
  // CENÁRIO 1: Visualizador e Parser de DOCX (Word - RF-15)
  // =========================================================================
  describe('Cenário 1: Extração e Renderização de DOCX (Word - RF-15)', () => {
    const docxPath = path.join(REFS_DIR, 'relatorio_redes_neurais.docx');

    test('Arquivo de exemplo .docx deve existir no volume local de referências', () => {
      assert.ok(fs.existsSync(docxPath), `Arquivo DOCX deve existir em ${docxPath}`);
      const stats = fs.statSync(docxPath);
      assert.ok(stats.size > 200, 'Arquivo DOCX deve ter tamanho válido');
    });

    test('parseDocxFile deve extrair título, cabeçalhos, negrito e parágrafos sem dependências externas', () => {
      const docxData = parseDocxFile(docxPath);

      assert.ok(docxData.title, 'Deve detectar título do documento');
      assert.ok(docxData.title.includes('Relatório Técnico'), 'Título deve conter Relatório Técnico');
      assert.ok(docxData.paragraphs.length >= 5, `Deve possuir múltiplos parágrafos extraídos (atual: ${docxData.paragraphs.length})`);

      // Verifica formatação HTML gerada
      const hasHeading = docxData.paragraphs.some(p => p.type === 'heading' || p.html.includes('<h'));
      assert.ok(hasHeading, 'Deve identificar e gerar tags de cabeçalho');

      const hasBoldOrItalic = docxData.paragraphs.some(p => p.html.includes('<strong>') || p.html.includes('<em>'));
      assert.ok(hasBoldOrItalic, 'Deve preservar formatações inline de negrito ou itálico');

      // Verifica texto puro para busca FTS
      assert.ok(docxData.rawText.includes('Perceptron de Rosenblatt'), 'Texto bruto deve conter menções a termos do documento');
    });

    test('Deep-link para parágrafo de DOCX deve seguir protocolo docx://<id>?p=<num>', () => {
      const deepLink = 'docx://ref-relatorio-redes?p=3';
      const match = deepLink.match(/^docx:\/\/([^?]+)\?p=(\d+)$/);

      assert.ok(match, 'Deve fazer match do protocolo docx://');
      assert.equal(match[1], 'ref-relatorio-redes');
      assert.equal(parseInt(match[2], 10), 3);
    });
  });

  // =========================================================================
  // CENÁRIO 2: Visualizador e Renderização de LaTeX / TeX (RF-16)
  // =========================================================================
  describe('Cenário 2: Visualização de LaTeX (.tex) e Fórmulas KaTeX (RF-16)', () => {
    const texPath = path.join(REFS_DIR, 'hopfield1982_redes.tex');

    test('Arquivo de exemplo .tex deve existir e conter estrutura acadêmica LaTeX', () => {
      assert.ok(fs.existsSync(texPath), `Arquivo TeX deve existir em ${texPath}`);
      const content = fs.readFileSync(texPath, 'utf8');

      assert.ok(content.includes('\\title{'), 'Deve conter comando \\title');
      assert.ok(content.includes('\\begin{equation}'), 'Deve conter bloco de equações matemáticas');
      assert.ok(content.includes('\\section{'), 'Deve conter divisões de seções');
    });

    test('Banco de dados deve conter referência cadastrada para o paper em LaTeX', () => {
      initDatabase();
      const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get('ref-hopfield-1982') as ReferenceFile | undefined;

      assert.ok(ref, 'Referência TeX deve estar semeada no banco');
      assert.equal(ref.file_type, 'tex');
      assert.equal(ref.authors, 'John J. Hopfield');
      assert.equal(ref.year, 1982);
    });

    test('Deep-link para linha de código LaTeX deve seguir protocolo tex://<id>?line=<num>', () => {
      const deepLink = 'tex://ref-hopfield-1982?line=19';
      const match = deepLink.match(/^tex:\/\/([^?]+)\?line=(\d+)$/);

      assert.ok(match, 'Deve reconhecer deep-link de linha TeX');
      assert.equal(match[1], 'ref-hopfield-1982');
      assert.equal(parseInt(match[2], 10), 19);
    });
  });

  // =========================================================================
  // CENÁRIO 3: Mídia e Timestamps (Vídeo / Áudio / Imagem - RF-18)
  // =========================================================================
  describe('Cenário 3: Mídias e Citações com Marcação de Tempo (RF-18)', () => {
    test('Protocolo de citação de timestamp deve suportar media://<id>?t=<segundos>', () => {
      const timestampSecs = 142; // 02:22
      const mediaDeepLink = `media://ref-palestra-ia?t=${timestampSecs}`;

      const match = mediaDeepLink.match(/^media:\/\/([^?]+)\?t=(\d+)$/);
      assert.ok(match, 'Deve reconhecer link de timestamp de mídia');
      assert.equal(match[1], 'ref-palestra-ia');
      assert.equal(parseInt(match[2], 10), 142);

      // Formatação legível em minutos e segundos
      const minutes = Math.floor(timestampSecs / 60);
      const seconds = timestampSecs % 60;
      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      assert.equal(formatted, '02:22');
    });

    test('Persistência de citação vinculada a timestamp ou âncora de mídia no SQLite', () => {
      initDatabase();
      const testCitationId = `cite-media-test-${Date.now()}`;

      db.prepare(`
        INSERT INTO citations (id, note_id, reference_id, quote_text, page_number, anchor_data)
        VALUES (?, 'note-redes-neurais', 'ref-hopfield-1982', 'Discussão sobre mínimos locais de energia', 1, 't=142')
      `).run(testCitationId);

      const check = db.prepare('SELECT * FROM citations WHERE id = ?').get(testCitationId) as Citation | undefined;
      assert.ok(check, 'Citação de mídia deve ser gravada no banco');
      assert.equal(check.anchor_data, 't=142');
      assert.equal(check.quote_text, 'Discussão sobre mínimos locais de energia');

      // Limpeza
      db.prepare('DELETE FROM citations WHERE id = ?').run(testCitationId);
    });
  });

  // =========================================================================
  // CENÁRIO 4: Integridade de Múltiplos Formatos e Citações no Repositório
  // =========================================================================
  describe('Cenário 4: Acervo Multi-Formato e Resolução de Tipos', () => {
    test('O acervo deve catalogar referências dos tipos pdf, docx e tex simultaneamente', () => {
      initDatabase();
      const refs = db.prepare('SELECT file_type, count(*) as count FROM references_files GROUP BY file_type').all() as { file_type: string; count: number }[];

      const types = refs.map(r => r.file_type);
      assert.ok(types.includes('pdf'), 'Deve conter referências PDF');
      assert.ok(types.includes('docx'), 'Deve conter referências DOCX');
      assert.ok(types.includes('tex'), 'Deve conter referências TeX');
    });

    test('Cada referência deve apontar para arquivo existente no diretório references', () => {
      initDatabase();
      const refs = db.prepare('SELECT id, file_path, file_type FROM references_files').all() as { id: string; file_path: string; file_type: string }[];

      for (const ref of refs) {
        const fullPath = path.isAbsolute(ref.file_path) ? ref.file_path : path.join(DATA_DIR, ref.file_path);
        assert.ok(fs.existsSync(fullPath), `Arquivo de ${ref.id} (${ref.file_type}) deve existir fisicamente em ${fullPath}`);
      }
    });
  });

});
