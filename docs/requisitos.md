# Especificação de Requisitos do Sistema: Knowledge Dump

**Documento:** Especificação de Requisitos de Software (SRS / PRD)  
**Versão:** 1.0.0  
**Status:** Aprovado para Validação Inicial  
**Abordagem:** Agnóstico a tecnologias e arquitetura de implementação (serão definidas na fase seguinte).

---

## 1. Visão Geral do Produto

O **Knowledge Dump** é um repositório pessoal de conhecimento (*Personal Knowledge Management & Research Engine*), concebido para ser um "Google Pessoal" para estudantes, pesquisadores e profissionais intelectuais.

O sistema combina a flexibilidade e simplicidade de ferramentas de anotação (estilo Obsidian e Notion) com o rigor de relacionamentos hipertextuais enciclopédicos (estilo Wikipédia) e o suporte intensivo a referências acadêmicas e profissionais (papers em PDF, teses em LaTeX, documentos DOCX, HTML, vídeos e imagens).

A partir do acúmulo de notas, referências e planejamentos de estudo, o usuário pode sintetizar esse conhecimento para produzir artigos científicos, ensaios temáticos, relatórios técnicos e trilhas completas de aprendizado.

---

## 2. Modelo Conceitual do Domínio

```mermaid
erDiagram
    PASTA ||--o{ PASTA : "contem subpastas"
    PASTA ||--o{ NOTA : "armazena"
    CATEGORIA ||--o{ NOTA : "classifica"
    TAG }o--o{ NOTA : "etiqueta"
    NOTA ||--o{ ANCORA : "possui"
    NOTA ||--o{ WIKILINK : "origina"
    WIKILINK }o--|| NOTA : "aponta para"
    WIKILINK }o--o| ANCORA : "ancora em"
    REFERENCIA ||--o{ CITACAO : "fornece trecho"
    NOTA ||--o{ CITACAO : "incorpora"
    PLANO_ESTUDO ||--o{ TEMA_ESTUDO : "organiza"
    TEMA_ESTUDO }o--o{ NOTA : "estuda"
    TEMA_ESTUDO ||--o{ EXERCICIO : "contem"
    TEMA_ESTUDO ||--o{ PROVA_SIMULADO : "avalia por"
    ARTIGO_CIENTIFICO ||--o{ NOTA : "sintetiza"
    ARTIGO_CIENTIFICO ||--o{ REFERENCIA : "cita"
```

### Entidades Principais
1. **Nota (Note)**: Unidade de anotação autoral do usuário, redigida com formatação rica/Markdown, fórmulas matemáticas e âncoras.
2. **Pasta / Subpasta**: Estrutura hierárquica para agrupamento de notas e referências em árvore.
3. **Categoria**: Classificação temática estrutural de alto nível (ex.: "Ciência da Computação", "Filosofia").
4. **Tag**: Marcador transversal flexível (ex.: `#algoritmos`, `#concurso2026`).
5. **Wikilink & Âncora**: Link bidirecional estilo Wikipédia que conecta termos e notas (`[[Título da Nota]]` ou `[[Título da Nota#Seção]]`).
6. **Referência / Arquivo Externo**: Documento importado que serve de base empírica ou bibliográfica (PDF, DOC/DOCX, LaTeX, HTML, vídeo, imagem).
7. **Citação Contextual (Deep-Link)**: Trecho extraído de uma referência que mantém vínculo direto com a página/seção exata do arquivo original.
8. **Plano de Estudos**: Estrutura de planejamento de aprendizagem com temas, metas, exercícios, provas e resumos de livros.
9. **Produção / Artigo Científico**: Documento compilado a partir de notas e referências selecionadas.

---

## 3. Requisitos Funcionais (RF)

