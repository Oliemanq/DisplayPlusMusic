import {
    waitForEvenAppBridge,
    EvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    ImageContainerProperty,
    ImageRawDataUpdate,
    ImageRawDataUpdateResult,
    StartUpPageCreateResult,
    RebuildPageContainer,
    TextContainerUpgrade,
    ListContainerProperty,
    ListItemContainerProperty,
} from '@evenrealities/even_hub_sdk';

import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';
import lyricsPresenter from '../presenter/lyricsPresenter';
import spotifyPresenter from '../presenter/spotifyPresenter';

const MAX_HEIGHT = 288;
const MAX_WIDTH = 576;
const IMAGE_RETRY_DELAY_MS = 3000;

let bridge: EvenAppBridge | null = null;
let isPageCreated = false;
let isUpdating = false;
let isSendingImage = false;
let lastSongID = "";
let lastRenderedSource = '';
let imageRetryAt = 0;
// Last content actually confirmed sent to each container — lets us skip redundant
// bridge round-trips (a major source of glasses-side lyric latency) when nothing changed.
let lastSentSongInfoText = '';
let lastSentPlaybackBarText = '';

/** Resolves with fallback value if the promise times out or throws. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

/** Builds the container layout for the active source. Content fields are irrelevant for layout comparison. */
function buildContainerConfig(songInfoText: string, playbackBarText: string, showPlaybackButtons: boolean) {
    return {
        containerTotalNum: showPlaybackButtons ? 4 : 3,
        imageObject: [
            new ImageContainerProperty({
                xPosition: 2,
                yPosition: 2,
                width: 144,
                height: 144,
                containerID: 0,
                // zOrderIndex: 1,
                containerName: 'album-art',
            }),
        ],
        listObject: showPlaybackButtons ? [
            new ListContainerProperty({
                xPosition: 155,
                yPosition: 8,
                width: 80,
                height: 132,
                borderWidth: 0,
                borderRadius: 0,
                containerID: 2,
                containerName: 'buttons',
                // zOrderIndex: 1,
                isEventCapture: 1,
                itemContainer: new ListItemContainerProperty({
                    itemCount: 3,
                    itemName: ['◁◁', ' ▷ll', '▷▷'],
                    isItemSelectBorderEn: 1,
                }),
            }),
        ] : [],
        textObject: [
            new TextContainerProperty({
                xPosition: showPlaybackButtons ? 234 : 155,
                yPosition: 12,
                width: showPlaybackButtons ? MAX_WIDTH - 232 : MAX_WIDTH - 153,
                height: 132,
                borderRadius: 12,
                borderWidth: 1,
                paddingLength: 16,
                containerID: 3,
                containerName: 'songInfo',
                content: songInfoText,
                // zOrderIndex: 1,
                isEventCapture: 0,
            }),
            new TextContainerProperty({
                xPosition: 0,
                yPosition: 150,
                width: MAX_WIDTH,
                height: MAX_HEIGHT - 150,
                borderRadius: 6,
                borderWidth: 0,
                containerID: 4,
                containerName: 'playbackBar',
                content: playbackBarText,
                // zOrderIndex: 1,
                isEventCapture: showPlaybackButtons ? 0 : 1,
            }),
        ],
    };
}

/** Sends album art in the background — never blocks the text update path. */
async function sendImageAsync(song: Song): Promise<void> {
    if (isSendingImage || Date.now() < imageRetryAt) return;
    if (!song.albumArtRaw || song.albumArtRaw.length === 0 || song.songID === lastSongID) return;

    isSendingImage = true;
    try {
        const result = await withTimeout(
            bridge!.updateImageRawData(new ImageRawDataUpdate({
                containerID: 0,
                containerName: 'album-art',
                imageData: song.albumArtRaw,
            })),
            8000,
            ImageRawDataUpdateResult.sendFailed,
        );

        if (result === ImageRawDataUpdateResult.success) {
            lastSongID = song.songID;
            imageRetryAt = 0;
            console.log(`[GlassesView] Image sent for: ${song.title}`);
        } else {
            console.warn(`[GlassesView] Image sendFailed (${result}), retrying in ${IMAGE_RETRY_DELAY_MS}ms`);
            imageRetryAt = Date.now() + IMAGE_RETRY_DELAY_MS;
        }
    } catch (e) {
        console.error('[GlassesView] sendImageAsync error:', e);
        imageRetryAt = Date.now() + IMAGE_RETRY_DELAY_MS;
    } finally {
        isSendingImage = false;
    }
}

