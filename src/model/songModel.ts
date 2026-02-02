class Song {
    type: string = 'Song';

    title: string;
    artist: string;
    features: string[];
    album: string;
    songID: string;

    constructor() {
        this.title = "None";
        this.artist = "None";
        this.features = [""];
        this.album = "None";
        this.songID = "0";
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
}

export default Song;