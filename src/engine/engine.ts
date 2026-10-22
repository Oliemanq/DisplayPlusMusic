import { Clock } from './clock';
import { Lane } from './lane';

export class Engine {
  private lanes: Lane[] = [];
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;

  constructor() {}

  addLane(lane: Lane): void {
    this.lanes.push(lane);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (timestamp: number): void => {
    if (!this.isRunning) return;

    // Convert timestamp to milliseconds if it's in seconds (though rAF is usually ms)
    const now = timestamp;
    
    for (const lane of this.lanes) {
      lane.tick(now);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
