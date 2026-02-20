import { fetchLyrics } from "../model/lyricsModel";
import Song from "../model/songModel";
import spotifyPresenter from "./spotifyPresenter";

class LyricsPresenter {
    currentTrackLyrics: string = "";
    currentTrackSyncedLyrics: string = "";

    currentLine: string = "";
    nextLine: string = "";

    async updateLyrics(song: Song) {
        let lyrics = await fetchLyrics(song);
        if (lyrics) {
            this.currentTrackLyrics = lyrics.plainLyrics;
            this.currentTrackSyncedLyrics = lyrics.syncedLyrics;
        }
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
                    text: match[3].trim()
                });
            }
        }

        const progress = spotifyPresenter.currentSong.progressSeconds;
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
            this.nextLine = parsedLines.length > 0 ? parsedLines[0].text : "";
        } else {
            this.currentLine = parsedLines[currentIndex].text;
            this.nextLine = currentIndex + 1 < parsedLines.length ? parsedLines[currentIndex + 1].text : "";
        }
    }
}

const lyricsPresenter = new LyricsPresenter();
export default lyricsPresenter;