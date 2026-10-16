import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { db, initDatabase, DATA_DIR, REFS_DIR } from '../server/db.js';

describe('Atividade 2.1: Validação de Performance e Permissões de Volume no Mac', () => {

  // =========================================================================
  // CENÁRIO 1: Script start-mac.sh (Permissões, Sintaxe e Robustez)
  // =========================================================================
  describe('Cenário 1: Script de Inicialização Rápida no macOS (start-mac.sh)', () => {
    const scriptPath = path.resolve(process.cwd(), 'start-mac.sh');

    test('start-mac.sh deve existir na raiz do repositório e ter permissão de execução', () => {
      assert.ok(fs.existsSync(scriptPath), 'start-mac.sh deve existir na raiz');
      const stats = fs.statSync(scriptPath);
      // Verifica bit executável (usuário ou grupo)
      const isExecutable = (stats.mode & 0o111) !== 0;
      assert.ok(isExecutable, 'start-mac.sh deve possuir permissão executável (+x)');
    });

    test('start-mac.sh deve possuir sintaxe Bash válida (validação bash -n)', () => {
      const check = spawnSync('bash', ['-n', scriptPath]);
      assert.equal(check.status, 0, `start-mac.sh possui erro de sintaxe Bash: ${check.stderr.toString()}`);
    });

    test('start-mac.sh deve conter verificações de Docker, permissões de volume e healthcheck', () => {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      assert.ok(content.includes('docker info'), 'Deve verificar se o daemon do Docker está rodando');
      assert.ok(content.includes('chmod -R'), 'Deve ajustar permissões do volume local ./data');
      assert.ok(content.includes('docker compose up -d --build'), 'Deve acionar o docker compose');
      assert.ok(content.includes('/api/health'), 'Deve aguardar o endpoint de healthcheck');
      assert.ok(content.includes('Darwin'), 'Deve incluir detecção de macOS');
    });
  });

  // =========================================================================
  // CENÁRIO 2: Otimização do SQLite para Volumes de Disco e Concorrência
  // =========================================================================
  describe('Cenário 2: Otimizações de Performance e Concorrência no SQLite (VirtioFS / Docker)', () => {
    test('initDatabase deve configurar pragmas WAL, synchronous NORMAL e busy_timeout', () => {
      initDatabase();

      // Verifica journal_mode WAL
      const journalMode = (db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode;
      assert.equal(journalMode.toLowerCase(), 'wal', 'SQLite deve operar em modo Write-Ahead Logging (WAL)');

      // Verifica synchronous NORMAL (1)
      const sync = (db.prepare('PRAGMA synchronous').get() as { synchronous: number | string }).synchronous;
      assert.ok(sync === 1 || String(sync).toUpperCase() === 'NORMAL', 'Synchronous deve ser NORMAL (1) para balancear integridade e IOPS');

      // Verifica busy_timeout >= 5000ms
      const busy = (db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout;
      assert.ok(busy >= 5000, `Busy timeout deve ser >= 5000ms para evitar bloqueios no host (atual: ${busy})`);

      // Verifica temp_store MEMORY (2)
      const tempStore = (db.prepare('PRAGMA temp_store').get() as { temp_store: number }).temp_store;
      assert.ok(tempStore === 2, 'temp_store deve estar em MEMORY para tabelas temporárias rápidas');
    });

    test('Volume de dados deve suportar rajada de leituras e escritas sem travamento', () => {
      const start = Date.now();
      const TOTAL_OPS = 50;

      for (let i = 0; i < TOTAL_OPS; i++) {
        const id = `perf-test-${i}-${Date.now()}`;
        db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, `tag-bench-${i}-${Date.now()}`);
      }

      const duration = Date.now() - start;
      assert.ok(duration < 2000, `Rajada de 50 escritas em WAL deve demorar menos de 2s (levou ${duration}ms)`);

      // Limpa tags de benchmark
      db.prepare("DELETE FROM tags WHERE name LIKE 'tag-bench-%'").run();
    });

    test('Diretório de referências PDF deve estar criado e acessível para escrita', () => {
      assert.ok(fs.existsSync(REFS_DIR), `Diretório ${REFS_DIR} deve existir`);
      const testFile = path.join(REFS_DIR, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      assert.ok(fs.existsSync(testFile), 'Arquivo de teste deve ser gravado com sucesso');
      fs.unlinkSync(testFile);
    });
  });

});
