import { storage } from '../utils/storage';

const STORAGE_KEY = 'playback_offset_ms';
export const OFFSET_STEP_MS = 50;

/**
 * Manual playback offset (in ms) applied on top of whatever progress a music
 * source reports, so the user can nudge lyric/display sync forward or back
 * if it drifts (e.g. due to Bluetooth latency). Works for both Spotify and
 * Navidrome since both consume this before exposing progressSeconds on Song.
 */
class PlaybackOffsetModel {
    private offsetMs = 0;
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = (async () => {
                try {
                    const stored = await storage.getItem(STORAGE_KEY);
                    const parsed = stored !== null ? parseInt(stored, 10) : 0;
                    this.offsetMs = Number.isFinite(parsed) ? parsed : 0;
                } catch (e) {
                    console.error('[PlaybackOffsetModel] Failed to load offset:', e);
                } finally {
                    this.initialized = true;
                }
            })();
        }
        return this.initPromise;
    }

    getOffsetMs(): number {
        return this.offsetMs;
    }

    getOffsetSeconds(): number {
        return this.offsetMs / 1000;
    }

    async adjust(deltaMs: number): Promise<number> {
        this.offsetMs += deltaMs;
        try {
            await storage.setItem(STORAGE_KEY, String(this.offsetMs));
        } catch (e) {
            console.error('[PlaybackOffsetModel] Failed to persist offset:', e);
        }
        return this.offsetMs;
    }

    async set(ms: number): Promise<number> {
        this.offsetMs = ms;
        try {
            await storage.setItem(STORAGE_KEY, String(this.offsetMs));
        } catch (e) {
            console.error('[PlaybackOffsetModel] Failed to persist offset:', e);
        }
        return this.offsetMs;
    }
}

const playbackOffsetModel = new PlaybackOffsetModel();
export default playbackOffsetModel;
