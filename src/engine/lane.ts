export type LaneCallback = (now: number) => void | Promise<void>;

export class Lane {
  private lastRun: number = 0;
  private isRunning: boolean = false;

  constructor(
    private readonly interval: number,
    private readonly callback: LaneCallback,
    private readonly skipOverlapping: boolean = false
  ) {}

  async tick(now: number): Promise<void> {
    if (this.isRunning && this.skipOverlapping) {
      return;
    }

    if (now - this.lastRun >= this.interval) {
      this.isRunning = true;
      this.lastRun = now;
      try {
        await this.callback(now);
      } finally {
        this.isRunning = false;
      }
    }
  }

  get lastRunTime(): number {
    return this.lastRun;
  }

  get isRunningStatus(): boolean {
    return this.isRunning;
  }
}
