# Agentes do Projeto: Knowledge Dump

Este projeto conta com 3 agentes especializados configurados tanto como skills de automação (`.agents/skills/`) quanto como perfis de trabalho documentados:

---

## 1. Agente de Levantamento de Requisitos (`agent-requirements`)
- **Papel**: Engenharia de requisitos, análise de negócio e detalhamento funcional.
- **Skill**: [.agents/skills/agent-requirements/SKILL.md](../../.agents/skills/agent-requirements/SKILL.md)
- **Documento Ativo**: [docs/requisitos.md](../requisitos.md)
- **Responsabilidades**:
  - Elicitar e especificar requisitos funcionais (RF), não-funcionais (RNF) e regras de negócio (RN).
  - Manter o documento agnóstico de tecnologias e decisões prematuras de arquitetura.
  - Definir cenários de aceite em BDD (Given-When-Then) e modelagem conceitual do domínio.
  - Garantir a rastreabilidade entre necessidades do usuário e itens de escopo.

---

## 2. Agente de Testes (`agent-testing`)
- **Papel**: Garantia de qualidade (QA), estratégia de testes e mitigação de riscos.
- **Skill**: [.agents/skills/agent-testing/SKILL.md](../../.agents/skills/agent-testing/SKILL.md)
- **Responsabilidades**:
  - Transformar requisitos e critérios de aceite em planos de teste e matrizes de validação.
  - Mapear casos de borda: arquivos corrompidos/pesados (PDFs de 100MB+, DOCX legado, LaTeX com macros customizadas).
  - Validar integridade referencial: links circulares, notas renomeadas, âncoras órfãs.
  - Garantir conformidade com acessibilidade (WCAG AA), usabilidade de atalhos e ergonomia visual.

---

## 3. Agente de Desenvolvimento (`agent-development`)
- **Papel**: Engenharia de software, arquitetura técnica e implementação.
- **Skill**: [.agents/skills/agent-development/SKILL.md](../../.agents/skills/agent-development/SKILL.md)
- **Responsabilidades**:
  - Propor e validar a arquitetura e stack técnica após a homologação dos requisitos pelo usuário.
  - Implementar os módulos centrais (árvore de pastas, editor com wikilinks, visualizadores nativos, motor de busca e plano de estudos).
  - Seguir diretrizes de código limpo, Anti-Slop (sem código desnecessário e sem comentários genéricos de IA) e Ponytail (soluções enxutas, YAGNI, preferência por recursos nativos/stdlib).
