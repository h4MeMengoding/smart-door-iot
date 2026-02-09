/**
 * Client-side event bus for cross-component realtime updates.
 * Components subscribe to events and react to changes without prop drilling.
 */

type EventType = 'cards-changed' | 'card-renamed' | 'state-changed' | 'cards-syncing' | 'cards-synced' | 'cards-instant-update';
type Listener = (...args: any[]) => void;

class DashboardEventBus {
  private listeners = new Map<EventType, Set<Listener>>();

  on(event: EventType, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: EventType, ...args: any[]) {
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
