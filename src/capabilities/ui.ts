import { LyricLine, LyricWord } from '../state/lyricState';
import { SongInfo } from '../state/appState';
import { escapeHtmlLyric, escapeHtmlUI } from './util';
import { formatTime } from '../Scripts/formatTime';
import { system } from '../capabilities/system';
import { 
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
    ListItemContainerProperty
} from '@evenrealities/even_hub_sdk';
import Song, { song_placeholder } from '../model/songModel';

const MAX_HEIGHT = 288;
const MAX_WIDTH = 576;
const IMAGE_RETRY_DELAY_MS = 3000;

/** Formats a single line for text-only output (e.g. for console or non-word-timed display).
 * Matches the logic in original LyricsPresenter.currentLineFormatted.
 */
export const UI = {
  formatLineText(
    text: string,
    words: LyricWord[] | undefined,
    activeIndex: number
  ): string {
    if (!words || words.length === 0) {
      return text === '' ? `` : ` [   ${text}   ]`;
    }

    let line = '  [   "';
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      line += word.text;
      if (i !== activeIndex) {
        line += ' ';
      } else if (word.text.endsWith("'") || word.text.endsWith('"')) {
        line += ' " ';
      } else {
        line += '" ';
      }
    }
    return line + '  ]';
  },

  /** Renders the current line as individual word spans for word-by-word highlighting.
   * Matches the logic in original LyricsPresenter.renderWordByWordHTML.
   */
  renderWordByWordHTML(words: LyricWord[], activeIndex: number): string {
    return words
      .map((word, i) => {
        const isActive = i === activeIndex;
        const hasSpoken = i < activeIndex;
        const className = isActive || hasSpoken ? 'lyric-word lyric-word-active' : 'lyric-word';
        return `<span class="${className}">${escapeHtmlLyric(word.text)}</span>`;
      })
      .join(' ');
  },

  /** Creates a playback progress bar string.
   * Matches the logic in original Song.createPlaybackBar.
   */
  createPlaybackBar(
    progressSeconds: number,
    durationSeconds: number,
    isPlaying: boolean,
    maxWidth: number
  ): string {
    let value = progressSeconds;
    let max = durationSeconds;

    let progressPercent = 0;
    if (max > 0) {
      progressPercent = value / max;
      if (isNaN(progressPercent) || !isFinite(progressPercent)) {
        progressPercent = 0;
      }
      progressPercent = Math.max(0, Math.min(1, progressPercent));
    }

    const maxUnderscores = 64;
    const maxDashes = 57;
    const maxVerticalBar = 144;
    const maxBrackets = 82;

    const underscoreWidth = maxWidth / maxUnderscores;
    const dashWidth = maxWidth / maxDashes;
    const barWidth = maxWidth / maxVerticalBar;
    const bracketsWidth = maxWidth / maxBrackets;

    let maxWidthTrue = maxWidth - (bracketsWidth * 2) - (isPlaying ? 0 : barWidth * 3);

    let maxDashCount = Math.floor(progressPercent * maxDashes);
    let maxUnderscoreCount = Math.floor((1 - progressPercent) * maxUnderscores);

    let dashCount = Math.floor(maxDashCount * (maxWidthTrue / maxWidth));
    let underscoreCount = Math.floor(maxUnderscoreCount * (maxWidthTrue / maxWidth));
    while ((dashCount * dashWidth) + (underscoreCount * underscoreWidth) > maxWidthTrue && dashCount > 0) {
      dashCount -= 1;
    }

    dashCount = Math.max(0, dashCount);
    underscoreCount = Math.max(0, underscoreCount);

    return (isPlaying ? "" : "|| ") + "[" + "-".repeat(dashCount) + "|" + "_".repeat(underscoreCount) + "]";
  }
};

/** Helper to handle bridge timeouts. */
/** (Deprecated: Use system.withTimeout instead) */

/** Manages the UI and bridge communication.
 * Contains the heavy lifting for updating containers and images on the glasses.
 */
export class UIManager {
  private bridge: EvenAppBridge | null = null;
  private isPageCreated = false;
  private isUpdating = false;
  private isSendingImage = false;
  private lastSongID = "";
  private lastRenderedSource = '';
  private imageRetryAt = 0;
  private lastSentSongInfoText = '';
  private lastSentPlaybackBarText = '';

  async init() {
    this.bridge = await system.getBridge();
    if (!this.bridge) {
      console.warn('[UIManager] Bridge unavailable');
    }
  }

