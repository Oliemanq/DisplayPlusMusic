import spotifyPresenter from './spotifyPresenter';
import navidromeModel from '../model/navidromeModel';
import { storage } from '../utils/storage';
import spotifyAuthModel from '../model/spotifyAuthModel';
import Song from '../model/songModel';
import { formatTime } from '../Scripts/formatTime';
import playbackOffsetModel, { OFFSET_STEP_MS } from '../model/playbackOffsetModel';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

class ViewPresenter {
    private lastSongID: string = ""
    private lastBlobUrl?: string;

    constructor() { }

    initListeners() {
        const sourceSelect = document.getElementById('music-source') as HTMLSelectElement | null;
        const spotifyFields = document.getElementById('spotify-auth-fields');
        const navidromeFields = document.getElementById('navidrome-auth-fields');
        const clientList = document.getElementById('navidrome-client-list');
        const miniButtons = document.getElementById('mini-buttons-container');

        const toggleAuthFields = () => {
            const source = sourceSelect?.value || 'spotify';
            if (spotifyFields) spotifyFields.style.display = source === 'spotify' ? 'flex' : 'none';
            if (navidromeFields) navidromeFields.style.display = source === 'navidrome' ? 'flex' : 'none';
            const clientPicker = document.getElementById('navidrome-client-picker');
            if (clientPicker) clientPicker.style.display = source === 'navidrome' ? 'flex' : 'none';
            if (miniButtons) miniButtons.style.display = source === 'navidrome' ? 'none' : 'flex';
        };

        sourceSelect?.addEventListener('change', toggleAuthFields);

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

        document.getElementById('offset-decrease')?.addEventListener('click', () => {
            this.adjustPlaybackOffset(-OFFSET_STEP_MS);
        });
        document.getElementById('offset-increase')?.addEventListener('click', () => {
            this.adjustPlaybackOffset(OFFSET_STEP_MS);
        });
        document.getElementById('playback-offset-value')?.addEventListener('click', () => {
            this.setPlaybackOffset(0);
        });

        playbackOffsetModel.init().then(() => this.renderPlaybackOffset());

        clientList?.addEventListener('click', async (event) => {
            const target = event.target as HTMLElement;
            const button = target.closest('button[data-client-name]') as HTMLButtonElement | null;
            const clientName = button?.dataset.clientName;
            if (!clientName) {
                return;
            }

            await spotifyPresenter.setNavidromeClient(clientName);
            this.renderNavidromeClients();
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
        storage.getItem('navidrome_base_url').then(val => {
            const input = document.getElementById('navidrome-base-url') as HTMLInputElement;
            if (input && val) {
                input.value = val;
            }
        });
        storage.getItem('navidrome_username').then(val => {
            const input = document.getElementById('navidrome-username') as HTMLInputElement;
            if (input && val) {
                input.value = val;
            }
        });
        storage.getItem('navidrome_password').then(val => {
            const input = document.getElementById('navidrome-password') as HTMLInputElement;
            if (input && val) {
                input.value = val;
            }
        });
        storage.getItem('music_source').then(val => {
            if (sourceSelect && val) {
                sourceSelect.value = val;
            }
            toggleAuthFields();
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

    async adjustPlaybackOffset(deltaMs: number) {
        await playbackOffsetModel.adjust(deltaMs);
        this.renderPlaybackOffset();
    }
    async setPlaybackOffset(ms: number) {
        await playbackOffsetModel.set(ms);
        this.renderPlaybackOffset();
    }

    renderPlaybackOffset() {
        const el = document.getElementById('playback-offset-value');
        if (!el) return;
        const offsetMs = playbackOffsetModel.getOffsetMs();
        el.textContent = `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`;
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
        const selectedSource = ((document.getElementById('music-source') as HTMLSelectElement | null)?.value || 'spotify') as 'spotify' | 'navidrome';
        await storage.setItem('music_source', selectedSource);

        if (selectedSource === 'navidrome') {
            const baseUrl = (document.getElementById('navidrome-base-url') as HTMLInputElement).value.trim();
            const username = (document.getElementById('navidrome-username') as HTMLInputElement).value.trim();
            const password = (document.getElementById('navidrome-password') as HTMLInputElement).value;

            if (!baseUrl || !username || !password) {
                alert('Please provide Navidrome server URL, username, and password.');
                return;
            }

            await storage.setItem('navidrome_base_url', baseUrl);
            await storage.setItem('navidrome_username', username);
            await storage.setItem('navidrome_password', password);

            window.location.reload();
            return;
        }

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
        await storage.removeItem('navidrome_base_url');
        await storage.removeItem('navidrome_username');
        await storage.removeItem('navidrome_password');
        await storage.removeItem('navidrome_selected_client');
        await storage.removeItem('music_source');
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
            setText('song-total-time', `${formatTime(song.durationSeconds)}`);
            this.renderNavidromeClients();

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

    renderNavidromeClients() {
        const picker = document.getElementById('navidrome-client-picker');
        const list = document.getElementById('navidrome-client-list');
        if (!picker || !list) {
            return;
        }

        const isNavidrome = spotifyPresenter.getActiveSource() === 'navidrome';
        picker.style.display = isNavidrome ? 'flex' : 'none';
        if (!isNavidrome) {
            list.innerHTML = '';
            return;
        }

        const clients = navidromeModel.getPlaybackClients();
        const selectedClient = navidromeModel.getSelectedPlaybackClient();

        if (clients.length === 0) {
            list.innerHTML = '<p class="navidrome-client-empty">No active Navidrome clients found.</p>';
            return;
        }

        list.innerHTML = clients.map(client => {
            const isSelected = client.clientName === selectedClient;
            return `
                <button class="navidrome-client-card ${isSelected ? 'selected' : ''}" data-client-name="${escapeHtml(client.clientName)}">
                    <span class="navidrome-client-name">${escapeHtml(client.clientName)}</span>
                    <span class="navidrome-client-track">${escapeHtml(client.title)}</span>
                    <span class="navidrome-client-artist">${escapeHtml(client.artist)}</span>
                </button>
            `;
        }).join('');
    }
}

const viewPresenter = new ViewPresenter();
export default viewPresenter;
