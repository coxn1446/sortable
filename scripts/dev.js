const net = require('net');
const { spawn } = require('child_process');

require('dotenv').config({ quiet: true });

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = new Set();

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function run(label, args) {
  const child = spawn(npmCmd, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  children.add(child);
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[dev] ${label} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

async function waitForPort(port, { timeoutMs = 30000, intervalMs = 250 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
  process.exit(code);
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));

(async () => {
  const apiRunning = await isPortOpen(8080);
  if (apiRunning) {
    console.log('[dev] API server already listening on port 8080; reusing it.');
  } else {
    console.log('[dev] Starting API server on port 8080.');
    run('server:dev', ['run', 'server:dev']);
    const ready = await waitForPort(8080);
    if (!ready) {
      console.error('[dev] API server did not start within 30 seconds.');
      shutdown(1);
    }
  }

  console.log('[dev] Starting Vite on port 3000.');
  run('start:dev', ['run', 'start:dev']);
})();
