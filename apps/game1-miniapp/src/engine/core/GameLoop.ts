export interface ITickable {
  tick(deltaSeconds: number): void;
}

export class GameLoop {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastTickTime: number = 0;
  private isRunning: boolean = false;
  private modules: ITickable[] = [];
  private tickInterval: number = 100; // 100ms tick
  private timeScale: number = 1;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickTime = Date.now();
    this.scheduleNextTick();
  }

  pause(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  resume(): void {
    this.lastTickTime = Date.now();
    this.start();
  }

  stop(): void {
    this.pause();
    this.modules = [];
  }

  registerModule(module: ITickable): void {
    this.modules.push(module);
  }

  unregisterModule(module: ITickable): void {
    const idx = this.modules.indexOf(module);
    if (idx !== -1) {
      this.modules.splice(idx, 1);
    }
  }

  setTickInterval(ms: number): void {
    this.tickInterval = ms;
    if (this.isRunning) {
      this.pause();
      this.start();
    }
  }

  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;
    this.timerId = setTimeout(() => {
      this.tick();
    }, this.tickInterval);
  }

  private tick(): void {
    const now = Date.now();
    const rawDelta = now - this.lastTickTime;
    this.lastTickTime = now;

    const clampedDelta = Math.min(rawDelta, 1000); // 最大 1s
    const scaledDelta = (clampedDelta / 1000) * this.timeScale;

    for (const module of this.modules) {
      module.tick(scaledDelta);
    }

    this.scheduleNextTick();
  }
}
