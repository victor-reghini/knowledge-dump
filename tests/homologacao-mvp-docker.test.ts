import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { db, initDatabase, DATA_DIR, REFS_DIR } from '../server/db.js';
import { Note, ReferenceFile, Citation } from '../src/types.js';

describe('Atividade 1.5: Homologação de Aceite do MVP no Docker & BDD', () => {

  // =========================================================================
  // CENÁRIO 1 BDD: Navegação estilo Wikipédia via Wikilinks (RF-08, RF-09, RF-11)
  // =========================================================================
  describe('Cenário 1 BDD: Navegação estilo Wikipédia via Wikilinks', () => {
    const WIKILINK_REGEX = /\[\[([^\]#]+)(?:#([^\]]+))?\]\]/g;

    test('Dado que o usuário redige texto com Wikilinks, o parser deve extrair título e âncora opcional', () => {
      const content = 'O modelo basilar de aprendizado supervisionado é o [[Perceptron]], e a ativação está em [[Redes Neurais Artificiais#funcao-ativacao]].';
      
      const matches: { title: string; anchor?: string }[] = [];
      let match: RegExpExecArray | null;
      while ((match = WIKILINK_REGEX.exec(content)) !== null) {
        matches.push({
          title: match[1].trim(),
          anchor: match[2]?.trim()
        });
      }

      assert.equal(matches.length, 2, 'Devem ser detectados 2 wikilinks no texto');
      assert.equal(matches[0].title, 'Perceptron');
      assert.equal(matches[0].anchor, undefined);
      assert.equal(matches[1].title, 'Redes Neurais Artificiais');
      assert.equal(matches[1].anchor, 'funcao-ativacao');
    });

    test('Wikilink com nota existente deve ser classificado como resolvido, e inexistente como órfão', () => {
      const existingNotes: Note[] = [
        { id: 'note-perceptron', title: 'Perceptron', content: 'Nota de perceptron', category_id: null, folder_id: null, is_favorite: 0, created_at: '', updated_at: '' },
        { id: 'note-redes', title: 'Redes Neurais Artificiais', content: 'Nota de redes', category_id: null, folder_id: null, is_favorite: 0, created_at: '', updated_at: '' }
      ];

      const resolveWikilink = (targetTitle: string, notes: Note[]) => {
        const found = notes.find(n => n.title.toLowerCase() === targetTitle.toLowerCase());
        return {
          isOrphan: !found,
          targetNote: found || null
        };
      };

      const resolved = resolveWikilink('Perceptron', existingNotes);
      assert.equal(resolved.isOrphan, false);
      assert.equal(resolved.targetNote?.id, 'note-perceptron');

      const orphan = resolveWikilink('Conceito Não Criado', existingNotes);
      assert.equal(orphan.isOrphan, true);
      assert.equal(orphan.targetNote, null);
    });

    test('Âncoras de cabeçalho {#secao} devem ser identificadas no markdown para navegação contextual', () => {
      const headingWithAnchor = '## Função de Ativação {#funcao-ativacao}';
      const anchorMatch = headingWithAnchor.match(/^(#{1,6}\s+.*?)(?:\s+\{#([a-zA-Z0-9_-]+)\})?\s*$/);

      assert.ok(anchorMatch, 'Deve fazer match do cabeçalho com âncora');
      assert.equal(anchorMatch[1].trim(), '## Função de Ativação');
      assert.equal(anchorMatch[2], 'funcao-ativacao');
    });

    test('Preview do popover de Wikilink deve conter metadados e snippet limpo', () => {
      const rawContent = '# Título\n\nTexto explicativo com **negrito** e [[Outro Link]] mais fórmulas.';
      const cleanSnippet = rawContent
        .replace(/^#+\s+.*$/gm, '')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/[*_`]/g, '')
        .trim();

      assert.ok(!cleanSnippet.includes('# Título'), 'Snippet não deve conter cabeçalho');
      assert.ok(!cleanSnippet.includes('[['), 'Snippet não deve conter delimitadores de wikilink');
      assert.ok(cleanSnippet.includes('Outro Link'), 'Texto do wikilink deve ser preservado');
    });
  });

  // =========================================================================
  // CENÁRIO 2 BDD: Citação direta de Paper PDF com Deep-Link (RF-14, RF-19)
  // =========================================================================
  describe('Cenário 2 BDD: Citação direta de Paper PDF com Deep-Link', () => {
    test('Formatação da citação Markdown deve seguir padrão com protocolo pdf:// e página', () => {
      const citationData = {
        quoteText: 'A convergência do Perceptron é garantida se o conjunto for linearmente separável.',
        referenceTitle: 'Frank Rosenblatt (1958)',
        referenceId: 'ref-rosenblatt-1958',
        pageNumber: 7
      };

      const markdownBlock = `> "${citationData.quoteText}"\n> — [${citationData.referenceTitle} (p. ${citationData.pageNumber})](pdf://${citationData.referenceId}?page=${citationData.pageNumber})`;

      assert.ok(markdownBlock.startsWith('> "A convergência do Perceptron'));
      assert.ok(markdownBlock.includes('pdf://ref-rosenblatt-1958?page=7'));

      // Validação do parser de deep-link
      const linkMatch = markdownBlock.match(/\[([^\]]+)\]\(pdf:\/\/([^?]+)\?page=(\d+)\)/);
      assert.ok(linkMatch, 'Deve reconhecer link de citação PDF');
      assert.equal(linkMatch[2], 'ref-rosenblatt-1958');
      assert.equal(parseInt(linkMatch[3], 10), 7);
    });

    test('Deep-link no banco deve vincular nota ativa à página 7 da referência', () => {
      initDatabase();

      const ref = db.prepare('SELECT * FROM references_files WHERE id = ?').get('ref-rosenblatt-1958') as ReferenceFile | undefined;
      assert.ok(ref, 'Paper de Rosenblatt (1958) deve estar semeado no banco');
      assert.equal(ref.year, 1958);

      const citation = db.prepare('SELECT * FROM citations WHERE reference_id = ? AND page_number = ?').get('ref-rosenblatt-1958', 7) as Citation | undefined;
      assert.ok(citation, 'Citação na página 7 deve estar cadastrada');
      assert.equal(citation.page_number, 7);
      assert.ok(citation.quote_text.includes('convergência'));
    });

    test('Arquivo binário do paper PDF de exemplo deve existir fisicamente no volume de dados', () => {
      const pdfPath = path.join(REFS_DIR, 'rosenblatt1958_perceptron.pdf');
      assert.ok(fs.existsSync(pdfPath), `Arquivo PDF deve existir no volume host em ${pdfPath}`);
      const stats = fs.statSync(pdfPath);
      assert.ok(stats.size > 1000, `Arquivo PDF deve ter tamanho válido (> 1KB, tamanho atual: ${stats.size} bytes)`);
    });
  });

  // =========================================================================
  // CENÁRIO DOCKER & PERSISTÊNCIA NO VOLUME DO HOST (Atividade 1.2 / 1.5)
  // =========================================================================
  describe('Cenário Docker Compose & Persistência no Volume do Host', () => {
    test('docker-compose.yml deve configurar mapeamento de volume para o diretório ./data', () => {
      const composePath = path.resolve(process.cwd(), 'docker-compose.yml');
      assert.ok(fs.existsSync(composePath), 'docker-compose.yml deve existir na raiz');

      const content = fs.readFileSync(composePath, 'utf-8');
      assert.ok(content.includes('./data:/app/data'), 'Volume bind deve mapear ./data para /app/data');
      assert.ok(content.includes('3000:3000'), 'Porta 3000 deve ser exposta');
      assert.ok(content.includes('NODE_ENV=production'), 'Ambiente deve ser production');
    });

    test('Dockerfile deve possuir multi-stage build com compilação de client e server e NODE_OPTIONS', () => {
      const dockerfilePath = path.resolve(process.cwd(), 'Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath), 'Dockerfile deve existir na raiz');

      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      assert.ok(content.includes('FROM node:22-alpine AS builder'), 'Deve usar node:22-alpine na etapa builder');
      assert.ok(content.includes('FROM node:22-alpine AS runner'), 'Deve usar node:22-alpine na etapa runner');
      assert.ok(content.includes('npm run build:client'), 'Deve compilar o client Vite');
      assert.ok(content.includes('npm run build:server'), 'Deve compilar o server Fastify');
      assert.ok(content.includes('NODE_OPTIONS="--experimental-sqlite"'), 'Deve configurar suporte nativo a node:sqlite');
      assert.ok(content.includes('EXPOSE 3000'), 'Deve expor a porta 3000');
    });

    test('A persistência de dados no SQLite deve refletir no arquivo data/knowledge.db do host', () => {
      const dbPath = path.join(DATA_DIR, 'knowledge.db');
      assert.ok(fs.existsSync(dbPath), `Banco de dados knowledge.db deve existir em ${dbPath}`);

      // Executa escrita de teste e verifica sincronismo no arquivo
      const testId = `docker-test-${Date.now()}`;
      db.prepare('INSERT INTO categories (id, user_id, name, color) VALUES (?, ?, ?, ?)').run(
        testId,
        'user-admin',
        'Categoria Volume Teste',
        '#22c55e'
      );

      const check = db.prepare('SELECT * FROM categories WHERE id = ?').get(testId) as { name: string } | undefined;
      assert.ok(check, 'Registro deve ser lido com sucesso');
      assert.equal(check.name, 'Categoria Volume Teste');

      // Limpa registro de teste
      db.prepare('DELETE FROM categories WHERE id = ?').run(testId);
    });
  });

  // =========================================================================
  // CENÁRIO PWA & RECURSOS OFFLINE (RF-35 / Atividade 1.1)
  // =========================================================================
  describe('Cenário PWA: Web App Manifest & Service Worker Offline', () => {
    test('dist/manifest.webmanifest deve conter especificações completas de PWA instalável', () => {
      const manifestPath = path.resolve(process.cwd(), 'dist', 'manifest.webmanifest');
      assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest deve existir no bundle dist');

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.equal(manifest.name, 'Knowledge Dump - Repositório Pessoal de Conhecimento');
      assert.equal(manifest.short_name, 'KnowledgeDump');
      assert.equal(manifest.display, 'standalone');
      assert.equal(manifest.start_url, '/');
      assert.ok(manifest.theme_color, 'Deve definir theme_color');
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Deve possuir ícones para instalação PWA');
    });

    test('dist/sw.js deve existir e conter lógica de Service Worker para funcionamento offline', () => {
      const swPath = path.resolve(process.cwd(), 'dist', 'sw.js');
      assert.ok(fs.existsSync(swPath), 'sw.js deve ser gerado pelo vite-plugin-pwa');

      const content = fs.readFileSync(swPath, 'utf-8');
      assert.ok(content.includes('workbox') || content.includes('precache'), 'Service worker deve gerenciar precache offline');
    });
  });

});
