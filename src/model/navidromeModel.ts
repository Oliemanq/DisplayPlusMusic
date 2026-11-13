import Song, { song_placeholder } from './songModel';
import { downloadImageAsGrayscalePng, downloadImage } from './imageModel';
import { storage } from '../utils/storage';
import playbackOffsetModel from './playbackOffsetModel';

function clampProgress(seconds: number, durationSeconds: number): number {
  const clamped = durationSeconds > 0 ? Math.min(seconds, durationSeconds) : seconds;
  return Math.max(0, clamped);
}

type NavidromeNowPlayingEntry = {
  id?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumId?: string;
  artistId?: string;
  albumArtistId?: string;
  coverArt?: string;
  duration?: number;
  positionMs?: number;
  playbackRate?: number;
  state?: string;
  username?: string;
  playerName?: string;
  // Non-Subsonic extras a server may add to advertise remote control of a player.
  // A stock Navidrome omits them, which keeps transport control disabled there.
  sessionId?: string;
  canControl?: boolean;
};

export type NavidromePlaybackClient = {
  clientName: string;
  title: string;
  artist: string;
  songID: string;
  isPlaying: boolean;
};

type SubsonicResponse = {
  'subsonic-response'?: {
    status?: string;
    error?: { message?: string };
    nowPlaying?: {
      entry?: NavidromeNowPlayingEntry | NavidromeNowPlayingEntry[];
    };
  };
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

function normalizeClientName(entry: NavidromeNowPlayingEntry): string {
  return entry.playerName?.trim() || entry.username?.trim() || 'Unknown client';
}

function toClientSummary(entry: NavidromeNowPlayingEntry): NavidromePlaybackClient {
  const playbackState = entry.state ?? 'playing';
  return {
    clientName: normalizeClientName(entry),
    title: entry.title ?? 'Unknown Title',
    artist: entry.artist ?? 'Unknown Artist',
    songID: entry.id ?? entry.coverArt ?? '0',
    isPlaying: playbackState !== 'paused' && playbackState !== 'stopped',
  };
}

class NavidromeModel {
  private baseUrl = '';
  private username = '';
  private password = '';
  currentSong = new Song();
  private lastSnapshotAt = 0;
  private lastSnapshotSongID = '0';
  private lastSnapshotProgressSeconds = 0;
  private lastSnapshotIsPlaying = false;
  private selectedClientName = '';
  private playbackClients: NavidromePlaybackClient[] = [];
  private DRIFT_THRESHOLD = 0.1; // Seconds
  // Transport control is a per-player capability advertised by the server, not a
  // global one: a Jellyfin desktop client can be driven, its Android app cannot.
  private selectedSessionId = '';
  private selectedCanControl = false;

  async init(): Promise<boolean> {
    this.baseUrl = normalizeBaseUrl((await storage.getItem('navidrome_base_url')) ?? '');
    this.username = (await storage.getItem('navidrome_username')) ?? '';
    this.password = (await storage.getItem('navidrome_password')) ?? '';
    this.selectedClientName = (await storage.getItem('navidrome_selected_client')) ?? '';

    const isConfigured = Boolean(this.baseUrl && this.username && this.password);
    const popup = document.getElementById('spotify-auth-popup');
    if (popup) {
      popup.style.display = isConfigured ? 'none' : 'flex';
    }

    return isConfigured;
  }

  private async authQueryParams(): Promise<URLSearchParams> {
    return new URLSearchParams({
      u: this.username,
      p: this.password,
      v: '1.16.1',
      c: 'evenhub',
      f: 'json',
    });
  }

  private async getNowPlayingData(): Promise<NavidromeNowPlayingEntry[]> {
    if (!this.baseUrl || !this.username || !this.password) {
      return [];
    }

    const params = await this.authQueryParams();
    const response = await fetch(`${this.baseUrl}/rest/getNowPlaying.view?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Navidrome now playing request failed: ${response.status}`);
    }

    const data = (await response.json()) as SubsonicResponse;
    const subsonic = data['subsonic-response'];
    if (!subsonic || subsonic.status !== 'ok') {
      throw new Error(subsonic?.error?.message || 'Failed to fetch Navidrome now playing data');
    }

    const entries = subsonic.nowPlaying?.entry;
    if (!entries) {
      return [];
    }

    return Array.isArray(entries) ? entries : [entries];
  }

  getPlaybackClients(): NavidromePlaybackClient[] {
    return this.playbackClients;
  }

  getSelectedPlaybackClient(): string {
    return this.selectedClientName;
  }

  async setSelectedPlaybackClient(clientName: string): Promise<void> {
    this.selectedClientName = clientName;
    await storage.setItem('navidrome_selected_client', clientName);
  }

  async fetchCurrentTrack(): Promise<Song> {
    try {
      const entries = await this.getNowPlayingData();
      
      // Always update the client list
      this.playbackClients = entries.map(toClientSummary);

      if (entries.length === 0) {
        // Keep the last player's controls while its song is still shown: a paused
        // session can briefly drop out of getNowPlaying, and "play" is exactly what
        // the user wants then.
        if (this.currentSong.songID === '0') {
          this.selectedCanControl = false;
          this.selectedSessionId = '';
        }
        if (this.currentSong.songID !== '0') {
          this.currentSong.addisPlaying(false);
        }
        return this.currentSong.songID === '0' ? song_placeholder : this.currentSong;
      }

      const selectedEntry = entries.find(entry => normalizeClientName(entry) === this.selectedClientName)
        ?? entries[0];

      this.selectedSessionId = selectedEntry.sessionId ?? '';
      this.selectedCanControl = selectedEntry.canControl === true && this.selectedSessionId !== '';

      const selectedClientName = normalizeClientName(selectedEntry);
      if (selectedClientName !== this.selectedClientName) {
        this.selectedClientName = selectedClientName;
        await storage.setItem('navidrome_selected_client', selectedClientName);
      }

      const song = new Song();
      song.addID(selectedEntry.id ?? selectedEntry.coverArt ?? '0');
      song.addTitle(selectedEntry.title ?? 'Unknown Title');
      song.addArtist(selectedEntry.artist ?? 'Unknown Artist');
      song.addFeatures([]);
      song.addAlbum(selectedEntry.album ?? 'Unknown Album');
      song.addDurationSeconds(selectedEntry.duration ?? 0);
      
      const now = performance.now();
      const playbackState = selectedEntry.state ?? 'playing';
      const isPlaying = playbackState !== 'paused' && playbackState !== 'stopped';
      
      const sameTrack = song.songID === this.lastSnapshotSongID && this.lastSnapshotSongID !== '0';
      const serverProgress = (selectedEntry.positionMs ?? 0) / 1000;
      
      let progressSeconds = serverProgress;

      const playbackStateChanged = isPlaying !== this.lastSnapshotIsPlaying;

      if (sameTrack && this.lastSnapshotAt > 0 && !playbackStateChanged && isPlaying) {
        // Same track, playing, and no state change: interpolate locally
        const elapsedSeconds = (now - this.lastSnapshotAt) / 1000;
        const localProgress = this.lastSnapshotProgressSeconds + elapsedSeconds;
        const drift = Math.abs(serverProgress - localProgress);

        if (drift > this.DRIFT_THRESHOLD) {
          console.log(`[Navidrome] Significant drift detected. Correcting (local: ${localProgress.toFixed(2)}s, server: ${serverProgress.toFixed(2)}s)`);
          progressSeconds = serverProgress;
        } else {
          progressSeconds = localProgress;
        }
      } else {
        // New track, paused, or state change: use serverProgress as authority
        progressSeconds = serverProgress;
      }

      if (song.durationSeconds > 0) {
        progressSeconds = Math.min(progressSeconds, song.durationSeconds);
      }

      const displayProgressSeconds = clampProgress(progressSeconds + playbackOffsetModel.getOffsetSeconds(), song.durationSeconds);

      song.addProgressSeconds(displayProgressSeconds);
      song.addisPlaying(isPlaying);
      song.addChangedState(song.songID !== this.currentSong.songID);

      if (!sameTrack) {
        this.currentSong = song;
        const coverArtId = selectedEntry.coverArt ?? selectedEntry.albumId ?? selectedEntry.id ?? '';
        if (coverArtId) {
          this.fetchArtAsync(coverArtId, this.currentSong).catch(console.error);
        }
      } else {
        this.currentSong.addTitle(song.title);
        this.currentSong.addArtist(song.artist);
        this.currentSong.addFeatures(song.features);
        this.currentSong.addAlbum(song.album);
        this.currentSong.addDurationSeconds(song.durationSeconds);
        this.currentSong.addProgressSeconds(displayProgressSeconds);
        this.currentSong.addisPlaying(isPlaying);
        this.currentSong.addChangedState(false);
      }

      this.lastSnapshotAt = now;
      this.lastSnapshotSongID = song.songID;
      this.lastSnapshotProgressSeconds = progressSeconds;
      this.lastSnapshotIsPlaying = isPlaying;

      return this.currentSong;
    } catch (error) {
      console.error('[Navidrome] fetchCurrentTrack failed:', error);
      // If error occurred, don't clear the current song if we already have one,
      // but maybe reset playback state if it was a catastrophic error.
      return this.currentSong.songID === '0' ? song_placeholder : this.currentSong;
    }
  }

  async fetchNextTrack(): Promise<Song | undefined> {
    return undefined;
  }

  supportsControl(): boolean {
    return this.selectedCanControl;
  }

  /**
   * Subsonic has no transport verbs, so control rides a small side API the server may
   * expose at /control/<command>. Same credentials, plain GET (no CORS preflight).
   * A server that doesn't implement it never advertises `canControl`, so this is
   * never reached against a stock Navidrome.
   */
  private async sendControl(command: string): Promise<void> {
    if (!this.selectedCanControl) {
      console.log(`[Navidrome] ${command} ignored — the selected player is not remote-controllable.`);
      return;
    }
    // Control calls are queued one after another, so a request that never answers
    // must not block every later button press.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 5000);
    try {
      const params = await this.authQueryParams();
      params.set('session', this.selectedSessionId);
      const response = await fetch(`${this.baseUrl}/control/${command}?${params.toString()}`, { signal: abort.signal });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        console.error(`[Navidrome] ${command} failed: ${body?.error ?? response.status}`);
        return;
      }
      // Optimistic local flip so the lens reacts before the next poll corrects it.
      if (command === 'pause') this.currentSong.addisPlaying(false);
      if (command === 'play') this.currentSong.addisPlaying(true);
    } catch (error) {
      console.error(`[Navidrome] ${command} failed:`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  async song_Pause() {
    await this.sendControl('pause');
  }

  async song_Play() {
    await this.sendControl('play');
  }

  async song_Back() {
    await this.sendControl('previous');
  }

  async song_Forward() {
    await this.sendControl('next');
  }

  private async fetchArtAsync(coverArtId: string, song: Song): Promise<void> {
    try {
      if (!coverArtId) return;

      const url = `${this.baseUrl}/rest/getCoverArt.view?${new URLSearchParams({
        id: coverArtId,
        u: this.username,
        p: this.password,
        v: '1.16.1',
        c: 'evenhub',
      }).toString()}`;

      const [raw, color] = await Promise.all([
        downloadImageAsGrayscalePng(url, 144, 144),
        downloadImage(url, 120, 120),
      ]);

      if (this.currentSong === song) {
        song.addArtRaw(raw);
        song.addArtColor(color);
        console.log(`[Navidrome] Art ready for: ${song.title}`);
      }
    } catch (error) {
      console.error('[Navidrome] Art fetch failed:', error);
    }
  }
}

const navidromeModel = new NavidromeModel();
export default navidromeModel;
