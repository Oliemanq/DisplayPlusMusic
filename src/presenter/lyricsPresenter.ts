import { fetchLyrics } from '../model/lyricsModel';
import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';
import spotifyPresenter from './spotifyPresenter';

interface LyricLine {
    time: number;
    text: string;
}

class LyricsPresenter {
    currentLine = '';
    nextLine = '';

    private currentSongID = '';
    private syncedLyrics = '';
    private currentLyricsSource: 'local server' | 'web' | '' = '';

    private nextSongID = '';
    private nextSyncedLyrics = '';
    private nextPlainLyrics = '';
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
            this.nextPlainLyrics = lyrics.plainLyrics ?? '';
            this.nextLyricsSource = lyrics.source ?? '';
        } catch (e) {
            console.error('[LyricsPresenter] cacheNextLyrics error:', e);
        }
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
                this.setHTML(this.currentLine, '');
                return;
            }

            this.noLyricsShownUntil = null;

            const parsedLines = this.parseLines(this.syncedLyrics);
            const progress = spotifyPresenter.currentSong.progressSeconds + this.BLUETOOTH_DELAY;
            this.currentIndex = this.getActiveIndex(parsedLines, progress);

            if (this.currentIndex === -1) {
                this.currentLine = '';
                this.nextLine = parsedLines.length > 0
                    ? `[${formatTime(parsedLines[0].time)}] ${parsedLines[0].text}`
                    : '';
            } else {
                this.currentLine = `[${formatTime(parsedLines[this.currentIndex].time)}] ${parsedLines[this.currentIndex].text}`;
                this.nextLine = this.currentIndex + 1 < parsedLines.length
                    ? `[${formatTime(parsedLines[this.currentIndex + 1].time)}] ${parsedLines[this.currentIndex + 1].text}`
                    : '';
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
                const text = match[3].trim();
                if (text) {
                    result.push({
                        time: parseInt(match[1]) * 60 + parseFloat(match[2]),
                        text,
                    });
                }
            }
        }
        return result;
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