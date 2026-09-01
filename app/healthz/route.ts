export function GET() {
  return Response.json(
    { ok: true, service: 'alirezas-galaxy' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
