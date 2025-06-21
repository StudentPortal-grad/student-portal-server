import { EventEmitter } from 'events';

export class EventsManager {
  private static instance: EventsManager;
  private emitter: EventEmitter;

  private constructor() {
    this.emitter = new EventEmitter();
  }

  public static getInstance(): EventsManager {
    if (!EventsManager.instance) {
      EventsManager.instance = new EventsManager();
    }
    return EventsManager.instance;
  }

  public static on(event: string, listener: (...args: any[]) => void | Promise<void>): void {
    try {
      const wrappedListener = async (...args: any[]) => {
        try {
          await listener(...args);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      };
      EventsManager.getInstance().emitter.on(event, wrappedListener);
    } catch (error) {
      console.error(error);
    }
  }

  public static emit(event: string, ...args: any[]): void {
    EventsManager.getInstance().emitter.emit(event, ...args);
  }
}
