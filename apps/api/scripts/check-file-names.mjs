// Enforces the file-name rules in .claude/rules/backend-nestjs.md for src/ and test/:
// kebab-case `<name>.<kind>.ts`, `.dto.ts` only in dto/, `.interface.ts` only in interfaces/.
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = fileURLToPath(new URL('..', import.meta.url));
const KINDS = [
  'module',
  'controller',
  'service',
  'guard',
  'interceptor',
  'decorator',
  'filter',
  'pipe',
  'middleware',
  'dto',
  'interface',
  'constants',
  'util',
  'setup',
];
const NAME_PATTERN = new RegExp(
  `^[a-z0-9]+(-[a-z0-9]+)*\\.(${KINDS.join('|')})(\\.(e2e-)?spec)?\\.ts$|^[a-z0-9]+(-[a-z0-9]+)*\\.e2e-spec\\.ts$`,
);
/** Entry points Nest requires by name. */
const ALLOWED = new Set(['src/main.ts']);

/** Every .ts file under `dir`, recursively. */
function listTsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** The problem with `file`'s name or location, or null if it is fine. */
function findProblem(file) {
  const path = relative(API_DIR, file).split(sep).join('/');
  const name = path.split('/').pop();
  if (ALLOWED.has(path)) return null;
  if (!NAME_PATTERN.test(name))
    return `${path}: expected <kebab-name>.<kind>.ts`;
  if (/\.dto\.ts$/.test(name) && !path.includes('/dto/'))
    return `${path}: .dto.ts belongs in dto/`;
  if (/\.interface\.ts$/.test(name) && !path.includes('/interfaces/')) {
    return `${path}: .interface.ts belongs in interfaces/`;
  }
  return null;
}

const problems = ['src', 'test']
  .flatMap((dir) => listTsFiles(join(API_DIR, dir)))
  .map(findProblem)
  .filter(Boolean);
if (problems.length) {
  console.error(
    `File names break .claude/rules/backend-nestjs.md:\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
