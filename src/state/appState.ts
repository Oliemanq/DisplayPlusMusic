export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverArt: string;
  durationSeconds: number;
  progressSeconds: number;
}

export interface AppState {
  currentSong: SongInfo | null;
  isPaused: boolean;
  isPlaying: boolean;
  generation: number;
}

export class AppStateManager {
  private state: AppState = {
    currentSong: null,
    isPaused: true,
    isPlaying: false,
    generation: 0,
  };

  private listeners: Array<(state: AppState) => void> = [];

  getState(): AppState {
    return { ...this.state };
  }

  setSong(song: SongInfo | null): void {
    if (this.state.currentSong?.id === song?.id) return;
    this.state.currentSong = song;
    this.state.generation++;
    this.notify();
  }

  updateCurrentSong(updater: (song: SongInfo) => void): void {
    if (this.state.currentSong) {
      updater(this.state.currentSong);
    }
  }

  setPlaybackStatus(isPlaying: boolean, isPaused: boolean): void {
    this.state.isPlaying = isPlaying;
    this.state.isPaused = isPaused;
    this.notify();
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }
}

export const appStateManager = new AppStateManager();
