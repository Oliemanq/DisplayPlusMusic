import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk"; //Needed for local storage

class spotifyModel {
    REDIRECT_URI = 'http://127.0.0.1:5173/'
    PORT = 5173;
    SCOPE = ['user-modify-playback-state', 'user-read-playback-state'];

    USER_CLIENTID = "";
    USER_CLIENTSECRET = "";

    constructor() {
        this.fetchKeysFromStorage()
    }


    //Functions for client ID and secret management
    async fetchKeysFromStorage() {
        const bridge = await waitForEvenAppBridge();

        this.USER_CLIENTID = await bridge.getLocalStorage('spotify-clientid');
        this.USER_CLIENTSECRET =  await bridge.getLocalStorage('spotify-clientsecret');
    }
    async updateKeysInStorage() {
        const bridge = await waitForEvenAppBridge();

        bridge.setLocalStorage('spotify-clientid', this.USER_CLIENTID);
        bridge.setLocalStorage('spotify-clientsecret', this.USER_CLIENTSECRET);

        console.log("stored clientid " + this.USER_CLIENTID)
        console.log("localstorage clientid " + await bridge.getLocalStorage('spotify-clientid'))
    }
    setKeys(clientID: string, clientSecret: string) {
        this.USER_CLIENTID = clientID;
        this.USER_CLIENTSECRET = clientSecret;
        this.updateKeysInStorage();
    }
    setClientID(clientID: string) {
        this.USER_CLIENTID = clientID;
        this.updateKeysInStorage();
    }
    setClientSecret(clientSecret: string) {
        this.USER_CLIENTSECRET = clientSecret;
        this.updateKeysInStorage();
    }

    getKeys() {
        return (this.USER_CLIENTID + "\n" + this.USER_CLIENTSECRET);
    }
}

const SPOTIFY_KEYS = new spotifyModel();
export default SPOTIFY_KEYS;