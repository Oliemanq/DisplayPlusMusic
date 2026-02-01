const SpotifyWebApi = require('spotify-web-api-node');
const fs = require('fs');
const { pipeline } = require('stream/promises'); // For saving files efficiently
const { saveAlbumArtBMP } = require('./Convert_Art_To_BMP');
const keys = require('./Spotify_API_Keys');


var spotifyApi = keys.getSpotifyApiInstance();
const ALBUM_ART_PATH = ('./current_album_art.jpg');
let lastTrackId = ''; // To prevent re-downloading the same image

async function saveAlbumArt() {
  try {
    spotifyApi = keys.getSpotifyApiInstance(); //Get updated keys before trying anything

    const data = await spotifyApi.refreshAccessToken();
    spotifyApi.setAccessToken(data.body['access_token']);

    const playbackState = await spotifyApi.getMyCurrentPlaybackState();

    if (playbackState.body && playbackState.body.is_playing && playbackState.body.item) {
      const item = playbackState.body.item;

      if (item.id === lastTrackId) { // Do nothing if the song hasn't changed
        return; 
      }

      console.log(`New Track Detected: ${item.name}`);
      lastTrackId = item.id;

      const images = item.album.images;
      
      if (images.length > 0) {
        const imageUrl = images[0].url;
        console.log(`Downloading art from: ${imageUrl}`);
        
        await downloadImage(imageUrl, ALBUM_ART_PATH);
        console.log("Album art saved! Saving BMP version...");
        saveAlbumArtBMP()
      }

    } else {
      console.log("Not playing or unknown media.");
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

// Helper function to download the file
async function downloadImage(url, filepath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  
  // Create a write stream to save the file
  const fileStream = fs.createWriteStream(filepath);
  
  // Pipe the web response into the file
  await pipeline(response.body, fileStream);
}

module.exports = { saveAlbumArt };