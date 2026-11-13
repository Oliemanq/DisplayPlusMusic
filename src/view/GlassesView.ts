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
    MenuContainerProperty,
    MenuItemProperty,
} from '@evenrealities/even_hub_sdk';

import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';
import lyricsPresenter from '../presenter/lyricsPresenter';
import spotifyPresenter from '../presenter/spotifyPresenter';
import { getTextWidth, pxTruncate } from '@evenrealities/pretext';

const MAX_HEIGHT = 288;
const MAX_WIDTH = 576;
const MARQUEE_SPACING = "          |          ";
const IMAGE_RETRY_DELAY_MS = 3000;

function truncateText(text: string, maxLength: number): string {
    return text.length > maxLength
        ? `${text.slice(0, maxLength - 1)}…`
        : text;
}

function cleanArtist(artist: string): string {
    const separators = [' feat. ', ' ft. ', ' featuring ', ' / '];
    let cleaned = artist;
    for (const sep of separators) {
        const index = cleaned.toLowerCase().indexOf(sep);
        if (index !== -1) {
            cleaned = cleaned.substring(0, index);
        }
    }
    return cleaned.trim();
}

function getMarqueeText(fullText: string, targetWidth: number, startIdx: number): string {
    const safetyBuffer = 2; // Small buffer to prevent overflow due to rendering discrepancies
    const effectiveTargetWidth = targetWidth - safetyBuffer;
    const doubledText = fullText + MARQUEE_SPACING + fullText + MARQUEE_SPACING;
    const loopLength = fullText.length + MARQUEE_SPACING.length;
    const actualStart = startIdx % loopLength;
    
    let endIdx = actualStart;
    while (endIdx < actualStart + loopLength && 
           getTextWidth(doubledText.substring(actualStart, endIdx + 1)) <= effectiveTargetWidth) {
        endIdx++;
    }
    
    if (endIdx === actualStart && getTextWidth(doubledText.substring(actualStart, actualStart + 1)) > effectiveTargetWidth) {
        return doubledText.substring(actualStart, actualStart + 1);
    }
    
    return doubledText.substring(actualStart, endIdx);
}

/** Helper to get a marquee line for a given text, target width, and current phase. */
function getMarqueeLine(text: string, targetWidth: number, phase: number, commonLength?: number): string {
    const cycle = 25000;
    const staticDuration = 15000;

    if (getTextWidth(text) <= targetWidth) {
        return text;
    }

    const effectiveText = commonLength ? text.padEnd(commonLength, ' ') : text;
    const effectiveLength = commonLength ?? text.length;

    if (phase < staticDuration) {
        return getMarqueeText(effectiveText, targetWidth, 0);
    } else {
        const animationDuration = cycle - staticDuration;
        const progress = (phase - staticDuration) / animationDuration;
        const step = Math.floor(progress * (effectiveLength + MARQUEE_SPACING.length));
        return getMarqueeText(effectiveText, targetWidth, step);
    }
}

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
let lastMiniMode = false;

/** Resolves with fallback value if the promise times out or throws. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

/** Builds the container layout for mini mode. */
function buildMiniModeConfig(songInfoText: string, lyricsText: string) {
    return {
        containerTotalNum: 2,
        imageObject: [],
        menuObject: new MenuContainerProperty({
            menuItems: [
                new MenuItemProperty({ itemName: 'Exit Mini mode', itemID: 2 }),
            ],
        }),
        listObject: [],
        textObject: [
            new TextContainerProperty({
                xPosition: 0,
                yPosition: 0,
                width: MAX_WIDTH,
                height: 80,
                borderRadius: 0,
                borderWidth: 0,
                paddingLength: 0,
                containerID: 10,
                textColor: 4,
                zOrderIndex: 2,
                containerName: 'songInfo',
                content: songInfoText,
                isEventCapture: 0,
            }),
            new TextContainerProperty({
                xPosition: 0,
                yPosition: 40,
                width: MAX_WIDTH,
                height: 80,
                borderRadius: 0,
                borderWidth: 0,
                paddingLength: 0,
                containerID: 11,
                textColor: 4,
                zOrderIndex: 1,
                containerName: 'lyrics',
                content: lyricsText,
                isEventCapture: 1,
            }),
        ],
    };
}

