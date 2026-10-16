# Changelog 📋

Todas as alterações notáveis, implementações e correções deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/).

---

## [Não Lançado] - Em Andamento

### Planejado
- **Atividade 1.5 (Homologação de Aceite do MVP no Docker):** Bateria de testes E2E e validação dos Cenários BDD 1 e 2 no ambiente Docker.

## [1.2.0] - 2026-10-16

### Adicionado
- **Árvore de Pastas Hierárquica e Navegação em Subpastas (RF-04 / Atividade 1.4):**
  - Componente `FolderTree.tsx` com navegação recursiva em árvore hierárquica a partir de `parent_id`.
  - Suporte a subpastas em múltiplos níveis com expansão e colapso dinâmicos (`ChevronRight` e `ChevronDown`).
  - Criação rápida inline de pastas raiz e subpastas contextuais na barra lateral.
  - Contagem recursiva de notas agregadas por pasta e subpastas descendentes.
  - Endpoints REST `PUT /api/folders/:id` (renomeação/movimentação) e `DELETE /api/folders/:id`.
- **Visualizador Embutido de PDF com PDF.js (RF-14, RNF-03, RN-02 / Atividade 1.4):**
  - Componente de alto desempenho `PdfViewer.tsx` baseado na biblioteca nativa `pdfjs-dist` com renderização em Canvas de alta definição (DPR escalonável).
  - Barra de ferramentas completa com navegação direta de páginas (`<`, `>`, input numérico e contagem total), zoom ajustável (50% a 250% e 100%), rotação de 90° e busca textual no documento.
  - Camada de texto nativa (`TextLayer`) permitindo seleção de texto direta com cursor no PDF.
  - Tratamento de imutabilidade dos originais e carregamento de páginas sob demanda com proteção de memória para documentos pesados (100MB+).
- **Modo Split-View Duplo (Painel Dividido):**
  - Layout dividido lado a lado no `App.tsx` integrando o editor de anotações ou diretório com o leitor de PDF em tempo real.
  - Controles de alternância de Split-View no cabeçalho superior (`Header.tsx`) e na barra do editor (`NoteEditor.tsx`).
  - Responsividade automática: painel lado a lado no desktop e disposição empilhada em telas móveis e tablets.
- **Extração de Citações e Deep-Linking para Páginas de PDF (RF-19 / Cenário 2 BDD):**
  - Tooltip flutuante instantâneo ao selecionar qualquer trecho de texto no leitor de PDF com o botão *"Citar na Anotação"*.
  - Inserção automática de citação em bloco com aspas e metadados no corpo da nota ativa.
  - Geração de link de âncora com protocolo deep-link `pdf://<refId>?page=<X>`.
  - Ao clicar no link em qualquer momento posterior, o sistema abre o PDF em Split-View exatamente na página citada com destaque visual do trecho.
  - Seção dedicada de *Citações e Fontes Bibliográficas* no rodapé da anotação com botão de salto direto para a página e opção de remoção.
- **Upload e Acervo de Papers em PDF:**
  - Suporte a upload multipart via `@fastify/multipart` com limite de 150MB para livros didáticos e teses acadêmicas.
  - Endpoints dedicados: `GET /api/references`, `POST /api/references`, `GET /api/references/:id/file` (stream binário com headers de exibição inline).
  - Paper acadêmico de demonstração de 8 páginas persistido em `data/references/rosenblatt1958_perceptron.pdf`.
  - Suíte de testes automatizados `tests/atividade-1.4.test.ts` e script de execução de testes `scripts/test.js`.

## [1.1.1] - 2026-10-16

### Corrigido
- **Resolução de Erros de Proxy e Inicialização do Backend Local:**
  - Diagnóstico e correção do erro de recusa de conexão (`ECONNREFUSED 127.0.0.1:3001`) gerado pelo proxy do Vite quando o backend não conseguia iniciar no ambiente local.
  - Adicionado `.nvmrc` com versão Node 22 e atualização de `scripts/dev.js` para detectar automaticamente instalações do Node 22 no NVM e injetar as flags necessárias (`--experimental-sqlite`).
  - Tratamento resiliente em `server/db.ts` para tabelas virtuais FTS5 com fallback transparente para buscas `LIKE` caso o binário local do SQLite não possua a extensão compilada.
  - Ajuste no Vite proxy para direcionamento explícito em `127.0.0.1:3001` (prevenindo conflitos de resolução IPv6) e captura de erros de transporte sem poluição do terminal.

---

