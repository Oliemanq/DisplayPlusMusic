import spotifyPresenter from './spotifyPresenter';
import { storage } from '../utils/storage';
import spotifyAuthModel from '../model/spotifyAuthModel';
import Song from '../model/songModel';
import { formatTime } from '../Scripts/formatTime';

class ViewPresenter {
    private lastSongID: string = ""
    private lastBlobUrl?: string;

    constructor() { }

    initListeners() {
        // Media Controls
        document.getElementById('skip-track')?.addEventListener('click', () => {
            this.forwardTrack();
        });
        document.getElementById('play-pause')?.addEventListener('click', () => {
            this.playPauseTrack();
        });
        document.getElementById('previous-track')?.addEventListener('click', () => {
            this.backTrack();
        });

        // Auth Controls
        document.getElementById('save-auth')?.addEventListener('click', async () => {
            this.saveAndAuthorize();
        });
        document.getElementById('clear-local-refresh-token')?.addEventListener('click', async () => {
            this.clearLocalStorage();
        });

        // Load saved auth data into inputs
        storage.getItem('spotify_client_id').then(val => {
            const clientIdInput = document.getElementById('client-id') as HTMLInputElement;
            if (clientIdInput && val) {
                clientIdInput.value = val;
            }
        });
        storage.getItem('spotify_client_secret').then(val => {
            const clientSecretInput = document.getElementById('client-secret') as HTMLInputElement;
            if (clientSecretInput && val) {
                clientSecretInput.value = val;
            }
        });

        // Make popup links copyable
        document.querySelectorAll('.popup-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                const target = e.target as HTMLElement;
                const textToCopy = target.innerText.trim();
                const originalText = textToCopy;

                try {
                    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
                        await navigator.clipboard.writeText(textToCopy);
                    } else {
                        // Fallback for HTTP / non-secure contexts
                        const textArea = document.createElement("textarea");
                        textArea.value = textToCopy;
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                    }

                    target.innerText = "Copied!";
                    setTimeout(() => {
                        target.innerText = originalText;
                    }, 1000);
                } catch (err) {
                    console.error('Failed to copy', err);
                }
            });
        });
    }

    forwardTrack() {
        spotifyPresenter.song_forward();
    }
    playPauseTrack() {
        spotifyPresenter.song_pauseplay();
    }
    backTrack() {
        spotifyPresenter.song_back();
    }

    async saveAndAuthorize() {
        const clientId = (document.getElementById('client-id') as HTMLInputElement).value.trim();
        const clientSecret = (document.getElementById('client-secret') as HTMLInputElement).value.trim();

        if (!clientId || !clientSecret) {
            alert("Please provide both Client ID and Client Secret.");
            return;
        }

        await storage.setItem('spotify_client_id', clientId);
        await storage.setItem('spotify_client_secret', clientSecret);

        await spotifyAuthModel.generateAuthUrl(clientId);
    }

    async clearLocalStorage() {
        console.log("Started clear");
        await storage.removeItem('spotify_refresh_token');
        await storage.removeItem('spotify_access_token');
        await storage.removeItem('spotify_client_id');
        await storage.removeItem('spotify_client_secret');
        await storage.removeItem('spotify_auth_state');
        console.log("Spotify session cleared!");
        window.location.reload();
    }

    async updateHTML(song: Song) {
        try {
            const setText = (id: string, val: string) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };
            setText('song-name', song.title);
            setText('song-artist', song.artist);
            setText('song-album', song.album);
            setText('song-current-time', formatTime(song.progressSeconds));
            setText('song-total-time', formatTime(song.durationSeconds));

            if (song.songID !== this.lastSongID) {
                const imgElement = document.getElementById('album-art') as HTMLImageElement;
                if (imgElement && song.albumArtColor?.length > 0) {
                    if (this.lastBlobUrl) URL.revokeObjectURL(this.lastBlobUrl);
                    const blob = new Blob([song.albumArtColor] as BlobPart[], { type: 'image/png' });
                    this.lastBlobUrl = URL.createObjectURL(blob);
                    imgElement.src = this.lastBlobUrl;
                }
                this.lastSongID = song.songID;
            }
        } catch (e) {
            console.error("[viewPresenter] updateHTML threw:", e);
        }
    }
}

const viewPresenter = new ViewPresenter();
export default viewPresenter;