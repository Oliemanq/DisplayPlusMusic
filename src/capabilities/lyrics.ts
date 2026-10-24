import { LyricLine, LyricWord } from '../state/lyricState';
import { appStateManager, SongInfo } from '../state/appState';
import { fetchLyrics } from '../model/lyricsModel';
import { SourcesManager } from './sources';

export const Lyrics = {
  /**
   * Parses raw LRC content into structured lines and words.
   */
  parseLines(raw: string): LyricLine[] {
    const result: LyricLine[] = [];
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (match) {
        const lineTime = parseInt(match[1]) * 60 + parseFloat(match[2]);
        const { text, words, endTime } = this.parseWordTags(match[3]);
        if (text) {
          result.push({ time: lineTime, text, words, wordsEndTime: endTime });
        } else {
          result.push({ time: lineTime, text: '~ ♪♪♪ ~' });
        }
      }
    }
    if (result.length > 0 && result[0].time > 5) {
      result.unshift({ time: 0, text: '~ ♪♪♪ ~' });
    }
    return this.insertEnhancedGapFillers(result);
  },

  /**
   * Inserts blank/music-note filler lines for enhanced lyrics with large gaps.
   */
  insertEnhancedGapFillers(lines: LyricLine[], gapThreshold: number = 3): LyricLine[] {
    const result: LyricLine[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      result.push(line);

      const nextLine = lines[i + 1];
      if (!nextLine || typeof line.wordsEndTime !== 'number') continue;

      const gap = nextLine.time - line.wordsEndTime;
      if (gap > gapThreshold) {
        result.push({ time: line.wordsEndTime, text: '~ ♪♪♪ ~' });
      }
    }
    return result;
  },

  /**
   * Parses word/syllable-level timing tags within a lyric line.
   */
  parseWordTags(remainder: string): { text: string; words?: LyricWord[]; endTime?: number } {
    const wordRegex = /<(\d+):(\d+(?:\.\d+)?)>/g;
    const matches = [...remainder.matchAll(wordRegex)];
    if (matches.length === 0) {
      return { text: remainder.trim() };
    }

    const words: LyricWord[] = [];
    let endTime: number | undefined;
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const wordStart = match.index! + match[0].length;
      const wordEnd = i + 1 < matches.length ? matches[i + 1].index! : remainder.length;
      const text = remainder.slice(wordStart, wordEnd).trim();
      const tagTime = parseInt(match[1]) * 60 + parseFloat(match[2]);
      if (text) {
        words.push({ time: tagTime, text });
      } else if (i === matches.length - 1) {
        endTime = tagTime;
      }
    }

    if (words.length === 0) {
      return { text: remainder.replace(wordRegex, '').trim() };
    }

    return {
      text: words.map(w => w.text).join(' '),
      words,
      endTime,
    };
  },

  /**
   * Finds the index of the word that should be active given playback progress.
   */
  getActiveWordIndex(words: LyricWord[] | undefined, progress: number): number {
    if (!words || words.length === 0) return -1;
    let best = -1;
    for (const word of words) {
      if (word.time <= progress) {
        best++;
      } else {
        break;
      }
    }
    return best;
  },

  /**
   * Finds the index of the active lyric line given playback progress.
   */
  getActiveLineIndex(lines: LyricLine[], progress: number, currentIndex: number): number {
    if (lines.length === 0) return -1;

    // Clamp saved index in case the lyrics array shrank (e.g. song skipped)
    let activeIndex = currentIndex;
    if (activeIndex >= lines.length) activeIndex = 0;
    if (activeIndex < 0) activeIndex = 0;

    // O(1) fast path: still on the same line
    const atCurrent = progress >= lines[activeIndex].time;
    const beforeNext = activeIndex === lines.length - 1
      || progress < lines[activeIndex + 1].time;

    if (atCurrent && beforeNext) return activeIndex;

    // O(log n) binary search fallback (user scrubbed)
    let lo = 0, hi = lines.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].time <= progress) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }
};

export class LyricsManager {
  private currentSongID = '';
  private syncedLyrics = '';
  private currentLyricsSource: string = '';
  private isFetching = false;

  private nextSongID = '';
  private nextSyncedLyrics = '';
  private nextLyricsSource: string = '';

  private noLyricsShownUntil: number | null = null;
  private readonly NO_LYRICS_DISPLAY_MS = 5000;

  constructor(private sourcesManager: SourcesManager) {}

  async updateLyrics(song: SongInfo | null) {
    if (!song) {
      this.currentSongID = '';
      this.syncedLyrics = '';
      this.currentLyricsSource = '';
      this.noLyricsShownUntil = null;
      return;
    }

    if (this.currentSongID === song.id || this.isFetching) return;

    // Fast path: next song was pre-cached
    if (this.nextSongID === song.id && this.nextSyncedLyrics) {
      this.currentSongID = this.nextSongID;
      this.syncedLyrics = this.nextSyncedLyrics;
      this.currentLyricsSource = this.nextLyricsSource;
      this.noLyricsShownUntil = null;
      return;
    }

    // Clear stale lyrics
    this.currentSongID = song.id;
    this.syncedLyrics = '';
    this.currentLyricsSource = '';
    this.noLyricsShownUntil = null;

    this.isFetching = true;
    try {
      const lyrics = await fetchLyrics(song);
      if (this.currentSongID === song.id) {
        this.syncedLyrics = lyrics.syncedLyrics ?? '';
        this.currentLyricsSource = lyrics.source ?? '';
      }
    } catch (e) {
      console.error('[LyricsManager] fetchLyrics error:', e);
    } finally {
      this.isFetching = false;
    }
  }

  async cacheNextLyrics(nextSong: SongInfo | null) {
    if (!nextSong || this.nextSongID === nextSong.id || this.currentSongID === nextSong.id) {
      return;
    }

    this.nextSongID = nextSong.id;
    try {
      const lyrics = await fetchLyrics(nextSong);
      this.nextSyncedLyrics = lyrics.syncedLyrics ?? '';
      this.nextLyricsSource = lyrics.source ?? '';
    } catch (e) {
      console.error('[LyricsManager] cacheNextLyrics error:', e);
    }
  }

  getSyncedLyrics(): string {
    return this.syncedLyrics;
  }

  getLyricsSourceLabel(): string {
    return this.currentLyricsSource ? `Lyrics from ${this.currentLyricsSource}` : '';
  }

  getNoLyricsShownUntil(): number | null {
    return this.noLyricsShownUntil;
  }

  setNoLyricsShownUntil(val: number | null): void {
    this.noLyricsShownUntil = val;
  }

  shouldShowNoLyrics(): boolean {
    if (!this.syncedLyrics) {
      if (this.noLyricsShownUntil === null) {
        this.noLyricsShownUntil = Date.now() + this.NO_LYRICS_DISPLAY_MS;
      }
      return Date.now() < this.noLyricsShownUntil!;
    }
    return false;
  }
}
