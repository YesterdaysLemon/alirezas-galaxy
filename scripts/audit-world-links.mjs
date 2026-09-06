// Read-only public HTTP audit. Run with explicit URLs, or audit the two catalogs.
import { readFile, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const output = outputIndex < 0 ? null : args.splice(outputIndex, 2)[1];
const decode = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
const attributes = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(
      ([, key, a, b, c]) => [key.toLowerCase(), decode(a ?? b ?? c)],
    ),
  );
async function request(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Galaxy-Link-Audit/1.0' },
  });
  return { response, text: await response.text() };
}
async function audit(url) {
  try {
    const { response, text } = await request(url);
    const links = [...text.matchAll(/<link\b[^>]*>/gi)].map(([tag]) =>
      attributes(tag),
    );
    const icons = links.filter(
      ({ rel, href }) =>
        href &&
        /(?:^|\s)(?:icon|apple-touch-icon|shortcut)(?:\s|$)/i.test(rel ?? ''),
    );
    const iconResults = await Promise.all(
      icons.map(async (icon) => {
        const href = new URL(icon.href, response.url).href;
        try {
          const result = await fetch(href, {
            signal: AbortSignal.timeout(15000),
          });
          const bytes = await result.arrayBuffer();
          return {
            url: href,
            rel: icon.rel,
            status: result.status,
            type: result.headers.get('content-type'),
            bytes: bytes.byteLength,
          };
        } catch (error) {
          return { url: href, error: error.message };
        }
      }),
    );
    return {
      url,
      finalUrl: response.url,
      status: response.status,
      type: response.headers.get('content-type'),
      title: decode(
        text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '',
      ),
      canonical: links.find(({ rel }) => rel === 'canonical')?.href,
      icons: iconResults,
    };
  } catch (error) {
    return { url, error: error.message, cause: error.cause?.code };
  }
}
const urls = args.length
  ? args
  : (
      await Promise.all(
        ['data/worlds.ts', 'data/webring.ts'].map((file) =>
          readFile(file, 'utf8'),
        ),
      )
    ).flatMap((source) =>
      [...source.matchAll(/\burl:\s*'([^']+)'/g)].map((match) => match[1]),
    );
const results = [];
for (let start = 0; start < urls.length; start += 6)
  results.push(...(await Promise.all(urls.slice(start, start + 6).map(audit))));
const report = { checkedAt: new Date().toISOString(), results };
if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
