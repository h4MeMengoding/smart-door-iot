/**
 * Client-side helper to log system events.
 * Fire-and-forget — never blocks UI.
 */
export async function logSystemEvent(eventType: string, description: string): Promise<void> {
  try {
    await fetch('/api/system-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, description }),
    });
  } catch {
    // Fire and forget — don't block UI for event logging
  }
}
