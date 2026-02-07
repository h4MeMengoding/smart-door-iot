import { logEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

// GET /api/logs/stream - SSE stream for realtime log updates
export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Kirim heartbeat awal supaya client tahu koneksi berhasil
      controller.enqueue(encoder.encode(': connected\n\n'));

      // Subscribe ke log events
      unsubscribe = logEvents.subscribe((log) => {
        try {
          const data = JSON.stringify(log);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Controller sudah closed
        }
      });

      // Heartbeat setiap 30 detik agar koneksi tidak timeout
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // Controller sudah closed
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 30_000);
    },
    cancel() {
      // Client disconnected — cleanup
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
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
