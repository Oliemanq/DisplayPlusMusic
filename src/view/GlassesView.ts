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

const MAX_HEIGHT = 288;
const MAX_WIDTH = 576;
const IMAGE_RETRY_DELAY_MS = 3000;

let bridge: EvenAppBridge | null = null;
let isPageCreated = false;
let isUpdating = false;
let isSendingImage = false;
let lastSongID = "";
let imageRetryAt = 0;
let blanked = false;
let forceRebuild = false;

function devlog(level: 'INFO' | 'WARN', tag: string, msg: string) {
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    console.log(`[${ts} ${level}  ${tag}] ${msg}`);
}

export function isScreenBlanked(): boolean {
    return blanked;
}

function buildBlankConfig() {
    return {
        containerTotalNum: 1,
        textObject: [
            new TextContainerProperty({
                xPosition: 0,
                yPosition: 0,
                width: MAX_WIDTH,
                height: MAX_HEIGHT,
                borderWidth: 0,
                borderRadius: 0,
                containerID: 9,
                containerName: 'blank',
                content: ' ',
                isEventCapture: 1,
            }),
        ],
    };
}

export async function blankScreen(): Promise<void> {
    if (blanked) return;
    blanked = true;
    try {
        if (!bridge) {
            bridge = await withTimeout(waitForEvenAppBridge(), 3000, null);
            if (!bridge) return;
        }
        await withTimeout(
            bridge.rebuildPageContainer(new RebuildPageContainer(buildBlankConfig())),
            5000,
            false,
        );
        // Force fresh rebuild + image resend on next unblank
        isPageCreated = false;
        lastSongID = '';
        imageRetryAt = 0;
        devlog('INFO', 'GlassesView', 'screen blanked (rebuild to single empty text container)');
    } catch (e) {
        console.error('[GlassesView] blankScreen error:', e);
    }
}

export function unblankScreen(): void {
    if (!blanked) return;
    blanked = false;
    isPageCreated = true; // blank page exists; createView must skip createStartUpPageContainer
    forceRebuild = true;  // next createView must rebuildPageContainer with normal config
    lastSongID = '';
    imageRetryAt = 0;
    devlog('INFO', 'GlassesView', 'screen unblanked (forcing rebuild on next poll tick)');
}

/** Resolves with fallback value if the promise times out or throws. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

/** Builds the static container layout. Content fields are irrelevant for layout comparison. */
function buildContainerConfig(songInfoText: string, playbackBarText: string) {
    return {
        containerTotalNum: 4,
        imageObject: [
            new ImageContainerProperty({
                xPosition: 22,
                yPosition: 22,
                width: 100,
                height: 100,
                containerID: 0,
                containerName: 'album-art',
            }),
        ],
        listObject: [
            new ListContainerProperty({
                xPosition: 154,
                yPosition: 0,
                width: 80,
                height: 132,
                borderWidth: 0,
                borderRadius: 0,
                containerID: 2,
                containerName: 'buttons',
                isEventCapture: 1,
                itemContainer: new ListItemContainerProperty({
                    itemCount: 3,
                    itemName: ['◁◁', ' ▷ll', '▷▷'],
                    isItemSelectBorderEn: 1,
                }),
            }),
        ],
        textObject: [
            new TextContainerProperty({
                xPosition: 234,
                yPosition: 8,
                width: MAX_WIDTH - 242,
                height: 132,
                borderRadius: 12,
                borderWidth: 1,
                paddingLength: 16,
                containerID: 3,
                containerName: 'songInfo',
                content: songInfoText,
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
                isEventCapture: 0,
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
    if (blanked) return;
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
        const playbackBarText =
            `    ${formatTime(song.progressSeconds)} / ${formatTime(song.durationSeconds)}\n` +
            `${song.createPlaybackBar(MAX_WIDTH)}\n` +
            `  ${lyricsPresenter.currentLine}\n` +
            `    ${lyricsPresenter.nextLine}`;

        const config = buildContainerConfig(songInfoText, playbackBarText);

        // First-time setup: create the page container
        if (!isPageCreated) {
            const result = await withTimeout(
                bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config)),
                5000,
                StartUpPageCreateResult.invalid,
            );
            console.log('[GlassesView] createStartUpPageContainer:', result);

            if (result === StartUpPageCreateResult.success || result === StartUpPageCreateResult.invalid) {
                // success = created fresh; invalid = already exists — either way we're ready
                isPageCreated = true;
            } else {
                // oversize or outOfMemory — can't recover, don't mark as created
                console.error('[GlassesView] Fatal container error:', result);
                return;
            }
        }

        // Wake-from-blank: rebuild full layout before any text upgrade
        if (forceRebuild) {
            devlog('INFO', 'GlassesView', 'wake rebuild → rebuildPageContainer(normal config)');
            const rebuilt = await withTimeout(
                bridge.rebuildPageContainer(new RebuildPageContainer(config)),
                5000,
                false,
            );
            if (rebuilt) {
                forceRebuild = false;
                lastSongID = '';
                imageRetryAt = 0;
                // Let firmware settle before next text upgrade
                await new Promise(r => setTimeout(r, 300));
            } else {
                devlog('WARN', 'GlassesView', 'wake rebuild failed; will retry next tick');
                return;
            }
        }

        // Normal update: upgrade text content in-place (no screen clear)
        const ok1 = await withTimeout(
            bridge.textContainerUpgrade(new TextContainerUpgrade({
                containerID: 3,
                containerName: 'songInfo',
                content: songInfoText,
            })),
            2000,
            false,
        );

        if (!ok1) {
            // Text upgrade failed — fall back to a full rebuild so the container
            // is definitely in a known state before next frame
            console.warn('[GlassesView] textContainerUpgrade failed, rebuilding...');
            const rebuilt = await withTimeout(
                bridge.rebuildPageContainer(new RebuildPageContainer(config)),
                5000,
                false,
            );
            if (rebuilt) {
                await new Promise(r => setTimeout(r, 300));
                lastSongID = ''; // force image resend after rebuild
                imageRetryAt = 0;
            }
            return; // Either way, skip this frame and retry next tick
        }

        await withTimeout(
            bridge.textContainerUpgrade(new TextContainerUpgrade({
                containerID: 4,
                containerName: 'playbackBar',
                content: playbackBarText,
            })),
            2000,
            false,
        );

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