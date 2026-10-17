import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, initDatabase } from '../server/db.js';
import { server } from '../server/index.js';
import { StudyPlan, StudyTopic, Exercise, Simulation } from '../src/types.js';

describe('Atividade 3.2: Módulo de Planos de Estudo e Exercícios (RF-22 a RF-26 e Cenário 3 BDD)', () => {
  const testUserId = `user-study-${Date.now()}`;
  const noteId = `note-theory-${Date.now()}`;
  const refId = `ref-textbook-${Date.now()}`;

  let planId: string;
  let topic1Id: string;
  let topic2Id: string;
  let exercise1Id: string;
  let exercise2Id: string;
  let simulationId: string;

  before(async () => {
    initDatabase();

    // 1. Criar usuário de teste
    db.prepare(`
      INSERT INTO users (id, username, password_hash, name)
      VALUES (?, ?, 'hash123', 'Estudante Teste')
    `).run(testUserId, `estudante_${Date.now()}`);

    // 2. Criar nota teórica de embasamento
    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, file_type)
      VALUES (?, ?, 'Conceitos Fundamentais de Redes Neurais', '<p>Teoria sobre neurônios artificiais e funções de ativação sigmoide e ReLU.</p>', 'docx')
    `).run(noteId, testUserId);

    // 3. Criar referência bibliográfica de leitura
    db.prepare(`
      INSERT INTO references_files (id, user_id, title, file_path, file_type, authors, year)
      VALUES (?, ?, 'Deep Learning Book (Goodfellow et al.)', 'references/deep_learning.pdf', 'pdf', 'Ian Goodfellow', 2016)
    `).run(refId, testUserId);
  });

  after(() => {
    try {
      if (simulationId) {
        db.prepare('DELETE FROM simulation_answers WHERE simulation_id = ?').run(simulationId);
        db.prepare('DELETE FROM simulations WHERE id = ?').run(simulationId);
      }
      if (exercise1Id) db.prepare('DELETE FROM exercises WHERE id = ?').run(exercise1Id);
      if (exercise2Id) db.prepare('DELETE FROM exercises WHERE id = ?').run(exercise2Id);
      if (topic1Id) db.prepare('DELETE FROM study_topics WHERE id = ?').run(topic1Id);
      if (topic2Id) db.prepare('DELETE FROM study_topics WHERE id = ?').run(topic2Id);
      if (planId) db.prepare('DELETE FROM study_plans WHERE id = ?').run(planId);
      db.prepare('DELETE FROM notes WHERE id = ?').run(noteId);
      db.prepare('DELETE FROM references_files WHERE id = ?').run(refId);
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    } catch {}
  });

  // =========================================================================
  // CENÁRIO 1: Planos e Cronogramas de Estudo Sequenciais (RF-22 e RF-23)
  // =========================================================================
  describe('Cenário 1: Planos e Cronogramas de Estudo Sequenciais (RF-22 e RF-23)', () => {
    test('POST /api/study-plans deve criar novo plano de estudos estruturado', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/study-plans',
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Mestrado em Inteligência Artificial',
          description: 'Trilha de preparação e leitura obrigatória para qualificação',
          target_date: '2026-12-31'
        }
      });

      assert.equal(res.statusCode, 200);
      const plan = JSON.parse(res.body) as StudyPlan;
      assert.ok(plan.id, 'Plano deve conter ID gerado');
      assert.equal(plan.title, 'Mestrado em Inteligência Artificial');
      assert.equal(plan.progress_percent, 0);

      planId = plan.id;
    });

    test('POST /api/study-plans/:id/topics deve adicionar tópicos com notas e referências vinculadas', async () => {
      // Tópico 1
      const res1 = await server.inject({
        method: 'POST',
        url: `/api/study-plans/${planId}/topics`,
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Módulo 1: Fundamentos de Otimização e Gradiente Descendente',
          order_index: 1,
          estimated_hours: 6,
          notes_ids: [noteId],
          references_ids: [refId]
        }
      });
      assert.equal(res1.statusCode, 200);
      const t1 = JSON.parse(res1.body) as StudyTopic;
      assert.ok(t1.id);
      assert.equal(t1.title, 'Módulo 1: Fundamentos de Otimização e Gradiente Descendente');
      assert.deepEqual(t1.notes_ids, [noteId]);
      topic1Id = t1.id;

      // Tópico 2
      const res2 = await server.inject({
        method: 'POST',
        url: `/api/study-plans/${planId}/topics`,
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Módulo 2: Regularização e Dropout',
          order_index: 2,
          estimated_hours: 4,
          notes_ids: [],
          references_ids: [refId]
        }
      });
      assert.equal(res2.statusCode, 200);
      const t2 = JSON.parse(res2.body) as StudyTopic;
      topic2Id = t2.id;
    });

    test('GET /api/study-plans deve listar planos com progresso percentual calculado', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/study-plans',
        headers: { 'x-user-id': testUserId }
      });

      assert.equal(res.statusCode, 200);
      const plans = JSON.parse(res.body) as StudyPlan[];
      const p = plans.find((item) => item.id === planId);
      assert.ok(p, 'Plano criado deve ser listado');
      assert.equal(p?.total_topics, 2, 'Deve registrar 2 tópicos no plano');
      assert.equal(p?.completed_topics, 0);
      assert.equal(p?.progress_percent, 0);

      // Concluir Tópico 1
      const updateRes = await server.inject({
        method: 'PUT',
        url: `/api/study-topics/${topic1Id}`,
        headers: { 'x-user-id': testUserId },
        payload: { status: 'completed' }
      });
      assert.equal(updateRes.statusCode, 200);

      // Reconsultar planos
      const resUpdated = await server.inject({
        method: 'GET',
        url: '/api/study-plans',
        headers: { 'x-user-id': testUserId }
      });
      const pUpdated = JSON.parse(resUpdated.body).find((item: any) => item.id === planId);
      assert.equal(pUpdated.completed_topics, 1);
      assert.equal(pUpdated.progress_percent, 50, 'Progresso deve ser 50% após concluir 1 de 2 tópicos');
    });
  });

  // =========================================================================
  // CENÁRIO 2: Banco de Exercícios e Cenário 3 de BDD (RF-24 e BDD Cenário 3)
  // =========================================================================
  describe('Cenário 2: Resolução de Exercício com Vínculo Teórico (RF-24 e Cenário 3 BDD)', () => {
    test('POST /api/exercises deve cadastrar exercícios vinculados a temas, notas e referências', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          topic_id: topic1Id,
          note_id: noteId,
          reference_id: refId,
          question: 'Qual função de ativação atenua o problema do desvanecimento de gradientes em redes profundas?',
          type: 'multiple_choice',
          options: ['Função Degrau de Heaviside', 'Sigmoide Logística', 'ReLU (Rectified Linear Unit)', 'Linear Pura'],
          correct_answer: '2', // Índice 2 -> ReLU
          explanation: 'A função ReLU possui derivada unitária para valores positivos, evitando a saturação do gradiente que ocorre nas extremidades da sigmoide.',
          difficulty: 'medium'
        }
      });

      assert.equal(res.statusCode, 200);
      const ex = JSON.parse(res.body) as Exercise;
      assert.ok(ex.id);
      assert.equal(ex.note_id, noteId);
      assert.equal(ex.reference_id, refId);
      assert.equal(ex.note_title, 'Conceitos Fundamentais de Redes Neurais');

      exercise1Id = ex.id;
    });

    test('Cadastrar segundo exercício para o simulado', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/exercises',
        headers: { 'x-user-id': testUserId },
        payload: {
          topic_id: topic2Id,
          note_id: noteId,
          question: 'Qual a principal finalidade da técnica de Dropout durante o treinamento?',
          type: 'multiple_choice',
          options: ['Acelerar a convergência', 'Prevenir overfitting desativando neurônios aleatoriamente', 'Normalizar o batch de entrada'],
          correct_answer: '1',
          explanation: 'O Dropout desativa uma fração de conexões a cada iteração, forçando a rede a aprender representações robustas e redundantes.',
          difficulty: 'easy'
        }
      });
      assert.equal(res.statusCode, 200);
      exercise2Id = JSON.parse(res.body).id;
    });

    test('BDD Cenário 3: Resposta incorreta deve retornar gabarito comentado e links conceituais para revisão imediata', async () => {
      // Usuário submete resposta incorreta (índice '1' em vez de '2')
      const res = await server.inject({
        method: 'POST',
        url: `/api/exercises/${exercise1Id}/verify`,
        headers: { 'x-user-id': testUserId },
        payload: { answer: '1' }
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.body);

      // Verificações estritas do Cenário 3 BDD:
      // 1. Resposta incorreta identificada
      assert.equal(result.is_correct, false, 'Deve acusar resposta incorreta');

      // 2. Exibição do gabarito oficial e explicação comentada
      assert.equal(result.correct_answer, '2');
      assert.ok(result.explanation.includes('saturação do gradiente'), 'Deve prover explicação teórica completa');

      // 3. Links diretos para nota conceitual e referência bibliográfica
      assert.equal(result.note_id, noteId, 'Deve conter link de identificador para a nota conceitual');
      assert.equal(result.note_title, 'Conceitos Fundamentais de Redes Neurais');
      assert.equal(result.reference_id, refId, 'Deve conter link de identificador para a fonte bibliográfica');
      assert.equal(result.reference_title, 'Deep Learning Book (Goodfellow et al.)');
    });

    test('Resposta correta deve ser confirmada com sucesso', async () => {
      const res = await server.inject({
        method: 'POST',
        url: `/api/exercises/${exercise1Id}/verify`,
        headers: { 'x-user-id': testUserId },
        payload: { answer: '2' }
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.body);
      assert.equal(result.is_correct, true, 'Deve validar resposta correta');
    });
  });

  // =========================================================================
  // CENÁRIO 3: Simulados, Provas e Diagnóstico de Revisão (RF-25)
  // =========================================================================
  describe('Cenário 3: Simulados e Provas com Diagnóstico (RF-25)', () => {
    test('POST /api/simulations deve criar simulado com temporizador e compilação de questões', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/simulations',
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Simulado Diagnóstico 1',
          plan_id: planId,
          duration_minutes: 20
        }
      });

      assert.equal(res.statusCode, 200);
      const sim = JSON.parse(res.body);
      assert.ok(sim.id);
      assert.equal(sim.duration_minutes, 20);
      assert.ok(sim.questions.length >= 2, 'Simulado deve compilar as questões dos tópicos do plano');

      simulationId = sim.id;
    });

    test('POST /api/simulations/:id/finish deve computar score e diagnosticar tópicos com erro para revisão', async () => {
      // Usuário responde: questão 1 errada ('0'), questão 2 certa ('1')
      const res = await server.inject({
        method: 'POST',
        url: `/api/simulations/${simulationId}/finish`,
        headers: { 'x-user-id': testUserId },
        payload: {
          answers: [
            { exercise_id: exercise1Id, selected_answer: '0', time_spent_seconds: 45 },
            { exercise_id: exercise2Id, selected_answer: '1', time_spent_seconds: 30 }
          ]
        }
      });

      assert.equal(res.statusCode, 200);
      const result = JSON.parse(res.body);

      // Score: 1 de 2 acertos = 50%
      assert.equal(result.correct_count, 1);
      assert.equal(result.total_questions, 2);
      assert.equal(result.score, 50);

      // Diagnóstico de revisão (RF-25): deve listar o tópico onde ocorreu o erro
      assert.ok(result.review_recommendations.length >= 1, 'Deve recomendar tópicos com erro para revisão');
      const rec = result.review_recommendations[0];
      assert.ok(rec.title.includes('Módulo 1'), 'Tópico 1 deve constar no diagnóstico de revisão');
      assert.equal(rec.incorrect, 1);
      assert.equal(rec.note_id, noteId, 'Deve sugerir nota conceitual para estudo complementar');
    });
  });

  // =========================================================================
  // CENÁRIO 4: Fichamento Acadêmico e Resumo de Livro (RF-26)
  // =========================================================================
  describe('Cenário 4: Fichamento e Resumos de Livro (RF-26)', () => {
    test('Criação de nota formatada com template de fichamento deve preservar estrutura e metadados', async () => {
      const templateContent = `<h1>Fichamento de Livro: Teste Teórico</h1>
<h2>1. Tese Central da Obra</h2>
<p>O cérebro computacional opera com adaptação plástica de pesos sinápticos.</p>
<h2>2. Argumentos Secundários</h2>
<ul><li>Argumento 1: Aprendizado supervisionado por correção de erro.</li></ul>
<h2>3. Citações-Chave</h2>
<blockquote>"A citação textual fundamental." — [Paper PDF](pdf://ref-goodfellow?page=15)</blockquote>
<h2>4. Conexões Conceituais</h2>
<p>Ver também [[Backpropagation]].</p>`;

      const res = await server.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { 'x-user-id': testUserId },
        payload: {
          title: 'Fichamento: Teste Teórico',
          content: templateContent,
          file_type: 'docx'
        }
      });

      assert.equal(res.statusCode, 200);
      const note = JSON.parse(res.body);
      assert.ok(note.id);
      assert.ok(note.content.includes('Tese Central da Obra'));
      assert.ok(note.content.includes('Citações-Chave'));

      // Limpeza da nota de fichamento
      db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
    });
  });
});
