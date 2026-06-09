import { spawn } from 'node:child_process';

const mode = process.argv[2] === 'dev' ? 'dev' : 'start';
const port = process.env.PORT || '3000';

const child = spawn(
  'corepack',
  [
    'pnpm',
    '--filter',
    'frontend-schnittwerk',
    'exec',
    'next',
    mode,
    '-H',
    '0.0.0.0',
    '-p',
    port,
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_MOCK_MODE: process.env.NEXT_PUBLIC_MOCK_MODE || 'true',
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'pay_at_venue',
      NEXT_PUBLIC_PAYMENT_PROVIDER: process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'pay_at_venue',
    },
  }
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
