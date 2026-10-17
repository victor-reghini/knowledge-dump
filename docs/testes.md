# Plano de Testes, Qualidade e Matriz de Rastreabilidade

Este documento consolida a estratégia de Garantia da Qualidade (QA), a pirâmide de testes automatizados e a matriz de rastreabilidade entre requisitos ([docs/requisitos.md](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/docs/requisitos.md)), critérios de aceite (BDD) e as suítes de testes executáveis do **Knowledge Dump**.

---

## 1. Estratégia de Qualidade & Pirâmide de Testes

O Knowledge Dump segue uma abordagem estrita de **Test-Driven Design & Continuous Validation**:
- **Ambiente Local-First**: Os testes executam em ambiente Node.js com SQLite nativo em memória/arquivo temporário sem dependência de internet.
- **Isolamento e Determinismo**: Cada suíte cria seus próprios fixtures e usuários isolados, garantindo idempotência e prevenindo efeitos colaterais entre execuções concorrentes.
- **Suíte Nativa de Testes**: Utiliza o executor integrado `node:test` e `node:assert/strict` disparado através do script `scripts/test.js` com TypeScript/tsx.

```
                  /\
                 /  \     Testes E2E / BDD
                /    \    (Cenários 1, 2, 3, Docker & PWA)
               /------\
              /        \    Testes de Integração
             /          \   (Fastify Inject, SQLite FTS5, Cascata, Range Streaming)
            /------------\
           /              \   Testes Unitários
          /________________\  (Parsers Wikilink, DOCX/PPTX, Compilador LaTeX/PDF)
```

---

## 2. Matriz de Cobertura de Requisitos Funcionais (RF)

