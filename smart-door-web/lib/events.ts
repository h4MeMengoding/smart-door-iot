/**
 * In-memory event emitter untuk notifikasi realtime antar API routes.
 * Digunakan untuk push log baru ke SSE clients tanpa polling.
 */

type LogListener = (log: any) => void;

class LogEventEmitter {
  private listeners = new Set<LogListener>();

  subscribe(listener: LogListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(log: any) {
    for (const listener of this.listeners) {
      try {
        listener(log);
      } catch {
        // Ignore errors from individual listeners
      }
    }
  }

  get count() {
    return this.listeners.size;
  }
}

// Singleton — survives hot reload via globalThis
const globalForEvents = globalThis as unknown as {
  logEvents: LogEventEmitter | undefined;
};

export const logEvents = globalForEvents.logEvents ?? new LogEventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEvents.logEvents = logEvents;
}
