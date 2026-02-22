class Song {
    type: string = 'Song';

    title: string;
    artist: string;
    features: string[];
    album: string;
    songID: string;

    progressSeconds: number;
    durationSeconds: number;

    albumArtRaw: Uint8Array

    isPlaying: Boolean
    songChanged: Boolean

    constructor() {
        this.title = "None";
        this.artist = "None";
        this.features = [""];
        this.album = "None";
        this.songID = "0";

        this.progressSeconds = 0;
        this.durationSeconds = 0;

        this.albumArtRaw = new Uint8Array();

        this.isPlaying = false;
        this.songChanged = false;
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
        let progressPercent = value / max;
        let maxUnderscores = 64;
        let maxDashes = 57;
        let maxVerticalBar = 144;
        let maxArrows = 57;

        let underscoreWidth = maxWidth / maxUnderscores;
        let dashWidth = maxWidth / maxDashes;
        let barWidth = maxWidth / maxVerticalBar;
        let arrowWidth = maxWidth / maxArrows;

        let maxWidthTrue = maxWidth - barWidth - (arrowWidth * 2);

        let maxDashCount = Math.floor(progressPercent * maxDashes);
        let maxUnderscoreCount = Math.floor((1 - progressPercent) * maxUnderscores);

        let dashCount = Math.floor(maxDashCount * (maxWidthTrue / maxWidth));
        let underscoreCount = Math.floor(maxUnderscoreCount * (maxWidthTrue / maxWidth));
        while ((dashCount * dashWidth) + (underscoreCount * underscoreWidth) > maxWidthTrue) {
            dashCount -= 1;
        }
        return "<" + "-".repeat(dashCount) + "|" + "_".repeat(underscoreCount) + ">";
    }
}

let song_placeholder = new Song();
song_placeholder.addTitle("No Song Found");
song_placeholder.addArtist("");
song_placeholder.addFeatures([""]);
song_placeholder.addAlbum("");
song_placeholder.addID("0");
song_placeholder.addProgressSeconds(0);
song_placeholder.addDurationSeconds(60);
song_placeholder.addArtRaw(new Uint8Array());
song_placeholder.addisPlaying(false);
song_placeholder.addChangedState(false);

export { song_placeholder };
export default Song;