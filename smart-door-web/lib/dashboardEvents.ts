/**
 * Client-side event bus for cross-component realtime updates.
 * Components subscribe to events and react to changes without prop drilling.
 */

type CloneStatus = { state?: string; step?: string; sourceUID?: string; result?: string };
type EventPayloads = {
  'cards-changed': [];
  'card-renamed': [];
  'state-changed': [];
  'cards-syncing': [];
  'cards-synced': [];
  'cards-instant-update': [string[]];
  'clone-status': [CloneStatus];
  'log-added': [unknown];
  'device-tools-open': [boolean];
  'device-tools-closed': [];
};
type EventType = keyof EventPayloads;
type Listener<E extends EventType> = (...args: EventPayloads[E]) => void;
type StoredListener = (...args: unknown[]) => void;

class DashboardEventBus {
  private listeners = new Map<EventType, Set<StoredListener>>();

  on<E extends EventType>(event: E, listener: Listener<E>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const storedListener = listener as StoredListener;
    this.listeners.get(event)!.add(storedListener);
    return () => {
      this.listeners.get(event)?.delete(storedListener);
    };
  }

  emit<E extends EventType>(event: E, ...args: EventPayloads[E]) {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(...args);
      } catch {
        // Ignore listener errors
      }
    });
  }
}

export const dashboardEvents = new DashboardEventBus();
