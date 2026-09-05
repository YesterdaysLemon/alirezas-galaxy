import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard the hit-area contract used by the renderer's :hover motion lock.
// These are stylesheet regression checks, not browser hit-testing tests.
const css = await readFile(
  path.join(process.cwd(), 'app', 'world-comms.css'),
  'utf8',
);

describe('continuous comms hit areas', () => {
  it('makes the entire detail wrapper interactive, including its gaps', () => {
    const rule = css.match(/\}\s*\.world-detail\s*\{([^}]+)\}/)?.[1];
    expect(rule).toMatch(/pointer-events:\s*auto/);
  });

  it('makes the preview button interactive while preserving passive hints', () => {
    const rule = css.match(
      /^\.world-preview:not\(\.is-hover-hint\)\s*\{([^}]+)\}/m,
    )?.[1];
    expect(rule).toMatch(/pointer-events:\s*auto/);
    const baseRule = css.match(
      /^\.world-preview,\s*\.world-detail\s*\{([^}]+)\}/m,
    )?.[1];
    expect(baseRule).toMatch(/pointer-events:\s*none/);
    expect(css).not.toMatch(
      /\.world-preview:not\(\.is-hover-hint\)\s+\.world-preview-(?:orbit|screen)\s*\{/,
    );
  });
});
