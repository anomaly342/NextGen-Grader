// Starts the Postgres and Redis containers the e2e suite needs (docker-compose.yml),
// waiting until both are healthy. CI skips this and uses its own service containers.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const composeFile = fileURLToPath(
  new URL('../../../docker-compose.yml', import.meta.url),
);

try {
  execSync('docker info', { stdio: 'ignore' });
} catch {
  console.error(
    'Docker is not running. Start Docker Desktop, then run test:e2e again.',
  );
  process.exit(1);
}

execSync(`docker compose -f "${composeFile}" up -d --wait postgres redis`, {
  stdio: 'inherit',
});
