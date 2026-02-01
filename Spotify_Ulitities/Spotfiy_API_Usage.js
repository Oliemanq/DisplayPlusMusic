// media-interface.js
const SpotifyWebApi = require('spotify-web-api-node');
const keys = require('./Spotify_API_Keys');
const { saveAlbumArt } = require('./Fetch_Album_Art');

var spotifyApi = keys.getSpotifyApiInstance();

async function getNowPlaying() {
  try {
    spotifyApi = keys.getSpotifyApiInstance(); //Get updated keys before trying anything
    console.log("Spotify keys");
    console.log(spotifyApi.getClientId());
    console.log(spotifyApi.getClientSecret());
    console.log(spotifyApi.getRefreshToken());

    // 1. Refresh the Access Token (Auto-handles expiration)
    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);

    // 2. Get the Playback State
    const playbackState = await spotifyApi.getMyCurrentPlaybackState();

    // 3. Handle different states (Ad, Not Playing, Podcast, Song)
    if (playbackState.body && playbackState.body.is_playing) {
      
      const item = playbackState.body.item;
      
      if (!item) {
         console.log("Playing, but likely an Ad or unknown media type.");
         return;
      }

      const trackName = item.name;
      const artistName = item.artists.map(artist => artist.name).join(', ');
      const progressMs = playbackState.body.progress_ms;
      const durationMs = item.duration_ms;
      saveAlbumArt();

      
      console.log(`🎵 Now Playing: ${trackName} by ${artistName}`);
      console.log(`⏳ Progress: ${Math.floor(progressMs / 1000)}s / ${Math.floor(durationMs / 1000)}s`);
      
    } else {
      console.log("⏸️  User is currently paused or offline.");
    }

  } catch (error) {
    console.error("Error retrieving playback:", error);
  }
}

module.exports = { getNowPlaying };