### 3.1. Organização e Estrutura Hierárquica
- **RF-01 (Árvore de Pastas)**: O sistema deve permitir criar pastas e subpastas com profundidade arbitrária para acomodar notas e arquivos anexos.
- **RF-02 (Categorias)**: O sistema deve permitir definir categorias temáticas exclusivas ou complementares para agrupar notas e referências.
- **RF-03 (Tags Transversais)**: O sistema deve permitir associar múltiplas tags a qualquer nota ou arquivo de referência, com suporte a sugestão e autocompletar.
- **RF-04 (Múltiplas Vistas)**: O sistema deve permitir visualizar os itens por hierarquia de pastas, por categorias, por nuvem/lista de tags ou por linha do tempo de criação/modificação.

### 3.2. Editor de Anotações e Hiperlinks Estilo Wikipédia
- **RF-05 (Editor de Conteúdo Rico)**: O sistema deve fornecer editor de anotações com suporte a texto formatado, cabeçalhos hierárquicos, listas, tabelas, blocos de código com destaque de sintaxe e fórmulas matemáticas (estilo LaTeX / KaTeX).
- **RF-06 (Criação de Wikilinks)**: O usuário deve poder criar links rápidos entre notas digitando `[[Nome da Nota]]` ou selecionando trechos de texto e associando a uma nota existente ou nova.
- **RF-07 (Âncoras de Seção e Parágrafo)**: O usuário deve poder definir âncoras dentro do texto de uma nota para permitir que outras notas apontem para uma seção específica (`[[Nota#Âncora]]`).
- **RF-08 (Links Órfãos e Criação Sob Demanda)**: Se um Wikilink apontar para um termo ou nota que ainda não existe, o sistema deve estilizar o link com cor diferenciada (estilo "link vermelho da Wikipédia") e permitir criar a nova nota com 1 clique a partir desse link.
- **RF-09 (Backlinks e Relações Bidirecionais)**: Cada nota deve exibir automaticamente uma seção de "Notas que citam esta nota" (Backlinks) com trecho de contexto onde a menção ocorre.
- **RF-10 (Preview Flutuante ao Passar o Mouse)**: Ao repousar o cursor sobre qualquer Wikilink, o sistema deve exibir um pop-over (tooltip enriquecido) com resumo ou prévia da nota linkada sem exigir que o usuário saia da leitura atual.

### 3.3. Ingestão de Referências e Arquivos de Pesquisa
- **RF-11 (Suporte a Múltiplos Formatos)**: O sistema deve permitir importar e armazenar os seguintes formatos de arquivo de pesquisa:
  - Documentos de texto e diagramação: **PDF**, **DOC**, **DOCX**, **HTML**, **Markdown (.md)**, **LaTeX (.tex)**.
  - Mídias visuais e auditivas: Imagens (PNG, JPG, SVG, WebP), Vídeos (MP4, WebM), Áudios/Podcasts.
  - Links externos (URLs web) com extração de metadados (título, autor, descrição).
- **RF-12 (Metadados de Referência)**: O sistema deve permitir registrar metadados bibliográficos para referências importadas (Autores, Ano, Título, Periódico/Conferência, DOI, ISBN, URL).

### 3.4. Visualizadores Integrados (In-App Viewers)
- **RF-13 (Visualizador Nativo de PDF)**: O sistema deve incluir visualizador embutido de arquivos PDF com suporte a paginação, zoom, rotação, busca textual e seleção de texto.
- **RF-14 (Visualizador de Documentos Word)**: O sistema deve renderizar o conteúdo formatado de arquivos `.doc` e `.docx` diretamente na interface, sem dependência de softwares externos.
- **RF-15 (Visualizador de LaTeX)**: O sistema deve fornecer visualização de arquivos `.tex`, exibindo tanto o código-fonte quanto a prévia renderizada/formatada do documento.
- **RF-16 (Visualizador de HTML)**: O sistema deve renderizar páginas e artigos salvos em HTML em ambiente seguro (sandbox), preservando layout e imagens.
- **RF-17 (Visualizador de Imagens e Player de Mídia)**: O sistema deve exibir imagens com zoom/pan e reproduzir vídeos e áudios com controle de velocidade de reprodução (0.75x a 2x) e marcação de timestamp.

