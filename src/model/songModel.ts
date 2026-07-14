import placeholderArtUrl from '../Assets/placeholder_art.jpg';
import { downloadImageAsGrayscalePng, downloadImage, uint8ArrayToBase64 } from "./imageModel";


class Song {
    type: string = 'Song';

    title: string;
    artist: string;
    features: string[];
    album: string;
    songID: string;

    progressSeconds: number;
    durationSeconds: number;

    albumArtRaw: Uint8Array;
    albumArtColor: Uint8Array;

    isPlaying: Boolean
    songChanged: Boolean = false;

    constructor() {
        this.title = "None";
        this.artist = "None";
        this.features = [""];
        this.album = "None";
        this.songID = "0";

        this.progressSeconds = 0;
        this.durationSeconds = 0;

        this.albumArtRaw = new Uint8Array();
        this.albumArtColor = new Uint8Array();

        this.isPlaying = false;
    }
    addTitle(newTitle: string) {
        this.title = newTitle;
    }
    addArtist(newArtist: string) {
        this.artist = newArtist;
    }
    addFeatures(newFeatures: string[]) {
        this.features = newFeatures;
    }
    addAlbum(newAlbum: string) {
        this.album = newAlbum;
    }
    addID(newID: string) {
        this.songID = newID;
    }

    addProgressSeconds(newProgressSeconds: number) {
        this.progressSeconds = newProgressSeconds;
    }
    addDurationSeconds(newDurationSeconds: number) {
        this.durationSeconds = newDurationSeconds;
    }
    addArtRaw(newArt: Uint8Array) {
        this.albumArtRaw = newArt;
    }
    addArtColor(newArt: Uint8Array) {
        this.albumArtColor = newArt;
    }
    addisPlaying(newState: Boolean) {
        this.isPlaying = newState;
    }
    toggleisPlaying() {
        this.isPlaying = !this.isPlaying
    }
    addChangedState(newState: Boolean) {
        this.songChanged = newState;
    }
    toggleSongChanged() {
        this.songChanged = !this.songChanged
    }
    createPlaybackBar(maxWidth: number): string {
        let value = this.progressSeconds;
        let max = this.durationSeconds;

        let progressPercent = 0;
        if (max > 0) {
            progressPercent = value / max;
            if (isNaN(progressPercent) || !isFinite(progressPercent)) {
                progressPercent = 0;
            }
            progressPercent = Math.max(0, Math.min(1, progressPercent));
        }

        let maxUnderscores = 64;
        let maxDashes = 57;
        let maxVerticalBar = 144;
        let maxArrows = 57;
        let maxBrackets = 82;

        let underscoreWidth = maxWidth / maxUnderscores;
        let dashWidth = maxWidth / maxDashes;
        let barWidth = maxWidth / maxVerticalBar;
        let bracketsWidth = maxWidth / maxBrackets;

        let maxWidthTrue = maxWidth - (bracketsWidth * 2) - (this.isPlaying ? 0 : barWidth * 3);

        let maxDashCount = Math.floor(progressPercent * maxDashes);
        let maxUnderscoreCount = Math.floor((1 - progressPercent) * maxUnderscores);

        let dashCount = Math.floor(maxDashCount * (maxWidthTrue / maxWidth));
        let underscoreCount = Math.floor(maxUnderscoreCount * (maxWidthTrue / maxWidth));
        while ((dashCount * dashWidth) + (underscoreCount * underscoreWidth) > maxWidthTrue && dashCount > 0) {
            dashCount -= 1;
        }

        dashCount = Math.max(0, dashCount);
        underscoreCount = Math.max(0, underscoreCount);

        return (this.isPlaying ? "" : "|| ") + "[" + "-".repeat(dashCount) + "|" + "_".repeat(underscoreCount) + "]";
    }
}

let song_placeholder = new Song();
song_placeholder.addTitle("");
song_placeholder.addArtist("No Song Found");
song_placeholder.addFeatures([""]);
song_placeholder.addAlbum(" ");
song_placeholder.addID("0");
song_placeholder.addProgressSeconds(30);
song_placeholder.addDurationSeconds(60);
// song_placeholder.addArtRaw(await downloadImageAsGrayscalePng(placeholderArtUrl, 144, 144));
// song_placeholder.addArtColor(await downloadImage(placeholderArtUrl, 144, 144));
song_placeholder.addisPlaying(false);
song_placeholder.addChangedState(false);

function setPlaceholderLoginHint(showLoginHint: boolean) {
    if (showLoginHint) {
        song_placeholder.addTitle("No song found");
        song_placeholder.addArtist("   Please log in via");
        song_placeholder.addAlbum("   the Even App");
    } else {
        song_placeholder.addArtist("No song found");
    }
}

export { song_placeholder };
export { setPlaceholderLoginHint };
export default Song;