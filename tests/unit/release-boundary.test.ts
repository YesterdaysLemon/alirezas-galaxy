import { readFile } from 'node:fs/promises';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';

const patterns = (await readFile('.dockerignore', 'utf8'))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

// The lab exclusions deliberately use only portable positive glob patterns.
const excluded = (path: string) => {
  const parts = path.split('/');
  return parts.some((_, index) =>
    patterns.some((pattern) =>
      matchesGlob(parts.slice(0, index + 1).join('/'), pattern),
    ),
  );
};

describe('local-only lab release boundary', () => {
  it('omits current labs and future lab routes before the container build', () => {
    for (const path of [
      'app/motion-lab/page.tsx',
      'app/static-lab/static-lab.css',
      'app/new-lab/page.tsx',
      'app/tools/new-lab/page.tsx',
      'app/labs/page.tsx',
      'app/tools/lab/page.tsx',
      'components/motion-lab.tsx',
      'components/static-lab.tsx',
      'data/motion-lab.ts',
      'data/static-lab.ts',
      'public/icon-lab.html',
      'public/experiments/new-lab.html',
      'public/labs/index.html',
    ])
      expect(excluded(path), path).toBe(true);
  });
  it('keeps public worlds and their legitimate lab-named icons', () => {
    for (const path of [
      'app/page.tsx',
      'components/galaxy-index.tsx',
      'data/worlds.ts',
      'public/site-icons/celegans-lab.svg',
      'public/favicon.svg',
    ])
      expect(excluded(path), path).toBe(false);
  });
  it('checks the known lab entry points before building the release image', async () => {
    const dockerfile = await readFile('Dockerfile', 'utf8');
    expect(dockerfile).toContain('test ! -e app/motion-lab');
    expect(dockerfile).toContain('test ! -e app/static-lab');
    expect(dockerfile).toContain('test ! -e public/icon-lab.html');
    expect(dockerfile.indexOf('test ! -e app/motion-lab')).toBeLessThan(
      dockerfile.indexOf('RUN npm run build'),
    );
  });
});
