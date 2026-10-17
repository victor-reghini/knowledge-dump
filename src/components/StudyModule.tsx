import React, { useState, useEffect, useCallback } from 'react';
import {
  StudyPlan,
  StudyTopic,
  Exercise,
  ExerciseVerifyResult,
  Simulation,
  Note,
  ReferenceFile
} from '../types';
import { api } from '../api';
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  HelpCircle,
  Award,
  ChevronRight,
  ListTodo,
  BookMarked,
  Layers,
  ArrowRight
} from 'lucide-react';

interface StudyModuleProps {
  allNotes: Note[];
  references: ReferenceFile[];
  onSelectNote: (noteId: string) => void;
  onSelectReference: (refId: string) => void;
  onCreateNoteWithTemplate: (title: string, content: string) => void;
  onClose?: () => void;
}

export const StudyModule: React.FC<StudyModuleProps> = ({
  allNotes,
  references,
  onSelectNote,
  onSelectReference,
  onCreateNoteWithTemplate,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'exercises' | 'simulations' | 'fichamento'>('plans');

  // Study Plans State
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // New Plan modal / form
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanDescription, setNewPlanDescription] = useState('');
  const [newPlanTargetDate, setNewPlanTargetDate] = useState('');

  // New Topic form
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicHours, setNewTopicHours] = useState('2');
  const [newTopicDueDate, setNewTopicDueDate] = useState('');
  const [newTopicSelectedNotes, setNewTopicSelectedNotes] = useState<string[]>([]);
  const [newTopicSelectedRefs, setNewTopicSelectedRefs] = useState<string[]>([]);

  // Exercises State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [exerciseFilterTopicId, setExerciseFilterTopicId] = useState<string>('all');

  // New Exercise Form
  const [newExQuestion, setNewExQuestion] = useState('');
  const [newExOptions, setNewExOptions] = useState<string[]>(['', '', '', '']);
  const [newExCorrectIndex, setNewExCorrectIndex] = useState(0);
  const [newExExplanation, setNewExExplanation] = useState('');
  const [newExDifficulty, setNewExDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [newExTopicId, setNewExTopicId] = useState<string>('');
  const [newExNoteId, setNewExNoteId] = useState<string>('');
  const [newExRefId, setNewExRefId] = useState<string>('');

  // Interactive Exercise Verification (BDD Cenário 3)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, ExerciseVerifyResult>>({});
  const [verifyingExId, setVerifyingExId] = useState<string | null>(null);

  // Simulations State
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loadingSimulations, setLoadingSimulations] = useState(true);
  const [isCreatingSim, setIsCreatingSim] = useState(false);
  const [newSimTitle, setNewSimTitle] = useState('');
  const [newSimDuration, setNewSimDuration] = useState('30');
  const [newSimPlanId, setNewSimPlanId] = useState<string>('');

  // Active Simulation Execution State
  const [activeSim, setActiveSim] = useState<(Simulation & { questions: any[] }) | null>(null);
  const [activeSimAnswers, setActiveSimAnswers] = useState<Record<string, string>>({});
  const [simTimeRemaining, setSimTimeRemaining] = useState<number>(0);
  const [simFinishedResult, setSimFinishedResult] = useState<any | null>(null);

  // Load Study Plans
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      const data = await api.getStudyPlans();
      setPlans(data);
      if (data.length > 0 && !selectedPlanId) {
        setSelectedPlanId(data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
    } finally {
      setLoadingPlans(false);
    }
  }, [selectedPlanId]);

  // Load Exercises
  const loadExercises = useCallback(async () => {
    try {
      setLoadingExercises(true);
      const data = await api.getExercises();
      setExercises(data);
    } catch (err) {
      console.error('Erro ao carregar exercícios:', err);
    } finally {
      setLoadingExercises(false);
    }
  }, []);

  // Load Simulations
  const loadSimulations = useCallback(async () => {
    try {
      setLoadingSimulations(true);
      const data = await api.getSimulations();
      setSimulations(data);
    } catch (err) {
      console.error('Erro ao carregar simulados:', err);
    } finally {
      setLoadingSimulations(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
    loadExercises();
    loadSimulations();
  }, [loadPlans, loadExercises, loadSimulations]);

  // Active Simulation Timer
  useEffect(() => {
    if (!activeSim || simTimeRemaining <= 0) return;
    const timer = setInterval(() => {
      setSimTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishSimulation();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSim, simTimeRemaining]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  // Handler: Create Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanTitle.trim()) return;
    try {
      const created = await api.createStudyPlan({
        title: newPlanTitle,
        description: newPlanDescription,
        target_date: newPlanTargetDate || undefined
      });
      setPlans((prev) => [created, ...prev]);
      setSelectedPlanId(created.id);
      setIsCreatingPlan(false);
      setNewPlanTitle('');
      setNewPlanDescription('');
      setNewPlanTargetDate('');
    } catch (err) {
      console.error('Erro ao criar plano:', err);
    }
  };

  // Handler: Delete Plan
  const handleDeletePlan = async (id: string) => {
    if (!confirm('Deseja realmente excluir este plano de estudos?')) return;
    try {
      await api.deleteStudyPlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlanId === id) {
        setSelectedPlanId(null);
      }
    } catch (err) {
      console.error('Erro ao excluir plano:', err);
    }
  };

  // Handler: Add Topic
  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !newTopicTitle.trim()) return;
    try {
      const created = await api.addStudyTopic(selectedPlan.id, {
        title: newTopicTitle,
        estimated_hours: parseFloat(newTopicHours) || 2,
        due_date: newTopicDueDate || undefined,
        notes_ids: newTopicSelectedNotes,
        references_ids: newTopicSelectedRefs
      });

      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === selectedPlan.id) {
            const topics = [...(p.topics || []), created];
            const completed = topics.filter((t) => t.status === 'completed').length;
            return {
              ...p,
              topics,
              total_topics: topics.length,
              completed_topics: completed,
              progress_percent: Math.round((completed / topics.length) * 100)
            };
          }
          return p;
        })
      );

      setIsAddingTopic(false);
      setNewTopicTitle('');
      setNewTopicDueDate('');
      setNewTopicSelectedNotes([]);
      setNewTopicSelectedRefs([]);
    } catch (err) {
      console.error('Erro ao adicionar tópico:', err);
    }
  };

  // Handler: Toggle Topic Status
  const handleToggleTopicStatus = async (topic: StudyTopic) => {
    const nextStatus =
      topic.status === 'completed' ? 'pending' : topic.status === 'pending' ? 'in_progress' : 'completed';

    try {
      await api.updateStudyTopic(topic.id, { status: nextStatus });
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === topic.plan_id) {
            const topics = (p.topics || []).map((t) => (t.id === topic.id ? { ...t, status: nextStatus } : t));
            const completed = topics.filter((t) => t.status === 'completed').length;
            return {
              ...p,
              topics,
              completed_topics: completed,
              progress_percent: Math.round((completed / topics.length) * 100)
            };
          }
          return p;
        })
      );
    } catch (err) {
      console.error('Erro ao atualizar status do tópico:', err);
    }
  };

  // Handler: Delete Topic
  const handleDeleteTopic = async (topicId: string, planId: string) => {
    try {
      await api.deleteStudyTopic(topicId);
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === planId) {
            const topics = (p.topics || []).filter((t) => t.id !== topicId);
            const completed = topics.filter((t) => t.status === 'completed').length;
            return {
              ...p,
              topics,
              total_topics: topics.length,
              completed_topics: completed,
              progress_percent: topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0
            };
          }
          return p;
        })
      );
    } catch (err) {
      console.error('Erro ao excluir tópico:', err);
    }
  };

  // Handler: Create Exercise
  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExQuestion.trim() || !newExExplanation.trim()) return;

    const filteredOptions = newExOptions.filter((o) => o.trim().length > 0);
    const correctAnswer = String(newExCorrectIndex);

    try {
      const created = await api.createExercise({
        question: newExQuestion,
        type: 'multiple_choice',
        options: filteredOptions,
        correct_answer: correctAnswer,
        explanation: newExExplanation,
        difficulty: newExDifficulty,
        topic_id: newExTopicId || undefined,
        note_id: newExNoteId || undefined,
        reference_id: newExRefId || undefined
      });

      setExercises((prev) => [created, ...prev]);
      setIsCreatingExercise(false);
      setNewExQuestion('');
      setNewExOptions(['', '', '', '']);
      setNewExExplanation('');
      setNewExNoteId('');
      setNewExRefId('');
    } catch (err) {
      console.error('Erro ao cadastrar exercício:', err);
    }
  };

  // Handler: Verify Single Exercise Answer (BDD Cenário 3)
  const handleVerifyExercise = async (exerciseId: string) => {
    const selected = selectedAnswers[exerciseId];
    if (selected === undefined) return;

    try {
      setVerifyingExId(exerciseId);
      const result = await api.verifyExercise(exerciseId, selected);
      setVerifyResults((prev) => ({ ...prev, [exerciseId]: result }));
    } catch (err) {
      console.error('Erro ao verificar resposta:', err);
    } finally {
      setVerifyingExId(null);
    }
  };

  // Handler: Start Simulation
  const handleStartSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSimTitle.trim()) return;

    try {
      const sim = await api.createSimulation({
        title: newSimTitle,
        plan_id: newSimPlanId || undefined,
        duration_minutes: parseInt(newSimDuration, 10) || 30
      });

      if (!sim.questions || sim.questions.length === 0) {
        alert('Nenhum exercício encontrado para compor este simulado. Cadastre exercícios primeiro.');
        return;
      }

      setActiveSim(sim);
      setActiveSimAnswers({});
      setSimTimeRemaining((sim.duration_minutes || 30) * 60);
      setSimFinishedResult(null);
      setIsCreatingSim(false);
    } catch (err) {
      console.error('Erro ao criar simulado:', err);
    }
  };

  // Handler: Finish Simulation
  const handleFinishSimulation = async () => {
    if (!activeSim) return;
    try {
      const answersPayload = activeSim.questions.map((q) => ({
        exercise_id: q.id,
        selected_answer: activeSimAnswers[q.id] || '-1'
      }));

      const finished = await api.finishSimulation(activeSim.id, answersPayload);
      setSimFinishedResult(finished);
      setActiveSim(null);
      loadSimulations();
    } catch (err) {
      console.error('Erro ao finalizar simulado:', err);
    }
  };

  // Handler: Create Book Summary Template Note (RF-26)
  const handleCreateFichamento = (title: string, author?: string) => {
    const templateContent = `<h1>Fichamento de Livro: ${title}</h1>
<p><strong>Autor(a):</strong> ${author || 'Autor da Obra'}</p>
<p><strong>Data de Leitura:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
<hr />

<h2>1. Tese Central da Obra</h2>
<p>Descreva aqui em um ou dois parágrafos o argumento fulcral defendido pelo autor ao longo do livro.</p>

<h2>2. Argumentos Secundários e Estrutura</h2>
<ul>
  <li><strong>Argumento A:</strong> Contextualização histórica e motivação teórica.</li>
  <li><strong>Argumento B:</strong> Evidências experimentais e formulação matemática.</li>
  <li><strong>Argumento C:</strong> Limitações e contra-exemplos apontados.</li>
</ul>

<h2>3. Citações-Chave e Coordenadas</h2>
<blockquote>"A citação textual mais importante da obra sintetizando a premissa."<br />— [Fonte Bibliográfica](pdf://referencia?page=1)</blockquote>

<h2>4. Conexões Conceituais (Wikilinks)</h2>
<p>Esta obra relaciona-se diretamente com [[Redes Neurais Artificiais]] e fundamenta os estudos em [[Backpropagation]].</p>

<h2>5. Impressões Críticas e Síntese Pessoal</h2>
<p>Avaliação metodológica, pontos fortes, lacunas teóricas e aplicabilidade prática na pesquisa.</p>`;

    onCreateNoteWithTemplate(`Fichamento: ${title}`, templateContent);
  };

  return (
    <div
      className="study-module-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden'
      }}
    >
      {/* Top Header & Tabs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: 'var(--primary-yellow-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-yellow-text)'
            }}
          >
            <GraduationCap size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
              Módulo de Estudos & Aprendizagem
            </h2>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Planos estruturados, exercícios conceituais, simulados e fichamentos (RF-22 a RF-26)
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`toolbar-btn ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
          >
            <Calendar size={14} />
            <span>Planos de Estudo</span>
          </button>

          <button
            className={`toolbar-btn ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
          >
            <HelpCircle size={14} />
            <span>Banco de Exercícios</span>
          </button>

          <button
            className={`toolbar-btn ${activeTab === 'simulations' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulations')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
          >
            <Award size={14} />
            <span>Simulados & Provas</span>
          </button>

          <button
            className={`toolbar-btn ${activeTab === 'fichamento' ? 'active' : ''}`}
            onClick={() => setActiveTab('fichamento')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
          >
            <BookMarked size={14} />
            <span>Fichamentos</span>
          </button>

          {onClose && (
            <button
              className="toolbar-btn"
              onClick={onClose}
              title="Fechar módulo de estudos"
              style={{ padding: '6px 10px', marginLeft: 8 }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* =========================================================================
            TAB 1: PLANOS DE ESTUDO & CRONOGRAMAS (RF-22, RF-23)
            ========================================================================= */}
        {activeTab === 'plans' && (
          <div style={{ display: 'flex', gap: 24, height: '100%', minHeight: 480 }}>
            {/* Left Column: List of Plans */}
            <div
              style={{
                width: 280,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                borderRight: '1px solid var(--border-color)',
                paddingRight: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Meus Planos</span>
                <button
                  className="toolbar-btn primary"
                  onClick={() => setIsCreatingPlan(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.78rem' }}
                >
                  <Plus size={13} />
                  <span>Novo Plano</span>
                </button>
              </div>

              {isCreatingPlan && (
                <form
                  onSubmit={handleCreatePlan}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nome do plano (ex: Concurso X)..."
                    value={newPlanTitle}
                    onChange={(e) => setNewPlanTitle(e.target.value)}
                    required
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.82rem',
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <textarea
                    placeholder="Descrição / Objetivos..."
                    value={newPlanDescription}
                    onChange={(e) => setNewPlanDescription(e.target.value)}
                    rows={2}
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      resize: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="toolbar-btn"
                      onClick={() => setIsCreatingPlan(false)}
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="toolbar-btn primary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {plans.length === 0 && !loadingPlans && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                    Nenhum plano cadastrado ainda.
                  </div>
                )}

                {plans.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: selectedPlanId === p.id ? 'var(--primary-yellow-border)' : 'var(--border-color)',
                      backgroundColor: selectedPlanId === p.id ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(p.id);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        title="Excluir plano"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: 6, backgroundColor: 'var(--border-color)', borderRadius: 3, overflow: 'hidden', margin: '6px 0' }}>
                      <div
                        style={{
                          width: `${p.progress_percent || 0}%`,
                          height: '100%',
                          backgroundColor: 'var(--accent-green)'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>{p.completed_topics || 0}/{p.total_topics || 0} tópicos</span>
                      <span>{p.progress_percent || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Selected Plan Details & Sequential Topics */}
            {selectedPlan ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 4px 0' }}>
                      {selectedPlan.title}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                      {selectedPlan.description || 'Cronograma e roteiro sequencial de estudos.'}
                    </p>
                  </div>

                  <button
                    className="toolbar-btn primary"
                    onClick={() => setIsAddingTopic(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Plus size={14} />
                    <span>Adicionar Tópico</span>
                  </button>
                </div>

                {/* Modal / Inline form to add topic */}
                {isAddingTopic && (
                  <form
                    onSubmit={handleAddTopic}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>Novo Tópico Sequencial</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="Título do Tópico (ex: Fundamentos de Grafos)..."
                        value={newTopicTitle}
                        onChange={(e) => setNewTopicTitle(e.target.value)}
                        required
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.82rem',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Horas estimadas"
                        value={newTopicHours}
                        onChange={(e) => setNewTopicHours(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.82rem',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>

                    {/* Vínculo com Notas Obrigatórias */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                        Anotações Obrigatórias Vinculadas:
                      </label>
                      <select
                        multiple
                        value={newTopicSelectedNotes}
                        onChange={(e) => {
                          const values = Array.from(e.target.selectedOptions, (option) => option.value);
                          setNewTopicSelectedNotes(values);
                        }}
                        style={{
                          width: '100%',
                          height: 64,
                          padding: '4px 8px',
                          fontSize: '0.78rem',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {allNotes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => setIsAddingTopic(false)}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="toolbar-btn primary">
                        Salvar Tópico
                      </button>
                    </div>
                  </form>
                )}

                {/* Topics Sequence List (RF-23) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(!selectedPlan.topics || selectedPlan.topics.length === 0) && (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Nenhum tópico definido neste plano. Clique em "Adicionar Tópico" para estruturar a trilha.
                    </div>
                  )}

                  {selectedPlan.topics?.map((topic, index) => {
                    const isCompleted = topic.status === 'completed';
                    const isInProgress = topic.status === 'in_progress';

                    return (
                      <div
                        key={topic.id}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {/* Checkbox toggle status */}
                          <button
                            onClick={() => handleToggleTopicStatus(topic)}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              border: `2px solid ${isCompleted ? 'var(--accent-green)' : 'var(--border-color)'}`,
                              backgroundColor: isCompleted ? 'var(--accent-green)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#ffffff'
                            }}
                          >
                            {isCompleted && <Check size={14} />}
                          </button>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.88rem', textDecoration: isCompleted ? 'line-through' : 'none' }}>
                                {index + 1}. {topic.title}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.68rem',
                                  backgroundColor: isCompleted
                                    ? 'var(--accent-green-bg)'
                                    : isInProgress
                                    ? 'var(--primary-yellow-light)'
                                    : 'var(--bg-primary)',
                                  color: isCompleted
                                    ? 'var(--accent-green)'
                                    : isInProgress
                                    ? 'var(--primary-yellow-text)'
                                    : 'var(--text-muted)'
                                }}
                              >
                                {isCompleted ? 'Concluído' : isInProgress ? 'Em Andamento' : 'Pendente'}
                              </span>
                            </div>

                            {/* Linked notes badges */}
                            {topic.notes_ids && topic.notes_ids.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Notas:</span>
                                {topic.notes_ids.map((nId) => {
                                  const n = allNotes.find((note) => note.id === nId);
                                  if (!n) return null;
                                  return (
                                    <button
                                      key={nId}
                                      onClick={() => onSelectNote(nId)}
                                      className="toolbar-btn"
                                      style={{ padding: '2px 6px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4 }}
                                      title="Abrir anotação conceitual"
                                    >
                                      <FileText size={11} />
                                      <span>{n.title}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} />
                            <span>{topic.estimated_hours}h</span>
                          </span>

                          <button
                            onClick={() => handleDeleteTopic(topic.id, selectedPlan.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                            title="Remover tópico"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Selecione ou crie um plano de estudos na barra lateral.
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: BANCO DE EXERCÍCIOS & RESOLUÇÃO (RF-24, Cenário 3 BDD)
            ========================================================================= */}
        {activeTab === 'exercises' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 2px 0' }}>
                  Banco de Exercícios Conceituais
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Resolução interativa com gabarito comentado e hiperlinks de revisão teórica (Cenário 3 BDD).
                </p>
              </div>

              <button
                className="toolbar-btn primary"
                onClick={() => setIsCreatingExercise(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <Plus size={14} />
                <span>Novo Exercício</span>
              </button>
            </div>

            {/* Modal / Form to create exercise */}
            {isCreatingExercise && (
              <form
                onSubmit={handleCreateExercise}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: 18,
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Cadastrar Novo Exercício</div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>
                    Enunciado da Questão:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Escreva a questão..."
                    value={newExQuestion}
                    onChange={(e) => setNewExQuestion(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.82rem',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Multiple choice options */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>
                    Alternativas de Resposta:
                  </label>
                  {newExOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <input
                        type="radio"
                        name="correct_answer_radio"
                        checked={newExCorrectIndex === idx}
                        onChange={() => setNewExCorrectIndex(idx)}
                        title="Marcar como gabarito correto"
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', minWidth: 18 }}>
                        {String.fromCharCode(65 + idx)})
                      </span>
                      <input
                        type="text"
                        placeholder={`Alternativa ${String.fromCharCode(65 + idx)}...`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...newExOptions];
                          updated[idx] = e.target.value;
                          setNewExOptions(updated);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          borderRadius: 4,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Theoretical links: Note and Reference */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                      Nota Conceitual de Embasamento:
                    </label>
                    <select
                      value={newExNoteId}
                      onChange={(e) => setNewExNoteId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.8rem',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="">Nenhuma (Opcional)</option>
                      {allNotes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                      Fonte / Referência Bibliográfica:
                    </label>
                    <select
                      value={newExRefId}
                      onChange={(e) => setNewExRefId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.8rem',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="">Nenhuma (Opcional)</option>
                      {references.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.file_type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 4 }}>
                    Gabarito Comentado e Justificativa Teórica:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Explicação detalhada da resposta..."
                    value={newExExplanation}
                    onChange={(e) => setNewExExplanation(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '0.82rem',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="toolbar-btn" onClick={() => setIsCreatingExercise(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="toolbar-btn primary">
                    Salvar Questão
                  </button>
                </div>
              </form>
            )}

            {/* List of Exercises */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {exercises.length === 0 && !loadingExercises && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  Nenhum exercício cadastrado. Clique no botão acima para adicionar questões conceituais.
                </div>
              )}

              {exercises.map((ex, idx) => {
                const userSelected = selectedAnswers[ex.id];
                const result = verifyResults[ex.id];

                return (
                  <div
                    key={ex.id}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary-yellow-border)' }}>
                          Q{idx + 1}.
                        </span>
                        <div style={{ fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.4 }}>
                          {ex.question}
                        </div>
                      </div>

                      <span className="badge" style={{ textTransform: 'capitalize', fontSize: '0.68rem' }}>
                        {ex.difficulty === 'easy' ? 'Fácil' : ex.difficulty === 'hard' ? 'Difícil' : 'Médio'}
                      </span>
                    </div>

                    {/* Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 24 }}>
                      {ex.options?.map((opt, optIdx) => {
                        const optKey = String(optIdx);
                        const isSelected = userSelected === optKey;

                        return (
                          <label
                            key={optIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 10px',
                              borderRadius: 6,
                              backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--primary-yellow-border)' : 'var(--border-color)',
                              cursor: 'pointer',
                              fontSize: '0.82rem'
                            }}
                          >
                            <input
                              type="radio"
                              name={`ex-${ex.id}`}
                              checked={isSelected}
                              onChange={() => setSelectedAnswers((prev) => ({ ...prev, [ex.id]: optKey }))}
                            />
                            <span style={{ fontWeight: 600 }}>{String.fromCharCode(65 + optIdx)})</span>
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Action: Verify Answer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                      <button
                        className="toolbar-btn primary"
                        onClick={() => handleVerifyExercise(ex.id)}
                        disabled={userSelected === undefined || verifyingExId === ex.id}
                        style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                      >
                        {verifyingExId === ex.id ? 'Verificando...' : 'Verificar Resposta'}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {ex.note_id && (
                          <button
                            className="toolbar-btn"
                            onClick={() => onSelectNote(ex.note_id!)}
                            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <FileText size={12} />
                            <span>Nota: {ex.note_title}</span>
                          </button>
                        )}
                        {ex.reference_id && (
                          <button
                            className="toolbar-btn"
                            onClick={() => onSelectReference(ex.reference_id!)}
                            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <BookOpen size={12} />
                            <span>Fonte: {ex.reference_title}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Verification Result Feedback Box (Cenário 3 BDD) */}
                    {result && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          backgroundColor: result.is_correct ? 'var(--accent-green-bg)' : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${result.is_correct ? 'var(--accent-green)' : '#ef4444'}`,
                          fontSize: '0.82rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                          {result.is_correct ? (
                            <>
                              <CheckCircle2 size={16} style={{ color: 'var(--accent-green)' }} />
                              <span style={{ color: 'var(--accent-green)' }}>Resposta Correta! Parabéns.</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={16} style={{ color: '#ef4444' }} />
                              <span style={{ color: '#ef4444' }}>
                                Resposta Incorreta. (Gabarito Oficial: Alternativa {String.fromCharCode(65 + parseInt(result.correct_answer, 10))})
                              </span>
                            </>
                          )}
                        </div>

                        <div style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          <strong>Comentário do Gabarito:</strong> {result.explanation}
                        </div>

                        {/* Revision Links (Cenário 3 BDD) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>Revisão Teórica Imediata:</span>
                          {result.note_id && (
                            <button
                              onClick={() => onSelectNote(result.note_id!)}
                              className="toolbar-btn primary"
                              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <FileText size={11} />
                              <span>Revisar Anotação: {result.note_title}</span>
                            </button>
                          )}
                          {result.reference_id && (
                            <button
                              onClick={() => onSelectReference(result.reference_id!)}
                              className="toolbar-btn"
                              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <BookOpen size={11} />
                              <span>Consultar Fonte: {result.reference_title}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: SIMULADOS & PROVAS COM DIAGNÓSTICO (RF-25)
            ========================================================================= */}
        {activeTab === 'simulations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 2px 0' }}>
                  Simulados Avaliativos & Provas
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Compilação de questões com cronômetro, pontuação e diagnóstico de temas para revisão.
                </p>
              </div>

              {!activeSim && (
                <button
                  className="toolbar-btn primary"
                  onClick={() => setIsCreatingSim(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Play size={14} />
                  <span>Iniciar Novo Simulado</span>
                </button>
              )}
            </div>

            {/* Modal / Form to start simulation */}
            {isCreatingSim && (
              <form
                onSubmit={handleStartSimulation}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: 18,
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Configurar Novo Simulado</div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                      Título da Prova:
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Simulado Geral de Redes Neurais..."
                      value={newSimTitle}
                      onChange={(e) => setNewSimTitle(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '0.82rem',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                      Tempo Limite (Minutos):
                    </label>
                    <input
                      type="number"
                      value={newSimDuration}
                      onChange={(e) => setNewSimDuration(e.target.value)}
                      min={5}
                      max={240}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        fontSize: '0.82rem',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                    Filtrar por Plano de Estudo (Opcional):
                  </label>
                  <select
                    value={newSimPlanId}
                    onChange={(e) => setNewSimPlanId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '0.82rem',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">Todos os Exercícios Disponíveis</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="toolbar-btn" onClick={() => setIsCreatingSim(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="toolbar-btn primary">
                    Começar Simulado
                  </button>
                </div>
              </form>
            )}

            {/* Active Simulation Runner Screen */}
            {activeSim && (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--primary-yellow-border)',
                  borderRadius: 10,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{activeSim.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Total de questões: {activeSim.questions.length}
                    </div>
                  </div>

                  {/* Timer display */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      color: simTimeRemaining < 120 ? '#ef4444' : 'var(--primary-yellow-border)'
                    }}
                  >
                    <Clock size={18} />
                    <span>
                      {Math.floor(simTimeRemaining / 60)
                        .toString()
                        .padStart(2, '0')}
                      :{(simTimeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {activeSim.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        padding: 12,
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {idx + 1}. {q.question}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {q.options?.map((opt: string, optIdx: number) => {
                          const optKey = String(optIdx);
                          const isChecked = activeSimAnswers[q.id] === optKey;

                          return (
                            <label
                              key={optIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 10px',
                                borderRadius: 4,
                                backgroundColor: isChecked ? 'var(--bg-hover)' : 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              <input
                                type="radio"
                                name={`sim-q-${q.id}`}
                                checked={isChecked}
                                onChange={() => setActiveSimAnswers((prev) => ({ ...prev, [q.id]: optKey }))}
                              />
                              <span>
                                {String.fromCharCode(65 + optIdx)}) {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
                  <button
                    className="toolbar-btn primary"
                    onClick={handleFinishSimulation}
                    style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                  >
                    Concluir e Entregar Simulado
                  </button>
                </div>
              </div>
            )}

            {/* Post-Simulation Performance Diagnosis */}
            {simFinishedResult && (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '1rem', fontWeight: 600 }}>
                      Resultado do Simulado: {simFinishedResult.title}
                    </h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Acertos: {simFinishedResult.correct_count} de {simFinishedResult.total_questions}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: simFinishedResult.score >= 70 ? 'var(--accent-green)' : '#ef4444'
                    }}
                  >
                    {simFinishedResult.score}%
                  </div>
                </div>

                {/* Recommendations */}
                {simFinishedResult.review_recommendations && simFinishedResult.review_recommendations.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#ef4444', marginBottom: 6 }}>
                      Diagnóstico: Tópicos que necessitam de revisão prioritária:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {simFinishedResult.review_recommendations.map((rec: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            backgroundColor: 'var(--bg-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span>
                            ● {rec.title} ({rec.incorrect} {rec.incorrect === 1 ? 'erro' : 'erros'})
                          </span>

                          <div style={{ display: 'flex', gap: 6 }}>
                            {rec.note_id && (
                              <button
                                className="toolbar-btn primary"
                                onClick={() => onSelectNote(rec.note_id)}
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              >
                                Revisar Nota
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Historical Simulations List */}
            {!activeSim && simulations.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>
                  Histórico de Simulados Realizados
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {simulations.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 6,
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.title}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {s.correct_count} de {s.total_questions} questões • {new Date(s.created_at || '').toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: (s.score || 0) >= 70 ? 'var(--accent-green)' : '#ef4444'
                        }}
                      >
                        {s.score || 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: FICHAMENTO & RESUMOS DE LIVROS (RF-26)
            ========================================================================= */}
        {activeTab === 'fichamento' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 2px 0' }}>
                Fichamentos Acadêmicos & Resumos de Livros
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Estruturas padronizadas de teses centrais, argumentos secundários, citações e impressões críticas (RF-26).
              </p>
            </div>

            {/* Quick Generator Box */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 14
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Gerar Nova Anotação com Template de Fichamento
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input
                  type="text"
                  id="fichamento-title-input"
                  placeholder="Título do Livro ou Artigo..."
                  defaultValue="Principles of Neurodynamics (Rosenblatt 1958)"
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                />
                <input
                  type="text"
                  id="fichamento-author-input"
                  placeholder="Autor(es)..."
                  defaultValue="Frank Rosenblatt"
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <button
                className="toolbar-btn primary"
                onClick={() => {
                  const titleEl = document.getElementById('fichamento-title-input') as HTMLInputElement;
                  const authorEl = document.getElementById('fichamento-author-input') as HTMLInputElement;
                  handleCreateFichamento(titleEl.value, authorEl.value);
                }}
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  fontSize: '0.82rem'
                }}
              >
                <FileText size={15} />
                <span>Criar Anotação Formatada de Fichamento</span>
              </button>
            </div>

            {/* Template Preview Explanation */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: 18,
                fontSize: '0.82rem',
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Estrutura Injetada no Editor:</div>
              <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong>Tese Central da Obra:</strong> Formulação sintética da contribuição fundamental.</li>
                <li><strong>Argumentos Secundários:</strong> Desdobramentos conceituais e empíricos.</li>
                <li><strong>Citações-Chave:</strong> Coordenadas exatas com deep-links para páginas de PDF ou parágrafos.</li>
                <li><strong>Conexões Conceituais:</strong> Wikilinks cruzados com outras anotações do repositório.</li>
                <li><strong>Impressões Críticas:</strong> Juízo de valor e aplicabilidade no projeto de pesquisa.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
