const { execSync } = require('child_process');

const port = process.argv[2] || process.env.PORT || '5001';

function killOnWindows() {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.includes('LISTENING')) continue;
      const match = trimmed.match(/(\d+)\s*$/);
      if (match) pids.add(match[1]);
    }

    const selfPid = String(process.pid);

    for (const pid of pids) {
      if (pid === selfPid) continue;
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Freed port ${port} (stopped PID ${pid})`);
      } catch {
        /* process may already be gone */
      }
    }
  } catch {
    /* no process on port — ok */
  }
}

if (process.platform === 'win32') {
  killOnWindows();
}