  private buildContainerConfig(songInfoText: string, playbackBarText: string, showPlaybackButtons: boolean) {
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
          isEventCapture: showPlaybackButtons ? 0 : 1,
        }),
      ],
    };
  }

  async update(song: SongInfo, lyrics: { currentLine: string, nextLine: string, isWordMode: boolean, words: LyricWord[], sourceLabel: string }) {
    if (!this.bridge) return;
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      const songInfoText = `${song.title}\n${song.artist}\n${song.album}`;
      const playbackBarText = `${formatTime(song.progressSeconds)}               -${formatTime(Math.max(0, song.durationSeconds - song.progressSeconds))}\n` +
        `${UI.createPlaybackBar(song.progressSeconds, song.durationSeconds, true, MAX_WIDTH)}\n` +
        `${lyrics.currentLine}\n` +
        `           ${lyrics.nextLine}\n` +
        `${lyrics.sourceLabel}`;

      const showPlaybackButtons = song.id !== '0'; // Simplification for now, should really use source manager
      const buildConfig = () => this.buildContainerConfig(songInfoText, playbackBarText, showPlaybackButtons);

      if (this.lastRenderedSource !== song.id) {
        this.lastRenderedSource = song.id;
        if (this.isPageCreated) {
          const rebuilt = await system.withTimeout(
            this.bridge.rebuildPageContainer(new RebuildPageContainer(buildConfig())),
            5000,
            false,
          );
          if (rebuilt) {
            await new Promise(r => setTimeout(r, 300));
            this.lastSongID = '';
            this.imageRetryAt = 0;
            this.lastSentSongInfoText = songInfoText;
            this.lastSentPlaybackBarText = playbackBarText;
          }
          return;
        }
      }

      if (!this.isPageCreated) {
        const result = await system.withTimeout(
          this.bridge.createStartUpPageContainer(new CreateStartUpPageContainer(buildConfig())),
          5000,
          StartUpPageCreateResult.invalid,
        );

        if (result === StartUpPageCreateResult.success || result === StartUpPageCreateResult.invalid) {
          this.isPageCreated = true;
          this.lastSentSongInfoText = songInfoText;
          this.lastSentPlaybackBarText = playbackBarText;
        } else {
          console.error('[UIManager] createStartUpPageContainer error:', result);
          return;
        }
      }

      const songInfoChanged = songInfoText !== this.lastSentSongInfoText;
      if (songInfoChanged) {
        const songInfoOk = await system.withTimeout(
          this.bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 3,
            containerName: 'songInfo',
            content: songInfoText,
          })),
          2000,
          false,
        );

        if (!songInfoOk) {
          const rebuilt = await system.withTimeout(
            this.bridge.rebuildPageContainer(new RebuildPageContainer(buildConfig())),
            5000,
            false,
          );
          if (rebuilt) {
            await new Promise(r => setTimeout(r, 300));
            this.lastSongID = '';
            this.imageRetryAt = 0;
            this.lastSentSongInfoText = songInfoText;
            this.lastSentPlaybackBarText = playbackBarText;
          }
          return;
        }
        this.lastSentSongInfoText = songInfoText;
      }

      if (playbackBarText !== this.lastSentPlaybackBarText) {
        const ok2 = await system.withTimeout(
          this.bridge.textContainerUpgrade(new TextContainerUpgrade({
            containerID: 4,
            containerName: 'playbackBar',
            content: playbackBarText,
          })),
          2000,
          false,
        );
        if (ok2) this.lastSentPlaybackBarText = playbackBarText;
      }

      // Art update
      // We need the raw data. The current SongInfo doesn't have it. 
      // This is a bit of a design flaw in the current SongInfo. 
      // We'll have to pass it or use a separate mechanism.
      // For now, let's assume we only call this if we have the art.
    } catch (e) {
      console.error('[UIManager] update error:', e);
    } finally {
      this.isUpdating = false;
    }
  }

  async sendImage(songID: string, artRaw: Uint8Array) {
    if (!this.bridge || this.isSendingImage || Date.now() < this.imageRetryAt || songID === this.lastSongID) return;

    this.isSendingImage = true;
    try {
      const result = await system.withTimeout(
        this.bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: 0,
          containerName: 'album-art',
          imageData: artRaw,
        })),
        8000,
        ImageRawDataUpdateResult.sendFailed,
      );

      if (result === ImageRawDataUpdateResult.success) {
        this.lastSongID = songID;
        this.imageRetryAt = 0;
      } else {
        this.imageRetryAt = Date.now() + IMAGE_RETRY_DELAY_MS;
      }
    } catch (e) {
      console.error('[UIManager] sendImage error:', e);
      this.imageRetryAt = Date.now() + IMAGE_RETRY_DELAY_MS;
    } finally {
      this.isSendingImage = false;
    }
  }
}
