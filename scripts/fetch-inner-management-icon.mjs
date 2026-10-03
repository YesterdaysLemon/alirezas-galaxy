import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ownedRedirectTarget } from './owned-redirects.mjs';

export const ICON_ALIAS =
  'https://innermanagement.alirezaafshan.com/favicon.svg';
export const ICON_SOURCE = 'https://innermanagement.systems/favicon.svg';
export const ICON_SHA256 =
  '4d14dce4e2e621b07c6267a3ef071e58af002bad48c8b01eb8a3b575ae704936';
export const MAX_ICON_BYTES = 8192;

/** Reviewed original SVG: passive circles and an adaptive-color stylesheet. */
export function validateIcon(bytes, contentType) {
  if (contentType?.split(';')[0].trim().toLowerCase() !== 'image/svg+xml')
    throw new Error('Expected an SVG favicon response');
  if (!bytes.length || bytes.length > MAX_ICON_BYTES)
    throw new Error('Favicon exceeds the byte limit or is empty');
  const svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (
    !/^<svg\b/.test(svg) ||
    !/<\/svg>\s*$/.test(svg) ||
    /<!|<(script|foreignObject)\b|\b(?:href|on\w+)\s*=|url\(/i.test(svg)
  )
    throw new Error('Unexpected active or external SVG content');
  if (createHash('sha256').update(bytes).digest('hex') !== ICON_SHA256)
    throw new Error(
      'Favicon differs from the reviewed original; review source branding before updating',
    );
  return bytes;
}

async function readBounded(response) {
  if (Number(response.headers.get('content-length')) > MAX_ICON_BYTES) {
    await response.body?.cancel();
    throw new Error('Favicon exceeds the byte limit');
  }
  if (!response.body) throw new Error('Empty favicon response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ICON_BYTES)
        throw new Error('Favicon exceeds the byte limit');
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/** Exactly two manual requests, one owned permanent hop, one shared deadline. */
export async function downloadInnerManagementIcon(request = fetch) {
  const options = {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Galaxy-owned-branding/1.0' },
  };
  const redirect = await request(ICON_ALIAS, options);
  await redirect.body?.cancel();
  const target = ownedRedirectTarget(
    ICON_ALIAS,
    redirect.headers.get('location'),
  );
  if (![301, 308].includes(redirect.status) || target !== ICON_SOURCE)
    throw new Error('Expected the exact approved permanent favicon redirect');
  const response = await request(target, options);
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(
      'Favicon destination must succeed without another redirect',
    );
  }
  const type = response.headers.get('content-type');
  if (type?.split(';')[0].trim().toLowerCase() !== 'image/svg+xml') {
    await response.body?.cancel();
    throw new Error('Expected an SVG favicon response');
  }
  return validateIcon(await readBounded(response), type);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const bytes = await downloadInnerManagementIcon();
  await mkdir('public/site-icons', { recursive: true });
  await writeFile('public/site-icons/inner-management.svg', bytes);
  console.log(
    JSON.stringify({
      alias: ICON_ALIAS,
      source: ICON_SOURCE,
      sha256: ICON_SHA256,
      bytes: bytes.length,
      saved: 'public/site-icons/inner-management.svg',
    }),
  );
}