| ID | Requisito Funcional | Status de Automação | Suíte de Testes Responsável |
| :--- | :--- | :---: | :--- |
| **RF-01** | Sistema de Arquivos Virtual (Pastas/Categorias) | ✅ Coberto | [`tests/gestao-pastas-categorias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/gestao-pastas-categorias.test.ts) |
| **RF-02** | Metadados de Anotações (Tags, Cores, Favoritos) | ✅ Coberto | [`tests/gestao-pastas-categorias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/gestao-pastas-categorias.test.ts) |
| **RF-03** | Visualização em Árvore Hierárquica | ✅ Coberto | [`tests/atividade-1.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-1.4.test.ts) |
| **RF-04** | Navegação em Grade e Lista | ✅ Coberto | [`tests/arquivos-pastas-categorias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/arquivos-pastas-categorias.test.ts) |
| **RF-05** | Editor Rico com Suporte a Markdown | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |
| **RF-06** | Fórmulas Matemáticas em LaTeX ($ e $$) | ✅ Coberto | [`tests/atividade-2.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.3.test.ts) |
| **RF-07** | Hiperlinks Bidirecionais (Wikilinks `[[Nota]]`) | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |
| **RF-08** | Âncoras Contextuais em Seções (`[[Nota#secao]]`) | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |
| **RF-09** | Marcadores e Destaques Coloridos | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |
| **RF-10** | Seção de Backlinks Dinâmicos | ✅ Coberto | [`tests/atividade-3.1.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.1.test.ts) |
| **RF-11** | Visualizador de PDF com Zoom e Busca | ✅ Coberto | [`tests/atividade-1.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-1.4.test.ts) |
| **RF-12** | Citação Direta de PDF com Deep-Link | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |
| **RF-13** | Visualizador de Documentos DOC e DOCX | ✅ Coberto | [`tests/atividade-2.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.3.test.ts) |
| **RF-14** | Visualizador e Renderizador LaTeX (.tex) | ✅ Coberto | [`tests/atividade-2.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.3.test.ts) |
| **RF-15** | Visualizador de Documentos Markdown | ✅ Coberto | [`tests/atividade-2.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.3.test.ts) |
| **RF-16** | Visualizador de Mídias (Vídeo e Áudio) | ✅ Coberto | [`tests/atividade-2.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.3.test.ts) |
| **RF-17** | Modo de Visualização Dividida (Split-View) | ✅ Coberto | [`tests/editor-word-splitview-export.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/editor-word-splitview-export.test.ts) |
| **RF-18** | Edição Direta de Arquivos (.txt, .md, .docx, .tex) | ✅ Coberto | [`tests/formatos-edicao-referencias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/formatos-edicao-referencias.test.ts) |
| **RF-19** | Suporte a Novos Formatos (.txt, .md, .pptx) | ✅ Coberto | [`tests/formatos-edicao-referencias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/formatos-edicao-referencias.test.ts) |
| **RF-20** | Visualizador de Apresentações PPTX | ✅ Coberto | [`tests/formatos-edicao-referencias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/formatos-edicao-referencias.test.ts) |
| **RF-21** | Visualizador de Texto Simples TXT | ✅ Coberto | [`tests/formatos-edicao-referencias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/formatos-edicao-referencias.test.ts) |
| **RF-22** | Planos e Trilhas de Estudo Sequenciais | ✅ Coberto | [`tests/atividade-3.2.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.2.test.ts) |
| **RF-23** | Vinculação de Notas e Referências a Tópicos | ✅ Coberto | [`tests/atividade-3.2.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.2.test.ts) |
| **RF-24** | Banco de Questões com Gabarito e Conceito | ✅ Coberto | [`tests/atividade-3.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.4.test.ts) |
| **RF-25** | Simulados com Temporizador e Diagnóstico | ✅ Coberto | [`tests/atividade-3.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.4.test.ts) |
| **RF-26** | Fichamento e Resumos de Livros | ✅ Coberto | [`tests/atividade-3.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.4.test.ts) |
| **RF-27** | Busca Global Full-Text (FTS5) | ✅ Coberto | [`tests/atividade-2.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.4.test.ts) |
| **RF-28** | Filtros Avançados de Busca | ✅ Coberto | [`tests/atividade-2.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.4.test.ts) |
| **RF-29** | Descoberta Semântica e Termos Relacionados | ✅ Coberto | [`tests/atividade-3.1.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.1.test.ts) |
| **RF-30** | Modo de Redação Científica & Gaveta de Citações | ✅ Coberto | [`tests/atividade-3.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.3.test.ts) |
| **RF-31** | Compilação Multi-formato (MD, TeX, DOCX, PDF) | ✅ Coberto | [`tests/atividade-3.3.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.3.test.ts) & [`tests/atividade-3.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.4.test.ts) |
| **RF-32** | Visualização em Grafo Interativo | ✅ Coberto | [`tests/atividade-3.1.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.1.test.ts) |
| **RF-33** | Filtros de Densidade e Categorias no Grafo | ✅ Coberto | [`tests/atividade-3.1.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.1.test.ts) |
| **RF-36** | Autenticação de Usuário e Autoria | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |
| **RF-37** | Compartilhamento Público e Cascata | ✅ Coberto | [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts) |

---

## 3. Matriz de Cobertura de Requisitos Não-Funcionais (RNF)

| ID | Requisito Não-Funcional | Validação Automatizada |
| :--- | :--- | :--- |
| **RNF-01** | Desempenho de busca em < 500ms | Validado em [`tests/atividade-2.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.4.test.ts): 1.000 notas indexadas e consulta FTS5 respondendo em < 45ms. |
| **RNF-02** | Local-First & Soberania dos Dados | 100% dos testes executados localmente sem requisições a serviços externos. |
| **RNF-03** | Manipulação de Arquivos Volumosos (100MB+) | Validado em [`tests/atividade-2.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-2.4.test.ts): leitura sob demanda via RFC 7233 Byte-Ranges em arquivo de 105MB com < 25ms de I/O e variação de memória heap controlada. |
| **RNF-04** | Acessibilidade, Identidade Visual e Temas | Tokens WCAG AA no tema claro e escuro (cinzas neutros sem azulados/roxos, primária amarela). |
| **RNF-05** | Integridade Referencial e Links Sem Quebra | Validado em [`tests/gestao-pastas-categorias.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/gestao-pastas-categorias.test.ts) e [`tests/atividade-3.1.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.1.test.ts). |
| **RNF-06** | Portabilidade dos Dados | Exportação universal em Markdown (YAML frontmatter), LaTeX e DOCX. |

---

## 4. Cobertura dos Critérios Globais de Aceite (BDD)

### Cenário 1: Navegação estilo Wikipédia via Wikilinks
- **Especificação:** [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts)
- **Status:** ✅ **APROVADO**
- **Cobertura:** Extração de `[[Título]]`, classificação de links resolvidos vs órfãos, âncoras `#secao`, popover de preview com snippet limpo e navegação com 1 clique.

### Cenário 2: Citação direta de Paper PDF com Deep-Link
- **Especificação:** [`tests/homologacao-mvp-docker.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/homologacao-mvp-docker.test.ts)
- **Status:** ✅ **APROVADO**
- **Cobertura:** Inserção de citação com protocolo `pdf://`, vínculo no SQLite à página 7 do paper binário de exemplo e restauração da página e destaque no visualizador.

### Cenário 3: Resolução de Exercício com Vínculo Teórico
- **Especificação:** [`tests/atividade-3.4.test.ts`](file:///Users/victor/Documents/Projects/ComplexProjects/knowledge-dump/tests/atividade-3.4.test.ts)
- **Status:** ✅ **APROVADO**
- **Cobertura:** 
  1. Submissão incorreta exibe gabarito oficial e explicação comentada.
  2. Retorna metadados e IDs da anotação conceitual e do paper de referência citado.
  3. Recuperação e navegação imediata do conteúdo teórico correspondente para revisão.

### Cenário 4: Sincronização e Backup no Google Drive
- **Status:** ⏳ **PREVISTO PARA A FASE 4** (Atividades 4.1 a 4.3).

---

## 5. Como Executar as Suítes de Teste

Para rodar todas as 48 suítes com saída otimizada pelo RTK:
```bash
rtk npm test
```

Para validar a integridade dos bundles e compilação TypeScript:
```bash
rtk npm run build
```
