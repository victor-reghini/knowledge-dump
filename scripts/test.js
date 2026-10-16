import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
    env.PATH = `${selectedBinDir}:${env.PATH || ''}`;
  }

  const currentOptions = env.NODE_OPTIONS || '';
  if (!currentOptions.includes('--experimental-sqlite')) {
    env.NODE_OPTIONS = `${currentOptions} --experimental-sqlite`.trim();
  }

  return env;
}

const childEnv = resolveNode22Env();
childEnv.NODE_ENV = 'test';

const testProcess = spawn('npx', ['tsx', '--test', '--test-concurrency=1', 'tests/**/*.test.ts'], {
  stdio: 'inherit',
  shell: true,
  env: childEnv
});

testProcess.on('exit', (code) => {
  process.exit(code || 0);
});