### 3.5. Sistema de Citações com Contexto Aprofundado (Deep-Linking)
- **RF-18 (Extração e Citação de Trechos)**: O usuário deve poder selecionar qualquer trecho de texto dentro de um visualizador (ex.: página 14 de um paper PDF) e clicar em "Citar na Anotação".
- **RF-19 (Deep-Link para Arquivo de Referência)**: Ao clicar em uma citação dentro de uma anotação, o sistema deve abrir o arquivo de referência correspondente diretamente na página, parágrafo ou timestamp exato de onde o trecho foi retirado.
- **RF-20 (Painel Duplo / Split View)**: O sistema deve permitir dividir a tela entre uma anotação em edição e o visualizador do arquivo de referência, facilitando fichamentos e análises simultâneas.

### 3.6. Módulo de Planejamento de Estudos e Aprendizagem
- **RF-21 (Criação de Planos e Cronogramas de Estudo)**: O usuário deve poder criar planos de estudo estruturados por disciplinas, fases ou objetivos (ex.: "Pós-graduação", "Concurso X").
- **RF-22 (Divisão por Temas e Roteiros)**: Cada plano de estudo deve permitir organizar tópicos sequenciais, associando notas obrigatórias, leituras recomendadas e metas temporais.
- **RF-23 (Banco de Exercícios)**: O sistema deve permitir cadastrar exercícios vinculados a temas e notas, com enunciado, opções (quando múltipla escolha), gabarito comentado e links para as notas teóricas que embasam a resposta.
- **RF-24 (Simulados e Provas)**: O usuário deve poder compilar exercícios em provas ou simulados com temporizador opcional, registro de acertos/erros e diagnóstico de temas que necessitam de revisão.
- **RF-25 (Fichamento e Resumos de Livros)**: O sistema deve fornecer templates específicos para resumos de livros e capítulos, com estrutura de teses centrais, argumentos secundários, citações-chave e impressões críticas do leitor.

### 3.7. Motor de Busca e Descoberta ("Google Pessoal")
- **RF-26 (Busca Global Full-Text)**: O sistema deve indexar e realizar buscas por palavras-chave tanto no corpo das anotações criadas quanto dentro do texto dos arquivos importados (PDFs pesquisáveis, DOCX, HTML, Markdown).
- **RF-27 (Filtros Avançados de Busca)**: A busca deve permitir operadores lógicos (AND, OR, NOT) e filtros por pasta, categoria, tags, tipo de arquivo e período de alteração.
- **RF-28 (Descoberta Semântica e Termos Relacionados)**: O sistema deve sugerir notas e referências que contenham temas correlatos à anotação que o usuário está lendo no momento.

### 3.8. Composição Científica e Síntese de Artigos
- **RF-29 (Modo de Redação de Artigos)**: O sistema deve prover um ambiente focado para redação de artigos e estudos temáticos, com painel lateral de consulta rápida ao acervo de notas e citações.
- **RF-30 (Compilação e Exportação)**: O sistema deve permitir compilar artigos e resumos nos formatos padrão de publicação (Markdown, PDF, LaTeX e DOCX), incluindo lista de referências bibliográficas citadas.

### 3.9. Grafo de Conhecimento
- **RF-31 (Visualização em Grafo)**: O sistema deve gerar um mapa visual interativo em forma de grafo de nós e arestas, onde nós representam notas/referências e arestas representam os links entre elas.
- **RF-32 (Filtros no Grafo)**: O usuário deve poder isolar agrupamentos de nós por categoria, tag ou densidade de conexões.

---

## 4. Requisitos Não-Funcionais (RNF)

