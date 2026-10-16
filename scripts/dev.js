import { spawn } from 'node:child_process';

const server = spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
  stdio: 'inherit',
  shell: true
});

const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  server.kill();
  vite.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
