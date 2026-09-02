import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('galaxy chrome icons', () => {
  it('uses the five-point galaxy mark as the SVG favicon', async () => {
    const favicon = await readFile(
      path.join(process.cwd(), 'public', 'favicon.svg'),
      'utf8',
    );

    expect(favicon.match(/<path\b/g)).toHaveLength(2);
    expect(favicon).toContain('fill="url(#star)"');
    expect(favicon).toContain('M12 2.5c2 0 2.7 4.1');
    expect(favicon).toContain('M8.4 11.9c.9-2.7');
  });
});
