import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('globals.css', () => {
  // Without @source, Tailwind in the apps only sees packages/ui files that git
  // already tracks: a component just added with `shadcn add` renders unstyled
  // until it is committed.
  test('names the components folder for Tailwind to scan', () => {
    const css = readFileSync(join(import.meta.dir, 'globals.css'), 'utf8');
    expect(css).toContain("@source '../components';");
  });
});
