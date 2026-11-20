// Enforces the API rules in .claude/rules/backend-nestjs.md for src/ and test/.
import { readFileSync, readdirSync } from 'node:fs';
import { join, normalize, relative, sep } from 'node:path';
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
/** Constructor parameter name for each injected infrastructure type. */
const INJECTED_NAMES = {
  Redis: 'redisService',
  PrismaService: 'prismaService',
  JwtService: 'jwtService',
};

/** Every .ts file under `dir`, recursively. */
function listTsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** Repo-relative path with forward slashes. */
function toPosix(file) {
  return relative(API_DIR, file).split(sep).join('/');
}

/** The problem with `file`'s name or location, or null if it is fine. */
function findNameProblem(path) {
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

/** `spec` imported from `fromPath`, as a .ts path, or null for a package import. */
function resolveImport(fromPath, spec) {
  if (spec.startsWith('@/')) return `src/${spec.slice(2)}.ts`;
  if (!spec.startsWith('.')) return null;
  const dir = fromPath.split('/').slice(0, -1).join('/');
  const target = normalize(`${dir}/${spec}`).split(sep).join('/');
  return target.endsWith('.ts') ? target : `${target}.ts`;
}

/** Problems in one file's text. */
function findTextProblems(path, text) {
  const problems = [];
  for (const match of text.matchAll(/constructor\s*\(([\s\S]*?)\)\s*\{/g)) {
    for (const param of match[1].matchAll(
      /(\w+)\s*:\s*(Redis|PrismaService|JwtService)\b/g,
    )) {
      const [, name, type] = param;
      const expected = INJECTED_NAMES[type];
      if (name !== expected) {
        problems.push(`${path}: inject ${type} as ${expected}`);
      }
    }
  }
  if (path.endsWith('.constants.ts')) {
    for (const line of text.split('\n')) {
      if (
        /^(export )?(async )?function |^export const \w+ = (async )?\([^)]*\)[^=]*=>/.test(
          line.trim(),
        )
      ) {
        problems.push(
          `${path}: a constants file exports values, not functions`,
        );
      }
    }
  }
  if (text.includes('.eval(') || text.includes('redis.call(')) {
    problems.push(
      `${path}: use ioredis commands (set, get, del, watch, multi)`,
    );
  }
  if (!path.includes('/interfaces/')) {
    for (const line of text.split('\n')) {
      if (/^(export )?interface /.test(line)) {
        problems.push(`${path}: a top-level interface belongs in interfaces/`);
      }
    }
  }
  if (path.startsWith('src/') && /from ['"]\.\.\//.test(text)) {
    problems.push(`${path}: import across modules with @/, not ../`);
  }
  const isSpec = /\.(e2e-)?spec\.ts$/.test(path);
  if (!isSpec && !path.endsWith('.constants.ts')) {
    const exportCount = text.match(/^export /gm)?.length ?? 0;
    if (exportCount > 1) {
      problems.push(
        `${path}: one export per file (only .constants.ts may export several)`,
      );
    }
  }
  return problems;
}

/** A util imported only by one service (and that service's spec) is a private method. */
function findSingleUseUtils(files) {
  const importers = new Map();
  for (const { path, text } of files) {
    for (const match of text.matchAll(/from ['"]([^'"]+)['"]/g)) {
      const target = resolveImport(path, match[1]);
      if (!target?.endsWith('.util.ts')) continue;
      const users = importers.get(target) ?? new Set();
      users.add(path);
      importers.set(target, users);
    }
  }
  const problems = [];
  for (const [util, users] of importers) {
    const services = [...users].filter((user) => user.endsWith('.service.ts'));
    const specs = [...users].filter((user) =>
      user.endsWith('.service.spec.ts'),
    );
    const others = users.size - services.length - specs.length;
    if (services.length !== 1 || others !== 0) continue;
    const specPath = services[0].replace(/\.ts$/, '.spec.ts');
    if (specs.every((spec) => spec === specPath)) {
      problems.push(
        `${util}: only ${services[0]} uses this helper. Make it a private method`,
      );
    }
  }
  return problems;
}

const files = ['src', 'test'].flatMap((dir) =>
  listTsFiles(join(API_DIR, dir)).map((file) => {
    const path = toPosix(file);
    return { path, text: readFileSync(file, 'utf8') };
  }),
);
const problems = [
  ...files.flatMap(({ path, text }) => [
    findNameProblem(path),
    ...findTextProblems(path, text),
  ]),
  ...findSingleUseUtils(files),
].filter(Boolean);
if (problems.length) {
  console.error(
    `API files break .claude/rules/backend-nestjs.md:\n  ${problems.join('\n  ')}`,
  );
  process.exit(1);
}
