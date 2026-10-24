import { appStateManager } from './appState';
import { Lyrics } from '../capabilities/lyrics';

export interface LyricWord {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  words?: LyricWord[];
  wordsEndTime?: number;
}

export interface LyricState {
  lines: LyricLine[];
  currentLineIndex: number;
  currentWordIndex: number;
  generation: number;
}

export class LyricStateManager {
  private state: LyricState = {
    lines: [],
    currentLineIndex: -1,
    currentWordIndex: -1,
    generation: 0,
  };

  private listeners: Array<(state: LyricState) => void> = [];

  constructor() {
    // When song changes, reset lyric state and bump generation
    appStateManager.subscribe((appState) => {
      if (appState.generation !== this.state.generation) {
        this.reset(appState.generation);
      }
    });
  }

  getState(): LyricState {
    return { ...this.state };
  }

  private reset(generation: number): void {
    this.state = {
      lines: [],
      currentLineIndex: -1,
      currentWordIndex: -1,
      generation,
    };
    this.notify();
  }

  setLyrics(lines: LyricLine[]): void {
    const currentGen = appStateManager.getState().generation;
    if (this.state.generation !== currentGen) {
        this.reset(currentGen);
    }
    this.state.lines = lines;
    this.state.currentLineIndex = -1;
    this.state.currentWordIndex = -1;
    this.notify();
  }

  updateProgress(currentTime: number): void {
    const lines = this.state.lines;
    if (lines.length === 0) return;

    const newLineIndex = Lyrics.getActiveLineIndex(lines, currentTime, this.state.currentLineIndex);
    
    let newWordIndex = -1;
    if (newLineIndex !== -1) {
      const activeLine = lines[newLineIndex];
      if (activeLine.words) {
        newWordIndex = Lyrics.getActiveWordIndex(activeLine.words, currentTime);
      }
    }

    if (this.state.currentLineIndex !== newLineIndex || this.state.currentWordIndex !== newWordIndex) {
      this.state.currentLineIndex = newLineIndex;
      this.state.currentWordIndex = newWordIndex;
      this.notify();
    }
  }

  subscribe(listener: (state: LyricState) => void): () => void {
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

export const lyricStateManager = new LyricStateManager();
