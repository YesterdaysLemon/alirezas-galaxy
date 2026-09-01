import { renderLlmsText } from '@/data/site';

export function GET() {
  return new Response(renderLlmsText(), {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
