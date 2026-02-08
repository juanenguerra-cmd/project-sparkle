import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.D1_HEALTH_PORT ?? '8787';
const baseUrl = `http://127.0.0.1:${port}`;
const healthUrl = `${baseUrl}/api/health/d1`;

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
      }
    });
  });

const waitForHealthy = async () => {
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { method: 'GET' });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          `Health endpoint returned ${response.status}: ${JSON.stringify(body)}`
        );
      }
      if (!body?.ok) {
        throw new Error(`Health check failed: ${JSON.stringify(body)}`);
      }
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await delay(500);
    }
  }
};

const main = async () => {
  await runCommand('npx', [
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    'wrangler.toml',
  ]);

  const devProcess = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      'workers/d1/worker.ts',
      '--local',
      '--persist',
      '--port',
      port,
      '--ip',
      '127.0.0.1',
      '--config',
      'wrangler.toml',
    ],
    { stdio: 'inherit' }
  );

  const shutdown = () => {
    if (!devProcess.killed) {
      devProcess.kill('SIGTERM');
    }
  };

  process.on('exit', shutdown);
  process.on('SIGINT', () => {
    shutdown();
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(1);
  });

  try {
    await waitForHealthy();
  } finally {
    shutdown();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
