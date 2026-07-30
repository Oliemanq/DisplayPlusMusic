import Song from './songModel';
import spotifyPresenter from '../presenter/spotifyPresenter';
import { storage } from '../utils/storage';

type NavidromeCue = {
    start?: number;
    end?: number;
    value?: string;
};

type NavidromeCueLine = {
    index?: number;
    start?: number;
    end?: number;
    value?: string;
    cue?: NavidromeCue[];
};

type NavidromeStructuredLyricLine = {
    start?: number;
    value?: string;
};

type NavidromeStructuredLyrics = {
    kind?: string;
    synced?: boolean;
    line?: NavidromeStructuredLyricLine[];
    cueLine?: NavidromeCueLine[];
};

type NavidromeLyricsResponse = {
    'subsonic-response'?: {
        lyricsList?: {
            structuredLyrics?: NavidromeStructuredLyrics[];
        };
    };
};

type NavidromeLyricsList = NonNullable<NonNullable<NavidromeLyricsResponse['subsonic-response']>['lyricsList']>;

function buildNavidromeAuthParams(username: string, password: string): URLSearchParams {
    return new URLSearchParams({
        u: username,
        p: password,
        v: '1.16.1',
        c: 'evenhub',
        f: 'json',
    });
}

/** Formats milliseconds as an LRC timestamp tag, e.g. `[01:23.45]` or `<01:23.45>`. */
function formatLrcTimestamp(totalMilliseconds: number, brackets: '[]' | '<>'): string {
    const clamped = Math.max(0, Math.floor(totalMilliseconds));
    const minutes = Math.floor(clamped / 60000);
    const seconds = Math.floor((clamped % 60000) / 1000);
    const centiseconds = Math.floor((clamped % 1000) / 10);
    const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    return brackets === '[]' ? `[${timestamp}]` : `<${timestamp}>`;
}

/**
 * Builds a single LRC line, embedding per-word/syllable timing tags (the "enhanced" or
 * ".elrc" convention: `[00:12.00]<00:12.00>word <00:12.50>word2`) when cue-level timing
 * is available from the source data.
 */
function buildEnhancedLrcLine(start: number, value: string, cues: NavidromeCue[] | undefined): string {
    const lineTag = formatLrcTimestamp(start, '[]');
    if (!cues || cues.length === 0) {
        return `${lineTag}${value}`;
    }

    const wordTags = cues
        .filter(cue => typeof cue.start === 'number')
        .map(cue => `${formatLrcTimestamp(cue.start!, '<>')}${cue.value ?? ''}`)
        .join('');

    return `${lineTag}${wordTags || value}`;
}

function lyricsFromStructuredLyricsList(lyricsList: NavidromeLyricsList | undefined) {
    const structuredLyrics = lyricsList?.structuredLyrics;
    if (!structuredLyrics || structuredLyrics.length === 0) {
        return { plainLyrics: null, syncedLyrics: null };
    }

    const firstLyrics = structuredLyrics[0];
    const cueLines = firstLyrics.cueLine;
    const lines: NavidromeStructuredLyricLine[] = firstLyrics.line ?? [];
    const isSynced = lines.some(line => typeof line.start === 'number');
    const plainLyrics = lines.map(line => line.value ?? '').join('\n');

    // Prefer cueLine (word/syllable-level timing) when present — it carries the same
    // line text plus nested `cue` arrays for word-by-word timestamps.
    const syncedLyrics = cueLines && cueLines.length > 0
        ? cueLines
            .filter(cueLine => typeof cueLine.start === 'number')
            .map(cueLine => buildEnhancedLrcLine(cueLine.start!, cueLine.value ?? '', cueLine.cue))
            .join('\n')
        : isSynced
            ? lines
                .map(line => {
                    if (typeof line.start !== 'number') {
                        return line.value ?? '';
                    }
                    return buildEnhancedLrcLine(line.start, line.value ?? '', undefined);
                })
                .join('\n')
            : null;

    return {
        plainLyrics: plainLyrics || null,
        syncedLyrics,
    };
}

async function fetchLyricsFromNavidrome(song: Song) {
    if (spotifyPresenter.getActiveSource() !== 'navidrome' || song.songID === '0') {
        return { plainLyrics: null, syncedLyrics: null, source: '' as const };
    }

    const baseUrl = (await storage.getItem('navidrome_base_url')) ?? '';
    const username = (await storage.getItem('navidrome_username')) ?? '';
    const password = (await storage.getItem('navidrome_password')) ?? '';

    if (!baseUrl || !username || !password) {
        return { plainLyrics: null, syncedLyrics: null, source: '' as const };
    }

    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/rest/getLyricsBySongId.view`);
    url.search = buildNavidromeAuthParams(username, password).toString();
    url.searchParams.set('id', song.songID);
    // Request word/syllable-level cue timing (OpenSubsonic songLyrics v2) when the server supports it.
    // Servers that don't understand this parameter simply ignore it and return v1 line-level data.
    url.searchParams.set('enhanced', 'true');

    const response = await fetch(url.toString());
    if (!response.ok) {
        return { plainLyrics: null, syncedLyrics: null };
    }

    const data = (await response.json()) as NavidromeLyricsResponse;
    const lyrics = lyricsFromStructuredLyricsList(data['subsonic-response']?.lyricsList);
    return { ...lyrics, source: 'local server' as const };
}

async function fetchLyrics(song: Song) {
    const title = song.title.trim().toLowerCase();
    const artist = song.artist.trim().toLowerCase();

    if (
        song.songID === '0' ||
        title === '' ||
        title === 'no song found' ||
        artist.includes('please log in via')
    ) {
        return {
            plainLyrics: null,
            syncedLyrics: null
            ,source: '' as const
        }
    }

    try {
        const navidromeLyrics = await fetchLyricsFromNavidrome(song);
        if (navidromeLyrics.plainLyrics || navidromeLyrics.syncedLyrics) {
            console.log(`Lyrics fetched from Navidrome for ${song.title}`);
            return navidromeLyrics;
        }
    } catch (e) {
        console.error('Failed to fetch lyrics from Navidrome:', e);
    }

    const url = new URL("https://lrclib.net/api/get");
    url.searchParams.append("track_name", song.title);
    url.searchParams.append("artist_name", song.artist);
    if (song.album && song.album !== "None") {
        url.searchParams.append("album_name", song.album);
    }
    if (song.durationSeconds > 0) {
        url.searchParams.append("duration", Math.round(song.durationSeconds).toString());
    }

    try {
        const response = await fetch(url.toString());

        if (!response.ok) {
            console.log(`Lyrics not found for ${song.title} (${response.status})`);
            return {
                plainLyrics: null,
                syncedLyrics: null
                ,source: '' as const
            };
        }

        const data = await response.json();
        console.log(`Lyrics fetched for ${song.title} successfully:`, data.syncedLyrics ? "Has synced lyrics" : "Plain lyrics only");

        return {
            plainLyrics: data.plainLyrics,
            syncedLyrics: data.syncedLyrics,
            source: 'web' as const,
        };
    } catch (e) {
        console.error("Failed to fetch lyrics:", e);
        return {
            plainLyrics: null,
            syncedLyrics: null
            ,source: '' as const
        };
    }
}

export { fetchLyrics };