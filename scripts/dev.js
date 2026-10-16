import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import './generate_sample_fixtures.js';

function ensurePortsFree(...ports) {
  for (const port of ports) {
    try {
      if (process.platform === 'win32') {
        const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        const lines = out.trim().split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            console.log(`[Dev] Liberando porta ${port} ocupada pelo PID ${pid}...`);
            execSync(`taskkill /F /PID ${pid}`);
          }
        }
      } else {
        const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          if (pid && pid !== String(process.pid)) {
            console.log(`[Dev] Liberando porta ${port} ocupada pelo PID ${pid}...`);
            try { process.kill(Number(pid), 'SIGKILL'); } catch {}
          }
        }
      }
    } catch {}
  }
}

// Libera portas 3000 e 3001 caso haja processos zumbis anteriores
ensurePortsFree(3000, 3001);

function resolveNode22Env() {
  const env = { ...process.env };
  const [major, minor] = process.versions.node.split('.').map(Number);

  if (major > 22 || (major === 22 && minor >= 12)) {
    return env;
  }

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

  const currentOptions = env.NODE_OPTIONS || '';
  if (!currentOptions.includes('--experimental-sqlite')) {
    env.NODE_OPTIONS = `${currentOptions} --experimental-sqlite`.trim();
  }

  return env;
}

const childEnv = resolveNode22Env();
const isWindows = process.platform === 'win32';

const server = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
  stdio: 'inherit',
  shell: true,
  detached: !isWindows,
  env: childEnv
});

const vite = spawn('npx', ['vite', '--port', '3000'], {
  stdio: 'inherit',
  shell: true,
  detached: !isWindows,
  env: childEnv
});

function killProcess(child) {
  if (!child || !child.pid) return;
  try {
    if (isWindows) {
      execSync(`taskkill /pid ${child.pid} /T /F 2>nul`);
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    try { child.kill('SIGKILL'); } catch {}
  }
}

const cleanup = () => {
  killProcess(server);
  killProcess(vite);
  ensurePortsFree(3000, 3001);
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
