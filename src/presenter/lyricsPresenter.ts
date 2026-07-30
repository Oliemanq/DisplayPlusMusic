import { fetchLyrics } from '../model/lyricsModel';
import Song from '../model/songModel';
import spotifyPresenter from './spotifyPresenter';

export interface LyricWord {
    time: number;
    text: string;
}

export interface LyricLine {
    time: number;
    text: string;
    /** Word/syllable-level timing (e.g. from .elrc / OpenSubsonic enhanced lyrics), when available. */
    words?: LyricWord[];
}

class LyricsPresenter {
  currentLine = '';
  nextLine = '';
  /** Word/syllable timing for the current line, when the source provides it (e.g. .elrc/enhanced lyrics). */
  currentLineWords: LyricWord[] = [];
  /** Index into currentLineWords of the word that should currently be highlighted, or -1 if none/unavailable. */
  currentWordIndex = -1;

  private currentSongID = '';
  private syncedLyrics = '';
  private currentLyricsSource: 'local server' | 'web' | '' = '';

  private nextSongID = '';
  private nextSyncedLyrics = '';
  private nextLyricsSource: 'local server' | 'web' | '' = '';

  private isFetching = false;
  private currentIndex = 0;
  private noLyricsShownUntil: number | null = null;

  // Compensate for Bluetooth display latency
  private readonly BLUETOOTH_DELAY = 0.1;
  // Show "No Lyrics Found" for this long before clearing it
  private readonly NO_LYRICS_DISPLAY_MS = 5000;

  async updateLyrics(song: Song) {
    if (this.currentSongID === song.songID || this.isFetching) return;

    // Fast path: next song was pre-cached
    if (this.nextSongID === song.songID && this.nextSyncedLyrics) {
      this.currentSongID = this.nextSongID;
      this.syncedLyrics = this.nextSyncedLyrics;
      this.currentLyricsSource = this.nextLyricsSource;
      this.currentIndex = 0;
      this.noLyricsShownUntil = null;
      return;
    }

    // Clear stale lyrics immediately so the display doesn't show wrong song's lines
    this.currentSongID = song.songID;
    this.syncedLyrics = '';
    this.currentLyricsSource = '';
    this.currentIndex = 0;
    this.currentLine = '';
    this.nextLine = '';
    this.currentLineWords = [];
    this.currentWordIndex = -1;
    this.noLyricsShownUntil = null;

    this.isFetching = true;
    try {
      const lyrics = await fetchLyrics(song);
      // Only apply if the song hasn't changed again while fetching
      if (this.currentSongID === song.songID) {
        this.syncedLyrics = lyrics.syncedLyrics ?? '';
        this.currentLyricsSource = lyrics.source ?? '';
      }
    } catch (e) {
      console.error('[LyricsPresenter] fetchLyrics error:', e);
    } finally {
      this.isFetching = false;
    }
  }

  async cacheNextLyrics(nextSong: Song) {
    if (
      this.nextSongID === nextSong.songID ||
      this.currentSongID === nextSong.songID
    ) return;

    this.nextSongID = nextSong.songID;
    try {
      const lyrics = await fetchLyrics(nextSong);
      this.nextSyncedLyrics = lyrics.syncedLyrics ?? '';
      this.nextLyricsSource = lyrics.source ?? '';
    } catch (e) {
      console.error('[LyricsPresenter] cacheNextLyrics error:', e);
    }
  }

  get currentLineFormatted(): string {
    if (!this.hasWordTiming) {
      return this.currentLine === '' ? `` : ` [   ${this.currentLine}   ]`;
    } else {
      let line = `  [   "`;

      for (let i = 0; i < this.currentLineWords.length; i++) {
        line += this.currentLineWords[i].text;
        console.log('current word index ' + this.currentWordIndex)

        if (i == this.currentWordIndex) {
          if (this.currentLineWords[this.currentWordIndex].text.endsWith("'") || this.currentLineWords[this.currentWordIndex].text.endsWith("\"")) {
            line += ` " `
          } else {
            line += `" `
          }
        } else {
          line += ` `
        }
      }

      line += '   ]'
      return line;
    }
  }

  /** True when the current line has word/syllable-level timing available (e.g. .elrc). */
  get hasWordTiming(): boolean {
    return this.currentLineWords.length > 0;
  }

  getLyricsSourceLabel(): string {
    return this.currentLyricsSource ? `Lyrics from ${this.currentLyricsSource}` : '';
  }

