import { spawn } from 'child_process';
import http from 'http';

function checkFastAPIRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8001/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  console.log('[Runner] Checking FastAPI backend...');
  const isRunning = await checkFastAPIRunning();

  const isWin = process.platform === 'win32';
  const pyCmd = isWin ? 'python' : 'python3';
  const npxCmd = isWin ? 'npx.cmd' : 'npx';

  let pyProcess = null;
  if (!isRunning) {
    console.log('[Runner] Starting Python FastAPI server on 127.0.0.1:8001...');
    pyProcess = spawn(pyCmd, ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8001'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: isWin,
    });

    pyProcess.on('error', (err) => {
      console.warn('[Runner] Notice from Python runner:', err.message);
    });
  } else {
    console.log('[Runner] FastAPI is already running on port 8001.');
  }

  console.log('[Runner] Starting Vite frontend on 0.0.0.0:3000...');
  const viteProcess = spawn(npxCmd, ['vite', '--port=3000', '--host=0.0.0.0'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: isWin,
  });

  viteProcess.on('error', (err) => {
    console.error('[Runner] Vite launch error:', err);
  });

  const cleanup = () => {
    console.log('[Runner] Shutting down processes...');
    if (pyProcess) pyProcess.kill('SIGTERM');
    if (viteProcess) viteProcess.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start();
