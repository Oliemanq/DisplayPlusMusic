class Song {
    type: string = 'Song';

    title: string;
    artist: string;
    features: string[];
    album: string;
    songID: string;

    progressSeconds: number;
    durationSeconds: number;

    albumArt: Blob
    albumArtBase64: string
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

        this.albumArt = new Blob();
        this.albumArtBase64 = '';
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
    addArt(newArt: Blob) {
        this.albumArt = newArt;
    }
    addArtBase64(newArtBase64: string) {
        this.albumArtBase64 = newArtBase64;
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
}

export default Song;