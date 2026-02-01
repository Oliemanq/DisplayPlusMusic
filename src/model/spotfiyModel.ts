import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";



class spotifyModel {
    REDIRECT_URI = 'http://127.0.0.1:8888/callback'
    PORT = 8888;
    SCOPE = 'user-modify-playback-state user-read-playback-state';

    private USER_CLIENTID = "";
    private USER_CLIENTSECRET = "";

    public spotifysdk: SpotifyApi;

    constructor() {
        this.fetchKeys()

        this.spotifysdk = SpotifyApi.withUserAuthorization(this.USER_CLIENTID, this.USER_CLIENTSECRET, [
            "user-read-currently-playing", 
            "user-read-playback-state"
        ]);
    }


    //Functions for client ID and secret management
    async fetchKeys() {
        const bridge = await waitForEvenAppBridge();

        this.USER_CLIENTID = await bridge.getLocalStorage('spotify-clientid');
        this.USER_CLIENTSECRET =  await bridge.getLocalStorage('spotify-clientsecret');
    }
    async updatedKey() {
        const bridge = await waitForEvenAppBridge();

        bridge.setLocalStorage('spotify-clientid', this.USER_CLIENTID);
        bridge.setLocalStorage('spotify-clientsecret', this.USER_CLIENTSECRET);
    }
    setKeys(clientID: string, clientSecret: string) {
        this.USER_CLIENTID = clientID;
        this.USER_CLIENTSECRET = clientSecret;
        this.updatedKey();
    }
    setClientID(clientID: string) {
        this.USER_CLIENTID = clientID;
        this.updatedKey();
    }
    setClientSecret(clientSecret: string) {
        this.USER_CLIENTSECRET;
        this.updatedKey();
    }
}

export default spotifyModel;