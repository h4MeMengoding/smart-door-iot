/**
 * GET /api/logs/stream — Legacy SSE endpoint.
 * 
 * SSE dengan long-lived connections tidak bisa jalan di Vercel Free
 * (10s timeout Serverless, 30s Edge). Dashboard sudah beralih ke
 * incremental polling via GET /api/logs?since=<timestamp>.
 * 
 * Endpoint ini tetap ada supaya client lama tidak error,
 * tapi langsung mengirim satu heartbeat lalu menutup stream.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Kirim satu heartbeat lalu tutup — signal ke client untuk reconnect atau switch ke polling
      controller.enqueue(encoder.encode(': connected\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"use-polling","message":"SSE deprecated, use GET /api/logs?since="}\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