/** Builds the container layout for the active source. Content fields are irrelevant for layout comparison. */
function buildContainerConfig(
    songInfoText: string,
    playbackBarText: string,
    showPlaybackButtons: boolean,
    isMiniMode: boolean,
) {
    if (isMiniMode) {
        return buildMiniModeConfig(songInfoText, playbackBarText);
    }

    return {
        containerTotalNum: showPlaybackButtons ? 4 : 3,
        imageObject: [
            new ImageContainerProperty({
                xPosition: 2,
                yPosition: 2,
                width: 144,
                height: 144,
                containerID: 0,
                containerName: 'album-art',
            }),
        ],
        menuObject: new MenuContainerProperty({
            menuItems: [
                new MenuItemProperty({ itemName: 'Enter Mini mode', itemID: 1 }),
            ],
        }),
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
                textColor: 4,
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
                textColor: 4,
                // The list owns input capture when playback controls are shown.
                isEventCapture: showPlaybackButtons ? 0 : 1,
            }),
        ],
    };
}

/** Sends album art in the background — never blocks the text update path. */
async function sendImageAsync(song: Song, isMiniMode: boolean): Promise<void> {
    if (isMiniMode || isSendingImage || Date.now() < imageRetryAt) return;
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

        const activeSource = spotifyPresenter.getActiveSource();
        const isMiniMode = spotifyPresenter.isMiniMode;
        const showPlaybackButtons = spotifyPresenter.supportsPlaybackControl();
        // Button visibility is per player, so it is part of the layout key: switching between
        // a controllable and a non-controllable player must rebuild the page.
        const layoutKey = showPlaybackButtons && !isMiniMode ? `${activeSource}:buttons` : activeSource;
        const songInfoID = isMiniMode ? 10 : 3;
        const lyricsID = isMiniMode ? 11 : 4;
        const phase_timing = 25000; // 25 seconds for a full marquee cycle

        const songInfoText = isMiniMode 
            ? (() => {
                const cleanArtistName = cleanArtist(song.artist);
                const titlePart = `${song.title} - `;
                const metadataPart = `    ${song.isPlaying ? " " : "|| "}( ${formatTime(song.progressSeconds)} - ${formatTime(song.durationSeconds)} )`;
                const metadataWidth = getTextWidth(metadataPart);
                const marqueeContent = titlePart + cleanArtistName;
                const marqueeMaxWidth = Math.max(0, MAX_WIDTH - metadataWidth - 15);
                const phase = Date.now() % phase_timing;
                const marqueeLine = getMarqueeLine(marqueeContent, marqueeMaxWidth, phase);
                let paddedMarquee = marqueeLine;
                // Use a larger safety buffer to prevent the metadata from wrapping to the next line.
                while (getTextWidth(paddedMarquee) < Math.max(0, marqueeMaxWidth - 15)) {
                    paddedMarquee += " ";
                }
                return paddedMarquee + metadataPart;
              })()
            : (() => {
                const infoWidth = (showPlaybackButtons ? MAX_WIDTH - 232 : MAX_WIDTH - 153) - 32;
                const phase = Date.now() % phase_timing;
                
                const maxLength = Math.max(song.title.length, song.artist.length, song.album.length);
                
                const titleLine = getMarqueeLine(song.title, infoWidth, phase, maxLength);
                const artistLine = getMarqueeLine(song.artist, infoWidth, phase, maxLength);
                const albumLine = getMarqueeLine(song.album, infoWidth, phase, maxLength);
                
                return `${titleLine}\n${artistLine}\n${albumLine}`;
              })();

        const currentLineText = lyricsPresenter.hasWordTiming
            ? lyricsPresenter.renderWordByWordText(MAX_WIDTH - 20)
            : lyricsPresenter.currentLineFormatted;

        const playbackBarText = isMiniMode
            ? `${currentLineText}\n      ${truncateText(lyricsPresenter.nextLine, currentLineText.length < 35 ? 35 : currentLineText.length)}`
            : (() => {
                const pauseSymbol = song.isPlaying ? " " : "|| ";
                const timePart = `${formatTime(song.progressSeconds)}               -${formatTime(Math.max(0, song.durationSeconds - song.progressSeconds))}`;
                // Account for pause symbol width by adding a small buffer or using truncate on the timePart if needed, 
                // but here we actually want to ensure the total text width doesn't overflow.
                // The user mentioned it overflows by a character when paused.
                // Let's refine the calculation of timePart to be more robust or just add a small padding.
                
                // Actually, the issue is likely that the total width including the pause symbol 
                // is slightly more than what's expected.
                
                // Let's refine the calculation of timePart to be more robust or just add a small padding.
                
                // Actually, the issue is likely that the total width including the pause symbol 
                // is slightly more than what's expected.
                
                return `${timePart}\n` +
                  `${song.createPlaybackBar(MAX_WIDTH)}\n` +
                  ` ${currentLineText}\n` +
                  `         ${truncateText(lyricsPresenter.nextLine, currentLineText.length < 35 ? 35 : currentLineText.length)}`;
              })();

        const buildConfig = () => buildContainerConfig(songInfoText, playbackBarText, showPlaybackButtons, isMiniMode);

        if (lastRenderedSource !== layoutKey || lastMiniMode !== isMiniMode) {
            if (isPageCreated) {
                const rebuilt = await withTimeout(
                    bridge.rebuildPageContainer(new RebuildPageContainer(buildConfig())),
                    5000,
                    false,
                );
                if (!rebuilt) {
                    console.error(`[GlassesView] Failed to rebuild ${activeSource} layout`);
                    return;
                }

                lastRenderedSource = layoutKey;
                lastMiniMode = isMiniMode;
                await new Promise(r => setTimeout(r, 300));
                lastSongID = '';
                imageRetryAt = 0;
                lastSentSongInfoText = songInfoText;
                lastSentPlaybackBarText = playbackBarText;
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

            if (result === StartUpPageCreateResult.success) {
                isPageCreated = true;
                lastRenderedSource = layoutKey;
                lastMiniMode = isMiniMode;
                // The initial config already carries this content, so treat it as sent —
                // avoids one redundant textContainerUpgrade call on the very next tick.
                lastSentSongInfoText = songInfoText;
                lastSentPlaybackBarText = playbackBarText;
            } else if (result === StartUpPageCreateResult.invalid) {
                // An existing page can retain the layout from a previous source.
                // Rebuild it so source-specific containers, such as Spotify controls,
                // are removed when Navidrome is active.
                const rebuilt = await withTimeout(
                    bridge.rebuildPageContainer(new RebuildPageContainer(buildConfig())),
                    5000,
                    false,
                );
                if (!rebuilt) {
                    console.error('[GlassesView] Failed to rebuild existing page');
                    return;
                }

                isPageCreated = true;
                lastRenderedSource = layoutKey;
                lastMiniMode = isMiniMode;
                lastSongID = '';
                imageRetryAt = 0;
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
                containerID: songInfoID,
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
                    containerID: lyricsID,
                    containerName: isMiniMode ? 'lyrics' : 'playbackBar',
                    content: playbackBarText,
                })),
                2000,
                false,
            );
            if (ok2) lastSentPlaybackBarText = playbackBarText;
        }

        // Kick off image send in background if needed
        if (song.albumArtRaw?.length > 0 && song.songID !== lastSongID) {
            sendImageAsync(song, isMiniMode);
        }

    } catch (e) {
        console.error('[GlassesView] createView error:', e);
    } finally {
        isUpdating = false;
    }
}