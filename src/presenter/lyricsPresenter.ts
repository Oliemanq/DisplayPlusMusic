import { fetchLyrics } from "../model/lyricsModel";
import { formatTime } from "../Scripts/formatTime";
import Song from "../model/songModel";
import spotifyPresenter from "./spotifyPresenter";

class LyricsPresenter {
    currentTrackSongID: string = "";
    currentTrackLyrics: string = "";
    currentTrackSyncedLyrics: string = "";

    nextTrackSongID: string = "";
    nextTrackLyrics: string = "";
    nextTrackSyncedLyrics: string = "";

    currentLine: string = "";
    nextLine: string = "";

    async updateLyrics(song: Song) {
        if (this.currentTrackSongID === song.songID) return;

        // If the new song is what we cached as the exact next song, swap them in
        if (this.nextTrackSongID === song.songID && this.nextTrackSyncedLyrics) {
            this.currentTrackSongID = this.nextTrackSongID;
            this.currentTrackLyrics = this.nextTrackLyrics;
            this.currentTrackSyncedLyrics = this.nextTrackSyncedLyrics;
            return;
        }

        // Otherwise fetch fresh
        this.currentTrackSongID = song.songID;

        let lyrics = await fetchLyrics(song);

        this.currentTrackLyrics = lyrics.plainLyrics;
        this.currentTrackSyncedLyrics = lyrics.syncedLyrics;
    }

    async cacheNextLyrics(nextSong?: Song) {
        if (!nextSong || this.nextTrackSongID === nextSong.songID || this.currentTrackSongID === nextSong.songID) return;

        this.nextTrackSongID = nextSong.songID;
        let lyrics = await fetchLyrics(nextSong);

        this.nextTrackLyrics = lyrics.plainLyrics;
        this.nextTrackSyncedLyrics = lyrics.syncedLyrics;
    }

    async updateLyricsLine() {
        if (!spotifyPresenter.currentSong || !this.currentTrackSyncedLyrics) {
            this.currentLine = "";
            this.nextLine = "";
            return;
        }

        const lines = this.currentTrackSyncedLyrics.split('\n');
        const parsedLines: { time: number; text: string }[] = [];

        for (const line of lines) {
            const match = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseFloat(match[2]);
                parsedLines.push({
                    time: minutes * 60 + seconds,
                    text: match[3]
                });
            }
        }

        // Bluetooth delay in seconds (100ms = 0.1s)
        const BLUETOOTH_DELAY = 0.1;
        const progress = Math.max(0, spotifyPresenter.currentSong.progressSeconds - BLUETOOTH_DELAY);
        let currentIndex = -1;

        for (let i = 0; i < parsedLines.length; i++) {
            if (progress >= parsedLines[i].time) {
                currentIndex = i;
            } else {
                break;
            }
        }

        if (currentIndex === -1) {
            this.currentLine = "";
            this.nextLine = parsedLines.length > 0 ? `[${formatTime(parsedLines[0].time)}] ${parsedLines[0].text}` : "";
        } else {
            this.currentLine = `[${formatTime(parsedLines[currentIndex].time)}] ${parsedLines[currentIndex].text}`;
            this.nextLine = currentIndex + 1 < parsedLines.length ? `[${formatTime(parsedLines[currentIndex + 1].time)}] ${parsedLines[currentIndex + 1].text}` : "";
        }
    }
}

const lyricsPresenter = new LyricsPresenter();
export default lyricsPresenter;