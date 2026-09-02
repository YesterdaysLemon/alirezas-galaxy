import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('galaxy chrome icons', () => {
  it('uses a five-arm spiral galaxy as the SVG favicon', async () => {
    const favicon = await readFile(
      path.join(process.cwd(), 'public', 'favicon.svg'),
      'utf8',
    );

    expect(favicon.match(/<use\b/g)).toHaveLength(5);
    expect(favicon).toContain('id="spiral-arm"');
    expect(favicon).toContain('fill="url(#arms)"');
    expect(favicon).not.toContain('id="star"');
  });
});
