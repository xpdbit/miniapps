type Listener<T = unknown> = (data: T) => void;

export class EventBus {
  private listeners: Map<string, Set<Listener>> = new Map();

  on<T>(event: string, listener: Listener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener);
  }

  off<T>(event: string, listener: Listener<T>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as Listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T>(event: string, data: T): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`[EventBus] 事件 ${event} 处理出错:`, err);
        }
      });
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  /** 返回已注册的事件数量 */
  eventCount(): number {
    return this.listeners.size;
  }
}

export const globalEventBus = new EventBus();
