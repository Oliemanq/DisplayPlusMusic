import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import SpotifyPresenter from './presenter/spotifyPresenter';

console.log("Setting keys");
const clientID = '29a961338df9480db3c1b50e10df184f'
const clientSecret = 'af3da2d50cf44657842880cb5997f762'

const spotifyPresenter = new SpotifyPresenter();

spotifyPresenter.SPOTIFY_KEYS.setKeys(clientID, clientSecret);

spotifyPresenter.fetchCurrentTrack();