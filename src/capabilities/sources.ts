import { initSpotify } from '../model/spotifyModel';
import navidromeModel from '../model/navidromeModel';
import Song from '../model/songModel';
import { storage } from '../utils/storage';

export type SourceType = 'spotify' | 'navidrome';

export interface SourceInfo {
  type: SourceType;
  label: string;
}

export interface NavidromeClient {
  clientName: string;
  title: string;
  artist: string;
  songID: string;
  isPlaying: boolean;
}

export class SourcesManager {
  private activeSource: SourceType = 'spotify';

  async init(): Promise<void> {
    const storedSource = await storage.getItem('music_source');
    if (storedSource) {
      this.activeSource = storedSource as SourceType;
    }

    if (this.activeSource === 'spotify') {
      await initSpotify();
    } else {
      await navidromeModel.init();
    }
  }

  async setSource(source: SourceType): Promise<void> {
    await storage.setItem('music_source', source);
    this.activeSource = source;
    if (source === 'spotify') {
      await initSpotify();
    } else {
      await navidromeModel.init();
    }
  }

  getActiveSourceType(): SourceType {
    return this.activeSource;
  }

  getLyricsSourceLabel(): string {
    if (this.activeSource === 'spotify') {
      // The original used spotifyPresenter.currentLyricsSource.
      // We'll let the source manager handle this if needed or just depend on the model.
      // For now, let's assume we can get it from the model or state.
      return ''; 
    } else {
      return '';
    }
  }

  async fetchCurrentTrack(): Promise<Song> {
    if (this.activeSource === 'spotify') {
      return await spotifyModel.fetchCurrentTrack();
    } else {
      return await navidromeModel.fetchCurrentTrack();
    }
  }

  async fetchNextTrack(): Promise<Song | undefined> {
    if (this.activeSource === 'spotify') {
      return await spotifyModel.fetchNextTrack();
    } else {
      return await navidromeModel.fetchNextTrack();
    }
  }

  async song_Pause(): Promise<void> {
    if (this.activeSource === 'spotify') {
      await spotifyModel.song_Pause();
    } else {
      await navidromeModel.song_Pause();
    }
  }

  async song_Play(): Promise<void> {
    if (this.activeSource === 'spotify') {
      await spotifyModel.song_Play();
    } else {
      await navidromeModel.song_Play();
    }
  }

  async song_Back(): Promise<void> {
    if (this.activeSource === 'spotify') {
      await spotifyModel.song_Back();
    } else {
      await navidromeModel.song_Back();
    }
  }

  async song_Forward(): Promise<void> {
    if (this.activeSource === 'spotify') {
      await spotifyModel.song_Forward();
    } else {
      await navidromeModel.song_Forward();
    }
  }

  getNavidromeClients(): NavidromeClient[] {
    if (this.activeSource === 'navidrome') {
      return navidromeModel.getPlaybackClients();
    }
    return [];
  }

  async setNavidromeClient(clientName: string): Promise<void> {
    if (this.activeSource === 'navidrome') {
      await navidromeModel.setSelectedPlaybackClient(clientName);
    }
  }

  async setSelectedNavidromeClient(clientName: string): Promise<void> {
    if (this.activeSource === 'navidrome') {
        await navidromeModel.setSelectedPlaybackClient(clientName);
    }
  }
}

export const sourcesManager = new SourcesManager();
