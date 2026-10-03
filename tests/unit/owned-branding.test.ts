import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ownedRedirectTarget } from '../../scripts/owned-redirects.mjs';
import {
  downloadInnerManagementIcon,
  validateIcon,
  ICON_ALIAS,
  ICON_SOURCE,
  MAX_ICON_BYTES,
} from '../../scripts/fetch-inner-management-icon.mjs';

const original = await readFile('public/site-icons/inner-management.svg');
const icon = () =>
  new Response(original, { headers: { 'content-type': 'image/svg+xml' } });
const redirect = (location = ICON_SOURCE, status = 301) =>
  new Response(null, { status, headers: { location } });

function sequence(responses: Response[]) {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  const request: typeof fetch = async (input, options) => {
    calls.push({
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      options,
    });
    const response = responses.shift();
    if (!response) throw new Error('Unexpected extra request');
    return response;
  };
  return { calls, request };
}

describe('reviewed owned favicon ingestion', () => {
  it('uses the source SVG byte-for-byte after exactly one permanent owned hop', async () => {
    for (const status of [301, 308]) {
      const { calls, request } = sequence([
        redirect(ICON_SOURCE, status),
        icon(),
      ]);
      expect(await downloadInnerManagementIcon(request)).toEqual(original);
      expect(calls.map((x) => x.url)).toEqual([ICON_ALIAS, ICON_SOURCE]);
      expect(calls.every((x) => x.options?.redirect === 'manual')).toBe(true);
      expect(calls[0].options?.signal).toBe(calls[1].options?.signal);
    }
  });

  it('refuses unsafe destinations before requesting them', async () => {
    for (const location of [
      'http://innermanagement.systems/favicon.svg',
      'https://innermanagement.systems.evil.example/favicon.svg',
      'https://user:pass@innermanagement.systems/favicon.svg',
      'https://innermanagement.systems:8443/favicon.svg',
      'https://innermanagement.systems/other.svg',
      'https://innermanagement.systems/favicon.svg?next=internal',
      'https://innermanagement.systems/favicon.svg#other',
      'https://admin.alirezaafshan.com/favicon.svg',
      'https://127.0.0.1/favicon.svg',
      '/loop.svg',
    ]) {
      const { calls, request } = sequence([redirect(location)]);
      await expect(downloadInnerManagementIcon(request)).rejects.toThrow(
        /approved/,
      );
      expect(calls).toHaveLength(1);
    }
    expect(
      ownedRedirectTarget(
        'https://admin.alirezaafshan.com/favicon.svg',
        ICON_SOURCE,
      ),
    ).toBeNull();
    expect(
      ownedRedirectTarget(
        'https://innermanagement.systems/favicon.svg',
        ICON_SOURCE,
      ),
    ).toBeNull();
  });

  it('requires a permanent first hop, no second redirect and final successful image content', async () => {
    for (const status of [200, 302, 307, 500]) {
      const { calls, request } = sequence([
        new Response(null, { status, headers: { location: ICON_SOURCE } }),
      ]);
      await expect(downloadInnerManagementIcon(request)).rejects.toThrow(
        /permanent/,
      );
      expect(calls).toHaveLength(1);
    }
    await expect(
      downloadInnerManagementIcon(
        sequence([new Response(null, { status: 301 })]).request,
      ),
    ).rejects.toThrow(/permanent/);
    for (const status of [301, 404, 500]) {
      const { calls, request } = sequence([
        redirect(),
        new Response(null, { status, headers: { location: ICON_SOURCE } }),
      ]);
      await expect(downloadInnerManagementIcon(request)).rejects.toThrow(
        /without another redirect/,
      );
      expect(calls).toHaveLength(2);
    }
    await expect(
      downloadInnerManagementIcon(
        sequence([
          redirect(),
          new Response('<html>Not an icon</html>', {
            headers: { 'content-type': 'text/html' },
          }),
        ]).request,
      ),
    ).rejects.toThrow(/SVG/);
  });

  it('bounds both declared and streaming bytes and rejects empty, active or unreviewed SVGs', async () => {
    const headerCases: Array<Record<string, string>> = [
      {
        'content-type': 'image/svg+xml',
        'content-length': String(MAX_ICON_BYTES + 1),
      },
      { 'content-type': 'image/svg+xml' },
    ];
    for (const headers of headerCases)
      await expect(
        downloadInnerManagementIcon(
          sequence([
            redirect(),
            new Response(new Uint8Array(MAX_ICON_BYTES + 1), { headers }),
          ]).request,
        ),
      ).rejects.toThrow(/byte limit/);
    expect(() => validateIcon(new Uint8Array(), 'image/svg+xml')).toThrow(
      /empty/,
    );
    expect(() =>
      validateIcon(
        Buffer.from('<svg><script>alert(1)</script></svg>'),
        'image/svg+xml',
      ),
    ).toThrow(/active/);
    expect(() =>
      validateIcon(
        Buffer.from('<svg><image href="https://private.example/"/></svg>'),
        'image/svg+xml',
      ),
    ).toThrow(/external/);
    expect(() =>
      validateIcon(Buffer.from('<svg><circle r="1"/></svg>'), 'image/svg+xml'),
    ).toThrow(/reviewed original/);
    expect(() => validateIcon(original, 'text/html')).toThrow(/SVG/);
  });
});
