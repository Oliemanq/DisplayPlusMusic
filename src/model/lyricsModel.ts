import Song from './songModel';

async function fetchLyrics(song: Song) {
    if (!song.title || song.title === "None") return null;

    const url = new URL("https://lrclib.net/api/get");
    url.searchParams.append("track_name", song.title);
    url.searchParams.append("artist_name", song.artist);
    if (song.album && song.album !== "None") {
        url.searchParams.append("album_name", song.album);
    }
    if (song.durationSeconds > 0) {
        url.searchParams.append("duration", Math.round(song.durationSeconds).toString());
    }

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            console.log(`Lyrics not found for ${song.title} (${response.status})`);
            return null;
        }

        const data = await response.json();
        console.log("Lyrics fetched successfully:", data.syncedLyrics ? "Has synced lyrics" : "Plain lyrics only");
        console.log("raw data: " + JSON.stringify(data));

        return {
            plainLyrics: data.plainLyrics,
            syncedLyrics: data.syncedLyrics
        };
    } catch (e) {
        console.error("Failed to fetch lyrics:", e);
        return null;
    }
}

export { fetchLyrics };