import Song from './songModel';

async function fetchLyrics(song: Song) {
    const title = song.title.trim().toLowerCase();
    const artist = song.artist.trim().toLowerCase();

    if (
        song.songID === '0' ||
        title === '' ||
        title === 'no song found' ||
        artist.includes('please log in via')
    ) {
        return {
            plainLyrics: null,
            syncedLyrics: null
        }
    }

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
            return {
                plainLyrics: null,
                syncedLyrics: null
            };
        }

        const data = await response.json();
        console.log(`Lyrics fetched for ${song.title} successfully:`, data.syncedLyrics ? "Has synced lyrics" : "Plain lyrics only");

        return {
            plainLyrics: data.plainLyrics,
            syncedLyrics: data.syncedLyrics
        };
    } catch (e) {
        console.error("Failed to fetch lyrics:", e);
        return {
            plainLyrics: null,
            syncedLyrics: null
        };
    }
}

export { fetchLyrics };