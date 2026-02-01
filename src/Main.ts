import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import SpotifyPresenter from './presenter/spotifyPresenter';

console.log("Setting keys");
const clientID = ''
const clientSecret = ''

const spotifyPresenter = new SpotifyPresenter();

spotifyPresenter.SPOTIFY_KEYS.setKeys(clientID, clientSecret);

spotifyPresenter.fetchCurrentTrack();