## [1.1.0] - 2026-10-16

### Adicionado
- **Editor Rico Tiptap WYSIWYG (Atividade 1.3):**
  - Implementação do editor baseado em Tiptap (`@tiptap/react`, `@tiptap/starter-kit`) com barra de ferramentas rica (cabeçalhos, negrito, itálico, listas, citações e blocos de código).
  - Suporte completo à renderização de fórmulas matemáticas em **LaTeX via KaTeX** tanto inline (`$...$`) quanto em bloco destacado (`$$...$$`).
  - Extensão customizada para **Wikilinks** (`[[Nome da Nota]]` ou `[[Nome da Nota#Âncora]]`) com renderização como links interativos.
  - Links órfãos destacados em vermelho com atalho de 1 clique para criação imediata da nova nota.
  - **Popover flutuante (Hover Preview):** Ao repousar o cursor sobre qualquer Wikilink, um popover elegante exibe o resumo e as categorias da nota linkada sem interromper o fluxo de leitura do usuário.
  - Suporte a âncoras internas e marcações contextuais com comentários associados.

---

## [1.0.0] - 2026-10-15

### Adicionado
- **Fundação do Core Web e PWA (Atividade 1.1):**
  - Workspace configurado com React 19, TypeScript, Vite 6 e plugin PWA (`vite-plugin-pwa`).
  - Configuração do Service Worker para suporte a cache offline e Web App Manifest permitindo instalação local no Mac e mobile.
- **Backend Fastify & Armazenamento Local-First:**
  - Servidor backend com Fastify 5 utilizando o módulo nativo `node:sqlite` do Node 22 (sem dependências externas compiladas).
  - Schema de dados inicial: tabelas relacionais para `users`, `categories`, `folders`, `notes`, `note_sources` e `backlinks`.
- **Motor de Busca Global Full-Text FTS5 (Atividade 2.2 Antecipada):**
  - Tabela virtual `notes_fts` indexada no SQLite com triggers automáticos de sincronização.
  - Modal de busca global com atalho de teclado `Cmd+K` / `Ctrl+K`, cálculo de ranking de relevância e destaques de trechos (`snippet()`).
- **Autenticação e Autoria de Notas (RF-36 / Atividade 1.1b):**
  - Modal de login e cadastro com hashing seguro SHA-256 e sessões persistentes no cliente (`x-user-id` e `localStorage`).
  - Associação de `user_id` em notas, pastas e categorias com isolamento de acervo pessoal.
- **Compartilhamento Público em Rede (RF-37 / Atividade 1.1c):**
  - Modal de compartilhamento (`ShareModal.tsx`) para gerar URLs públicas exclusivas (`/p/:id`).
  - Toggles para compartilhamento em cascata opcional de fontes citadas e notas conectadas via Wikilinks.
  - Visualizador de leitura pública limpo e independente (`PublicNoteView.tsx`).
- **Navegação em Grade e Lista na Main View (RF-04 / Atividade 1.1d):**
  - Componente `NotesDirectoryView.tsx` no painel central ao selecionar pastas ou categorias.
  - Alternância fluida entre visualização em Grade (cards informativos com tags, badges de fontes e backlinks) e Lista (tabela tabular com metadados de atualização).
- **Design System e Paleta com Acessibilidade (RNF-04 / Atividade 1.1e):**
  - Tokens CSS em `src/index.css` com temas Claro e Escuro baseados em escala pura de cinzas (sem tons azulados/roxos).
  - Paleta primária amarela balanceada com alto contraste WCAG AA para legibilidade e foco.
  - Cores funcionais para ações e estados: azul (`--color-accent-blue`), verde (`--color-accent-green`) e vermelho (`--color-accent-red`).
- **Containerização Multi-Plataforma (Atividade 1.2):**
  - `Dockerfile` multi-stage otimizado em `node:22-alpine` compilando frontend e backend.
  - `docker-compose.yml` pronto para deploy com um comando (`docker compose up -d`) e persistência mapeada no diretório `./data` do host.
- **Documentação de Engenharia:**
  - Especificação de Requisitos de Software ([docs/requisitos.md](docs/requisitos.md)) com 35 Requisitos Funcionais, 8 Não-Funcionais e cenários BDD.
  - Arquitetura tecnológica, timeline e backlog por agentes ([docs/arquitetura_e_roadmap.md](docs/arquitetura_e_roadmap.md)).
  - Perfis e governança de agentes ([docs/agentes/README.md](docs/agentes/README.md)).
