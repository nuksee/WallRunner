/** Tiny typed event emitter, so components talk through events instead of internals. */
export class Emitter<Events extends Record<string, unknown[]>> {
  private handlers: { [K in keyof Events]?: Array<(...args: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (...args: Events[K]) => void): void {
    (this.handlers[event] ??= []).push(handler);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    for (const h of this.handlers[event] ?? []) h(...args);
  }
}
