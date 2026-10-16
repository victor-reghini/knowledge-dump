import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function resolveNode22Env() {
  const env = { ...process.env };
  const [major, minor] = process.versions.node.split('.').map(Number);

  // Se já estiver rodando Node >= 22.5, apenas garante a flag experimental se necessária
  if (major > 22 || (major === 22 && minor >= 12)) {
    return env;
  }

  // Verifica se o NVM possui uma versão 22 instalada na máquina
  const nvmVersionsDir = path.join(os.homedir(), '.nvm', 'versions', 'node');
  let selectedBinDir = null;

  if (fs.existsSync(nvmVersionsDir)) {
    const v22Dirs = fs.readdirSync(nvmVersionsDir)
      .filter(dir => dir.startsWith('v22.'))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    if (v22Dirs.length > 0) {
      selectedBinDir = path.join(nvmVersionsDir, v22Dirs[0], 'bin');
    }
  }

  if (selectedBinDir && fs.existsSync(selectedBinDir)) {
    console.log(`[Dev] Ambiente: Usando Node 22 de ${selectedBinDir} (compatibilidade com node:sqlite).`);
    env.PATH = `${selectedBinDir}:${env.PATH || ''}`;
  } else if (major < 22) {
    console.warn(`[Dev] ATENÇÃO: Node v${process.versions.node} em execução. Recomenda-se Node >= 22 para uso de node:sqlite nativo.`);
  }

  // Garante a flag experimental para versões 22 que ainda exigem a flag (ex.: 22.5 a 22.11)
  const currentOptions = env.NODE_OPTIONS || '';
  if (!currentOptions.includes('--experimental-sqlite')) {
    env.NODE_OPTIONS = `${currentOptions} --experimental-sqlite`.trim();
  }

  return env;
}

const childEnv = resolveNode22Env();

const server = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
  stdio: 'inherit',
  shell: true,
  env: childEnv
});

const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true,
  env: childEnv
});

const cleanup = () => {
  server.kill();
  vite.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