  async updateLyricsLine() {
    try {
      if (!spotifyPresenter.currentSong || !this.syncedLyrics) {
        // Show "No Lyrics Found" briefly, then clear
        if (this.noLyricsShownUntil === null) {
          this.noLyricsShownUntil = Date.now() + this.NO_LYRICS_DISPLAY_MS;
        }
        this.currentLine = Date.now() < this.noLyricsShownUntil ? 'No Lyrics Found' : '';
        this.nextLine = '';
        this.currentLineWords = [];
        this.currentWordIndex = -1;
        this.setHTML(this.currentLine, '');
        return;
      }

      this.noLyricsShownUntil = null;

      const parsedLines = this.parseLines(this.syncedLyrics);
      const progress = spotifyPresenter.currentSong.progressSeconds + this.BLUETOOTH_DELAY;
      this.currentIndex = this.getActiveIndex(parsedLines, progress);

      if (this.currentIndex === -1) {
        this.currentLine = '';
        this.nextLine = parsedLines.length > 0 ? parsedLines[0].text : '';
        this.currentLineWords = [];
        this.currentWordIndex = -1;
      } else {
        const activeLine = parsedLines[this.currentIndex];
        this.currentLine = activeLine.text;
        this.nextLine = this.currentIndex + 1 < parsedLines.length
          ? parsedLines[this.currentIndex + 1].text
          : '';
        this.currentLineWords = activeLine.words ?? [];
        this.currentWordIndex = this.getActiveWordIndex(activeLine.words, progress);
      }

      this.setHTML(this.currentLine, this.nextLine);
    } catch (e) {
      console.error('[LyricsPresenter] updateLyricsLine error:', e);
    }
  }

  private parseLines(raw: string): LyricLine[] {
    const result: LyricLine[] = [];
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (match) {
        const lineTime = parseInt(match[1]) * 60 + parseFloat(match[2]);
        const { text, words } = this.parseWordTags(match[3]);
        if (text) {
          result.push({ time: lineTime, text, words });
        } else {
          result.push({ time: lineTime, text: '~ ♪♪♪ ~' });
        }
      }
    }
    if (result.length > 0 && result[0].time > 5) {
      result.unshift({ time: 0, text: '~ ♪♪♪ ~' });
    }
    return result;
  }

  /**
   * Parses word/syllable-level timing tags within a lyric line's remaining text, e.g.
   * enhanced LRC / .elrc style: `<00:12.00>Hello <00:12.50>world`.
   * Falls back to plain trimmed text when no word tags are present.
   */
  private parseWordTags(remainder: string): { text: string; words?: LyricWord[] } {
    const wordRegex = /<(\d+):(\d+(?:\.\d+)?)>/g;
    const matches = [...remainder.matchAll(wordRegex)];
    if (matches.length === 0) {
      return { text: remainder.trim() };
    }

    const words: LyricWord[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const wordStart = match.index! + match[0].length;
      const wordEnd = i + 1 < matches.length ? matches[i + 1].index! : remainder.length;
      const text = remainder.slice(wordStart, wordEnd).trim();
      if (text) {
        words.push({
          time: parseInt(match[1]) * 60 + parseFloat(match[2]),
          text,
        });
      }
    }

    if (words.length === 0) {
      return { text: remainder.replace(wordRegex, '').trim() };
    }

    return {
      text: words.map(w => w.text).join(' '),
      words,
    };
  }

  /** Finds the index of the word that should be active given playback progress (linear scan; word lists are short). */
  private getActiveWordIndex(words: LyricWord[] | undefined, progress: number): number {
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
  }

  private getActiveIndex(lines: LyricLine[], progress: number): number {
    if (lines.length === 0) return -1;

    // Clamp saved index in case the lyrics array shrank (e.g. song skipped)
    if (this.currentIndex >= lines.length) this.currentIndex = 0;

    // O(1) fast path: still on the same line
    const atCurrent = progress >= lines[this.currentIndex].time;
    const beforeNext = this.currentIndex === lines.length - 1
      || progress < lines[this.currentIndex + 1].time;

    if (atCurrent && beforeNext) return this.currentIndex;

    // O(log n) binary search fallback (user scrubbed)
    let lo = 0, hi = lines.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].time <= progress) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    this.currentIndex = best;
    return best;
  }

  private setHTML(current: string, next: string) {
    try {
      const lyricsSourceText = this.getLyricsSourceLabel();
      const el1 = document.getElementById('current-lyric-line');
      const el2 = document.getElementById('next-lyric-line');
      const el3 = document.getElementById('lyrics-source');
      if (el1) el1.textContent = current;
      if (el2) el2.textContent = next;
      if (el3) el3.textContent = lyricsSourceText;
    } catch (_) { /* DOM may be unavailable in background */ }
  }
}

const lyricsPresenter = new LyricsPresenter();
export default lyricsPresenter;