export async function createView(song: Song): Promise<void> {
    if (isUpdating) return;
    isUpdating = true;

    try {
        // Cache the bridge — waitForEvenAppBridge resolves instantly after first call
        if (!bridge) {
            bridge = await withTimeout(waitForEvenAppBridge(), 3000, null);
            if (!bridge) {
                console.warn('[GlassesView] Bridge unavailable, skipping frame');
                return;
            }
        }

        const songInfoText = `${song.title}\n${song.artist}\n${song.album}`;
        const playbackBarText = `${formatTime(song.progressSeconds)}               -${formatTime(Math.max(0, song.durationSeconds - song.progressSeconds))}\n` +`${song.createPlaybackBar(MAX_WIDTH)}\n` + `${lyricsPresenter.currentLineFormatted}\n` + `           ${lyricsPresenter.nextLine}`;

        const activeSource = spotifyPresenter.getActiveSource();
        const showPlaybackButtons = activeSource !== 'navidrome';
        // Only built when actually needed (create/rebuild paths) — constructing the full
        // container tree on every 10ms tick is pure overhead on the hot text-upgrade path.
        const buildConfig = () => buildContainerConfig(songInfoText, playbackBarText, showPlaybackButtons);

        if (lastRenderedSource !== activeSource) {
            lastRenderedSource = activeSource;
            if (isPageCreated) {
                const rebuilt = await withTimeout(
                    bridge.rebuildPageContainer(new RebuildPageContainer(buildConfig())),
                    5000,
                    false,
                );
                if (rebuilt) {
                    await new Promise(r => setTimeout(r, 300));
                    lastSongID = '';
                    imageRetryAt = 0;
                    lastSentSongInfoText = songInfoText;
                    lastSentPlaybackBarText = playbackBarText;
                }
                return;
            }
        }

        // First-time setup: create the page container
        if (!isPageCreated) {
            const result = await withTimeout(
                bridge.createStartUpPageContainer(new CreateStartUpPageContainer(buildConfig())),
                5000,
                StartUpPageCreateResult.invalid,
            );
            console.log('[GlassesView] createStartUpPageContainer:', result);

            if (result === StartUpPageCreateResult.success || result === StartUpPageCreateResult.invalid) {
                // success = created fresh; invalid = already exists — either way we're ready
                isPageCreated = true;
                // The initial config already carries this content, so treat it as sent —
                // avoids one redundant textContainerUpgrade call on the very next tick.
                lastSentSongInfoText = songInfoText;
                lastSentPlaybackBarText = playbackBarText;
            } else {
                // oversize or outOfMemory — can't recover, don't mark as created
                console.error('[GlassesView] Fatal container error:', result);
                return;
            }
        }

        // songInfo (title/artist/album) rarely changes between quick-ticks, but every ms spent
        // waiting on its round-trip directly delays the time-critical playbackBar/lyrics update
        // that follows. Skip the bridge call entirely when the content hasn't actually changed.
        const songInfoChanged = songInfoText !== lastSentSongInfoText;
        const songInfoOk = !songInfoChanged || await withTimeout(
            bridge.textContainerUpgrade(new TextContainerUpgrade({
                containerID: 3,
                containerName: 'songInfo',
                content: songInfoText,
            })),
            2000,
            false,
        );

        if (songInfoChanged && !songInfoOk) {
            // Text upgrade failed — fall back to a full rebuild so the container
            // is definitely in a known state before next frame
            console.warn('[GlassesView] textContainerUpgrade failed, rebuilding...');
            const rebuilt = await withTimeout(
                bridge.rebuildPageContainer(new RebuildPageContainer(buildConfig())),
                5000,
                false,
            );
            if (rebuilt) {
                await new Promise(r => setTimeout(r, 300));
                lastSongID = ''; // force image resend after rebuild
                imageRetryAt = 0;
                lastSentSongInfoText = songInfoText;
                lastSentPlaybackBarText = playbackBarText;
            }
            return; // Either way, skip this frame and retry next tick
        }
        if (songInfoChanged) lastSentSongInfoText = songInfoText;

        // This is the time-critical path (progress bar + lyrics) — skip the call entirely when
        // nothing changed since the last confirmed send, so ticks between lyric-word/line changes
        // cost zero bridge round-trips instead of one.
        if (playbackBarText !== lastSentPlaybackBarText) {
            const ok2 = await withTimeout(
                bridge.textContainerUpgrade(new TextContainerUpgrade({
                    containerID: 4,
                    containerName: 'playbackBar',
                    content: playbackBarText,
                })),
                2000,
                false,
            );
            if (ok2) lastSentPlaybackBarText = playbackBarText;
        }

        // Kick off image send in background if needed
        if (song.albumArtRaw?.length > 0 && song.songID !== lastSongID) {
            sendImageAsync(song);
        }

    } catch (e) {
        console.error('[GlassesView] createView error:', e);
    } finally {
        isUpdating = false;
    }
}