- **RNF-01 (Desempenho de Busca)**: Resultados de busca em acervos de até 10.000 notas e referências devem retornar em menos de 500ms.
- **RNF-02 (Privacidade e Local-First)**: O sistema deve ser desenhado sob a premissa de *Local-First* / soberania dos dados do usuário: todos os arquivos, notas e índices devem ser armazenados localmente no dispositivo do usuário, funcionando 100% sem dependência obrigatória de servidores ou conexão à internet.
- **RNF-03 (Manipulação de Arquivos Volumosos)**: O carregamento e navegação de documentos PDF pesados (livros didáticos e teses de 100MB+) não devem travar a interface de usuário nem consumir memória excessiva.
- **RNF-04 (Acessibilidade)**: A interface deve seguir as diretrizes WCAG 2.1 nível AA, garantindo contraste adequado, navegação completa por teclado e suporte a temas claro e escuro de alto contraste.
- **RNF-05 (Integridade Referencial)**: Ao renomear ou mover uma nota ou pasta, todos os Wikilinks correspondentes existentes em outras notas devem ser atualizados automaticamente (*cascade update*), evitando links mortos.
- **RNF-06 (Portabilidade dos Dados)**: As notas devem ser salvas ou exportáveis em formatos abertos e universais (como Markdown com metadados em YAML frontmatter), sem travas proprietárias (*no vendor lock-in*).

---

## 5. Regras de Negócio (RN)

- **RN-01 (Identificação Canônica de Termos)**: Cada nota possui um título único dentro do repositório ou um identificador canônico para permitir resolução inequívoca de Wikilinks no formato `[[Título]]`.
- **RN-02 (Imutabilidade de Arquivos Originais)**: Documentos de referência (PDF, DOCX, LaTeX) importados devem ser tratados como somente-leitura pelo sistema de visualização, garantindo a integridade dos originais citados.
- **RN-03 (Links Órfãos Permissíveis)**: É permitido criar links para notas que ainda não foram escritas. O sistema deve rastrear e exibir uma lista de termos e conceitos pendentes de estudo.
- **RN-04 (Citações com Rastreabilidade Inquebrável)**: Uma citação incorporada a uma nota deve manter o identificador do arquivo fonte e a coordenada de localização (página/parágrafo/tempo). Se o arquivo for renomeado no sistema, o vínculo da citação deve ser preservado.
- **RN-05 (Isolamento de Execução de HTML)**: Scripts (JavaScript) embutidos em arquivos HTML importados devem ser desativados ou executados em sandbox estrito sem acesso aos arquivos locais do usuário.

---

## 6. Critérios de Aceite Globais (BDD)

### Cenário 1: Navegação estilo Wikipédia via Wikilinks
```gherkin
Dado que o usuário está redigindo uma anotação sobre "Redes Neurais"
Quando digitar o texto "conforme proposto pelo modelo [[Perceptron]]"
E a nota "Perceptron" já existir no repositório
Então o termo "Perceptron" deve ser renderizado como um hiperlink azul interativo
E ao passar o cursor sobre o link, uma janela de prévia do conteúdo de "Perceptron" deve aparecer
E ao clicar no link, o sistema deve navegar diretamente para a nota "Perceptron".
```

### Cenário 2: Citação direta de Paper PDF com Deep-Link
```gherkin
Dado que o usuário tem um paper em PDF aberto no visualizador integrado
Quando o usuário seleciona um parágrafo na página 7 e aciona "Citar na Anotação"
Então o trecho selecionado é inserido na anotação ativa com formatação de citação
E um link de âncora para a página 7 do respectivo PDF é gerado
E ao clicar nesse link em qualquer momento posterior, o visualizador abre o PDF exatamente na página 7 com o trecho destacado.
```

### Cenário 3: Resolução de Exercício com Vínculo Teórico
```gherkin
Dado que o usuário está resolvendo um exercício no módulo de estudos
Quando o usuário submete a resposta incorreta
Então o sistema exibe o gabarito comentado
E apresenta links para as anotações conceituais e referências bibliográficas onde a matéria foi abordada para revisão imediata.
```
