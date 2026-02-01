class Song {
    type: string = 'Song';

    title: string;
    artist: string;
    features: string[];
    album: string;

    constructor() {
        this.title = "None";
        this.artist = "None";
        this.features = [""];
        this.album = "None";
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
}

export default Song;