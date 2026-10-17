import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server/index.js';
import { db } from '../server/db.js';
import {
  StudyPlan,
  StudyTopic,
  Exercise,
  ExerciseVerifyResult,
  Simulation,
  Article,
  CompileResult
} from '../src/types.js';
import { extractZipEntries } from '../server/docx.js';

describe('Atividade 3.4: Validação do Fluxo de Estudos & BDD Cenário 3', () => {
  const testUserId = `user-validation-${Date.now()}`;
  let noteTheoryId = '';
  let refPaperId = '';
  let exerciseId = '';
  let planId = '';
  let topic1Id = '';
  let topic2Id = '';
  let exTopic1_1 = '';
  let exTopic1_2 = '';
  let exTopic2_1 = '';
  let exTopic2_2 = '';
  let simulationId = '';

  before(async () => {
    await server.ready();

    // 1. Cria usuário de teste
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, name)
      VALUES (?, ?, ?, ?)
    `).run(testUserId, `validator_${Date.now()}`, 'hash_test', 'Prof. Alan Turing');

    // 2. Cria nota conceitual de fundamentação teórica
    noteTheoryId = `note-theory-${Date.now()}`;
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content)
      VALUES (?, ?, ?, ?)
    `).run(
      noteTheoryId,
      testUserId,
      'Convoluções e Invariância Espacial',
      'Filtros convolucionais aplicam operações lineares locais preservando a topologia espacial 2D de tensores de imagem.'
    );

    // 3. Cria paper de referência bibliográfica
    refPaperId = `ref-paper-${Date.now()}`;
    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year, doi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      refPaperId,
      testUserId,
      'Deep Residual Learning for Image Recognition',
      'references/resnet.pdf',
      'pdf',
      'He, K., Zhang, X., Ren, S., Sun, J.',
      2016,
      '10.1109/CVPR.2016.90'
    );
  });

  after(async () => {
    if (simulationId) {
      db.prepare('DELETE FROM simulations WHERE id = ?').run(simulationId);
    }
    const allExs = [exerciseId, exTopic1_1, exTopic1_2, exTopic2_1, exTopic2_2].filter(Boolean);
    for (const id of allExs) {
      db.prepare('DELETE FROM exercises WHERE id = ?').run(id);
    }
    if (planId) {
      db.prepare('DELETE FROM study_plans WHERE id = ?').run(planId);
    }
    if (noteTheoryId) {
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteTheoryId);
    }
    if (refPaperId) {
      db.prepare('DELETE FROM references_files WHERE id = ?').run(refPaperId);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  });

  // =========================================================================
  // CENÁRIO 3 BDD: Resolução de Exercício com Vínculo Teórico
  // =========================================================================
  describe('Cenário 3 BDD: Resolução de Exercício com Vínculo Teórico', () => {
    test('Dado que o usuário tem um exercício cadastrado com vínculos teóricos e bibliográficos', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          note_id: noteTheoryId,
          reference_id: refPaperId,
          question: 'Qual o principal benefício da conexão residual (skip connection) em redes neurais profundas?',
          type: 'multiple_choice',
          options: [
            'Aumentar o número de parâmetros ajustáveis exponencialmente',
            'Mitigar o desaparecimento do gradiente permitindo fluxo direto de informação entre camadas',
            'Eliminar a necessidade de convoluções',
            'Garantir que a função de perda seja estritamente convexa'
          ],
          correct_answer: 'Mitigar o desaparecimento do gradiente permitindo fluxo direto de informação entre camadas',
          explanation: 'Conexões de salto permitem que os gradientes fluam diretamente pelas camadas sem sofrer decaimento por produtos de matrizes de peso sucessivas.',
          difficulty: 'hard'
        }
      });

      assert.equal(res.statusCode, 200);
      const ex = JSON.parse(res.body) as Exercise;
      assert.ok(ex.id);
      assert.equal(ex.note_id, noteTheoryId);
      assert.equal(ex.reference_id, refPaperId);
      exerciseId = ex.id;
    });

    test('Quando o usuário submete a resposta incorreta, Então o sistema deve retornar gabarito comentado e links conceituais', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/exercises/${exerciseId}/verify`,
        headers: { 'x-user-id': testUserId },
        payload: {
          answer: 'Aumentar o número de parâmetros ajustáveis exponencialmente'
        }
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.body) as ExerciseVerifyResult;

      // Validação das asserções do Critério de Aceite BDD Cenário 3
      assert.equal(result.is_correct, false, 'Deve identificar submissão incorreta');
      assert.equal(
        result.correct_answer,
        'Mitigar o desaparecimento do gradiente permitindo fluxo direto de informação entre camadas',
        'Deve apresentar a resposta correta oficial'
      );
      assert.ok(result.explanation.includes('Conexões de salto'), 'Deve apresentar gabarito comentado');
      assert.equal(result.note_id, noteTheoryId, 'Deve fornecer link para a anotação conceitual');
      assert.equal(result.note_title, 'Convoluções e Invariância Espacial');
      assert.equal(result.reference_id, refPaperId, 'Deve fornecer link para a referência bibliográfica');
      assert.equal(result.reference_title, 'Deep Residual Learning for Image Recognition');
    });

    test('E os links conceituais retornados devem permitir navegação e recuperação imediata do conteúdo', async () => {
      // 1. Navegação para a nota conceitual sugerida
      const noteRes = await server.inject({
        method: 'GET',
        url: `/api/notes/${noteTheoryId}`,
        headers: { 'x-user-id': testUserId }
      });
      assert.equal(noteRes.statusCode, 200);
      const note = JSON.parse(noteRes.body);
      assert.ok(note.content.includes('topologia espacial 2D'), 'Conteúdo teórico da nota deve estar disponível para estudo imediato');

      // 2. Navegação para a referência bibliográfica sugerida
      const refRes = await server.inject({
        method: 'GET',
        url: `/api/references`,
        headers: { 'x-user-id': testUserId }
      });
      assert.equal(refRes.statusCode, 200);
      const refs = JSON.parse(refRes.body);
      const foundRef = refs.find((r: any) => r.id === refPaperId);
      assert.ok(foundRef, 'Referência bibliográfica deve existir no acervo');
      assert.equal(foundRef.year, 2016);
      assert.equal(foundRef.authors, 'He, K., Zhang, X., Ren, S., Sun, J.');
    });

    test('Quando o usuário submete a resposta correta, Então o sistema deve confirmar o acerto', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/exercises/${exerciseId}/verify`,
        headers: { 'x-user-id': testUserId },
        payload: {
          answer: 'Mitigar o desaparecimento do gradiente permitindo fluxo direto de informação entre camadas'
        }
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.body) as ExerciseVerifyResult;
      assert.equal(result.is_correct, true, 'Deve validar acerto com sucesso');
      assert.ok(result.explanation);
    });
  });

  // =========================================================================
  // SIMULADOS AVALIATIVOS & DIAGNÓSTICO DE ERROS (RF-25)
  // =========================================================================
  describe('Simulados Avaliativos e Diagnóstico Automático de Tópicos com Erro (RF-25)', () => {
    test('Configurar Plano de Estudos com dois tópicos distintos', async () => {
      // Criar plano
      const planRes = await server.inject({
        method: 'POST',
        url: '/api/study-plans',
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Trilha Especializada em Visão Computacional',
          description: 'Estudo aprofundado de filtros lineares e otimização'
        }
      });
      assert.equal(planRes.statusCode, 200);
      const plan = JSON.parse(planRes.body) as StudyPlan;
      planId = plan.id;

      // Tópico 1: Álgebra Linear
      const t1Res = await server.inject({
        method: 'POST',
        url: `/api/study-plans/${planId}/topics`,
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Tópico 1: Álgebra Linear e Decomposição Espectral',
          order_index: 1,
          estimated_hours: 4,
          notes_ids: [noteTheoryId]
        }
      });
      assert.equal(t1Res.statusCode, 200);
      topic1Id = JSON.parse(t1Res.body).id;

      // Tópico 2: Otimização Convexa
      const t2Res = await server.inject({
        method: 'POST',
        url: `/api/study-plans/${planId}/topics`,
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Tópico 2: Otimização Não-Convexa e Superfícies de Perda',
          order_index: 2,
          estimated_hours: 6,
          references_ids: [refPaperId]
        }
      });
      assert.equal(t2Res.statusCode, 200);
      topic2Id = JSON.parse(t2Res.body).id;
    });

    test('Cadastrar 4 questões distribuídas igualmente nos 2 tópicos', async () => {
      // Questão Tópico 1 - Item 1
      const q1 = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          topic_id: topic1Id,
          note_id: noteTheoryId,
          question: 'Uma matriz simétrica real admite autovalores complexos?',
          options: ['Sim', 'Não, todos os autovalores são estritamente reais'],
          correct_answer: 'Não, todos os autovalores são estritamente reais',
          explanation: 'Pelo Teorema Espectral, operadores auto-adjuntos reais possuem autovalores estritamente reais.',
          difficulty: 'medium'
        }
      });
      exTopic1_1 = JSON.parse(q1.body).id;

      // Questão Tópico 1 - Item 2
      const q2 = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          topic_id: topic1Id,
          question: 'O determinante de uma matriz ortogonal é sempre:',
          options: ['Zero', '+1 ou -1', 'Infinito'],
          correct_answer: '+1 ou -1',
          explanation: 'Como Q^T * Q = I, det(Q)^2 = 1, logo det(Q) = ±1.',
          difficulty: 'easy'
        }
      });
      exTopic1_2 = JSON.parse(q2.body).id;

      // Questão Tópico 2 - Item 1
      const q3 = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          topic_id: topic2Id,
          reference_id: refPaperId,
          question: 'Qual a principal causa da perda de estabilidade em gradiente descendente simples?',
          options: ['Taxa de aprendizado excessivamente alta gerando divergência', 'Número insuficiente de camadas'],
          correct_answer: 'Taxa de aprendizado excessivamente alta gerando divergência',
          explanation: 'Se a taxa eta for superior a 2/L, onde L é a constante de Lipschitz do gradiente, a descida diverge.',
          difficulty: 'medium'
        }
      });
      exTopic2_1 = JSON.parse(q3.body).id;

      // Questão Tópico 2 - Item 2
      const q4 = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          topic_id: topic2Id,
          question: 'Pontos de sela (saddle points) em altas dimensões caracterizam-se por:',
          options: ['Matriz Hessiana com autovalores positivos e negativos', 'Gradiente infinito'],
          correct_answer: 'Matriz Hessiana com autovalores positivos e negativos',
          explanation: 'O gradiente é nulo, mas a curvatura varia de sinal dependendo da direção do autovetor.',
          difficulty: 'hard'
        }
      });
      exTopic2_2 = JSON.parse(q4.body).id;
    });

    test('POST /api/simulations deve criar simulado compilando as questões da trilha', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/simulations',
        headers: { 'x-user-id': testUserId },
        payload: {
          plan_id: planId,
          title: 'Simulado Geral da Trilha de Visão',
          duration_minutes: 25
        }
      });

      assert.equal(res.statusCode, 200);
      const sim = JSON.parse(res.body) as Simulation & { questions: any[] };
      assert.ok(sim.id);
      assert.equal(sim.duration_minutes, 25);
      assert.equal(sim.total_questions, 4, 'Deve conter as 4 questões dos tópicos');
      assert.equal(sim.questions.length, 4);
      simulationId = sim.id;
    });

    test('POST /api/simulations/:id/finish deve computar score exato e diagnosticar tópicos com erro', async () => {
      // Cenário de submissão:
      // Tópico 1 (Álgebra Linear): 2 ACERTOS
      // Tópico 2 (Otimização): 2 ERROS
      const submissionAnswers = [
        { exercise_id: exTopic1_1, selected_answer: 'Não, todos os autovalores são estritamente reais' }, // CORRETO
        { exercise_id: exTopic1_2, selected_answer: '+1 ou -1' }, // CORRETO
        { exercise_id: exTopic2_1, selected_answer: 'Número insuficiente de camadas' }, // INCORRETO
        { exercise_id: exTopic2_2, selected_answer: 'Gradiente infinito' } // INCORRETO
      ];

      const res = await server.inject({
        method: 'POST',
        url: `/api/simulations/${simulationId}/finish`,
        headers: { 'x-user-id': testUserId },
        payload: {
          answers: submissionAnswers
        }
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.body);

      // Verificações de aproveitamento (2 de 4 = 50%)
      assert.equal(result.correct_count, 2);
      assert.equal(result.score, 50, 'Score deve ser exatamente 50%');
      assert.ok(result.completed_at, 'Deve registrar data de finalização');

      // Verificação do Diagnóstico de Tópicos
      const recs = result.review_recommendations as Array<{ title: string; total: number; incorrect: number; note_id?: string; reference_id?: string }>;
      assert.ok(Array.isArray(recs));
      assert.equal(recs.length, 1, 'Apenas o tópico com erro deve figurar na recomendação prioritária');
      assert.equal(recs[0].title, 'Tópico 2: Otimização Não-Convexa e Superfícies de Perda');
      assert.equal(recs[0].incorrect, 2, 'Deve contabilizar 2 erros');
    });
  });

  // =========================================================================
  // INTEGRIDADE DE EXPORTAÇÃO CIENTÍFICA (RF-31)
  // =========================================================================
  describe('Consistência e Formatação de Exportação Científica (RF-31)', () => {
    test('Compilação ABNT, IEEE e APA deve formatar autores e referências conforme norma', async () => {
      const sampleData = {
        title: 'Estudo das Redes Residuais',
        authors: 'Alan Turing',
        abstract: 'Resumo sobre skip connections.',
        content: '# 1. Introdução\n\nTexto demonstrativo.',
        citations: [
          {
            key: 'he2016',
            title: 'Deep Residual Learning for Image Recognition',
            authors: 'He, K., Zhang, X.',
            year: 2016,
            doi: '10.1109/CVPR.2016.90'
          }
        ]
      };

      // 1. Estilo ABNT
      const resAbnt = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'md',
          data: sampleData,
          options: { citationStyle: 'ABNT', includeBibliography: true }
        }
      });
      const mdAbnt = JSON.parse(resAbnt.body).compiled;
      assert.ok(mdAbnt.includes('HE, K., ZHANG, X.'), 'ABNT deve colocar autores em CAIXA ALTA');
      assert.ok(mdAbnt.includes('DOI: https://doi.org/10.1109/CVPR.2016.90'));

      // 2. Estilo IEEE
      const resIeee = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'md',
          data: sampleData,
          options: { citationStyle: 'IEEE', includeBibliography: true }
        }
      });
      const mdIeee = JSON.parse(resIeee.body).compiled;
      assert.ok(mdIeee.includes('[1] He, K., Zhang, X., "Deep Residual Learning for Image Recognition"'));

      // 3. Estilo APA
      const resApa = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'md',
          data: sampleData,
          options: { citationStyle: 'APA', includeBibliography: true }
        }
      });
      const mdApa = JSON.parse(resApa.body).compiled;
      assert.ok(mdApa.includes('He, K., Zhang, X. (2016). Deep Residual Learning'));
    });

    test('Tratamento resiliente de fontes sem ano (s.d.) ou sem autor', async () => {
      const edgeData = {
        title: 'Trabalho com Fontes Incompletas',
        content: 'Conteúdo do artigo.',
        citations: [
          {
            key: 'ref_anonima',
            title: 'Manuscrito Histórico Anônimo'
          }
        ]
      };

      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'md',
          data: edgeData,
          options: { citationStyle: 'ABNT', includeBibliography: true }
        }
      });

      const md = JSON.parse(res.body).compiled;
      assert.ok(md.includes('AUTOR DESCONHECIDO'));
      assert.ok(md.includes('s.d.'));
    });

    test('LaTeX com fórmulas matemáticas e caracteres especiais deve ser devidamente escapado', async () => {
      const mathData = {
        title: 'Modelos Estocásticos & Funções de Perda (%)',
        authors: 'Ada Lovelace & Alan Turing',
        content: '# 1. Definições\n\nConsidere $f(x) = x^2$ e custo $\\mathcal{L}$.\n\nA taxa de erro foi de 15% na classe A & B.',
        citations: [
          {
            key: 'math_ref',
            title: 'Teoria da Computação & Complexidade',
            year: 1936
          }
        ]
      };

      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'tex',
          data: mathData
        }
      });

      const tex = JSON.parse(res.body).compiled;
      // Caracteres especiais & e % devem estar escapados
      assert.ok(tex.includes('\\&'), '& deve ser escapado como \\&');
      assert.ok(tex.includes('\\%'), '% deve ser escapado como \\%');
      assert.ok(tex.includes('\\begin{thebibliography}'));
      assert.ok(tex.includes('\\end{document}'));
    });

    test('DOCX exportado deve conter arquivos válidos no formato OpenXML', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'docx',
          data: {
            title: 'Validação OpenXML DOCX',
            content: '# Introdução\n\nTeste de robustez do pacote.',
            citations: [{ key: 'c1', title: 'Fonte' }]
          }
        }
      });

      const json = JSON.parse(res.body);
      const buf = Buffer.from(json.base64, 'base64');
      const entries = extractZipEntries(buf);

      assert.ok(entries['[Content_Types].xml'], 'Deve conter [Content_Types].xml');
      assert.ok(entries['word/document.xml'], 'Deve conter word/document.xml');
      assert.ok(entries['_rels/.rels'], 'Deve conter _rels/.rels');
    });

    test('PDF gerado deve possuir cabeçalho binário %PDF-1.4 e referências cruzadas válidas', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/export/compile',
        payload: {
          format: 'pdf',
          data: {
            title: 'Validação PDF 1.4',
            content: '# Seção 1\n\nTexto de teste com paginação.',
            citations: [{ key: 'c1', title: 'Fonte ABNT' }]
          }
        }
      });

      const json = JSON.parse(res.body);
      const buf = Buffer.from(json.base64, 'base64');
      const text = buf.toString('latin1');

      assert.ok(text.startsWith('%PDF-1.4'), 'Assinatura mágica do arquivo deve ser %PDF-1.4');
      assert.ok(text.includes('xref'), 'Tabela de referências cruzadas deve existir');
      assert.ok(text.includes('trailer'), 'Dicionário trailer deve existir');
      assert.ok(text.includes('%%EOF'), 'Marcador de final de arquivo %%EOF deve existir');
    });
  });

  // =========================================================================
  // MODELO DE FICHAMENTO DE LIVROS (RF-26)
  // =========================================================================
  describe('Fichamentos e Resumos de Livros (RF-26)', () => {
    test('Template estruturado deve contemplar teses centrais, argumentos secundários e conexões Wikilink', async () => {
      const templateTitle = 'Fichamento: The Design of Everyday Things';
      const templateContent = `<h1>Fichamento de Livro: The Design of Everyday Things</h1>
<p><strong>Autor(a):</strong> Don Norman</p>
<h2>1. Tese Central da Obra</h2>
<p>Objetos devem ser desenhados considerando a psicologia cognitiva humana através de affordances e signifiers.</p>
<h2>2. Argumentos Secundários e Estrutura</h2>
<ul>
  <li>Mapeamento natural entre controles e efeitos no mundo real</li>
  <li>Feedback imediato em ações do usuário</li>
</ul>
<h2>3. Citações-Chave e Coordenadas</h2>
<blockquote>"Dois dos fatores mais importantes para o bom design são a visibilidade e o modelo conceitual correto."</blockquote>
<h2>4. Conexões Conceituais (Wikilinks)</h2>
<p>Relaciona-se com [[Psicologia Cognitiva]] e [[Acessibilidade Digital]].</p>
<h2>5. Impressões Críticas e Síntese Pessoal</h2>
<p>Leitura essencial para engenharia de software centrada no ser humano.</p>`;

      const createRes = await server.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { 'x-user-id': testUserId },
        payload: {
          title: templateTitle,
          content: templateContent
        }
      });

      assert.equal(createRes.statusCode, 200);
      const note = JSON.parse(createRes.body);
      assert.ok(note.id);
      assert.equal(note.title, templateTitle);
      assert.ok(note.content.includes('Tese Central da Obra'));
      assert.ok(note.content.includes('Conexões Conceituais (Wikilinks)'));

      // Limpeza
      await server.inject({
        method: 'DELETE',
        url: `/api/notes/${note.id}`,
        headers: { 'x-user-id': testUserId }
      });
    });
  });
});
