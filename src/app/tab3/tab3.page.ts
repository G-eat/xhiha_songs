import { Component } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { SqliteService } from '../services/sqlite.service';
import { Media, MediaObject } from '@awesome-cordova-plugins/media/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Platform } from '@ionic/angular';

interface Song {
  title: string;
  path: string;
  thumbnail?: string;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false
})
export class Tab3Page {
  song: Song | null = null;
  songsList: Song[] = [];

  media: MediaObject | null = null;
  isPlaying = false;
  currentTime = 0;
  duration = 0;
  intervalId: any;

  repeat = false;
  shuffle = false;
  currentIndex = 0;
  private playToken = 0;
  private lastPlayedSongId: number | null = null;


  constructor(
    private sqliteService: SqliteService,
    private mediaPlugin: Media,
    private file: File,
    private platform: Platform
  ) {}

  async ionViewWillEnter() {
    await this.platform.ready();
  
    const state = history.state;
  
    // 1. Handle playlist from Tab 4
    if (state.playlistSongs && Array.isArray(state.playlistSongs) && state.playIndex !== undefined) {
      const playlist = state.playlistSongs;
      const song = playlist[state.playIndex];
  
      // if (!this.lastPlayedSongId || this.lastPlayedSongId !== song.id) {
        this.songsList = playlist;
        this.lastPlayedSongId = song.id;
        await this.loadAndPlay(song);
      // }
      return;
    }
  
    // 2. Handle single song from Tab 2
    if (state.song) {
      const song = state.song;
  
      // if (!this.lastPlayedSongId || this.lastPlayedSongId !== song.id) {
        this.songsList = await this.sqliteService.getSongs(); // or just [song] if needed
        this.lastPlayedSongId = song.id;
        await this.loadAndPlay(song);
      //}
      return;
    }
  
    // 3. Just re-entered tab without new state → skip reloading
    if (this.song && this.media) {
      console.log('🔁 Already playing, no action needed');
    }
  
    // 4. Default first load
    this.songsList = await this.sqliteService.getSongs();
    return;
  }
  

  async loadAndPlay(song: Song) {
    // Generate a new token for this request
    const currentToken = ++this.playToken;
  
    // Stop existing playback
    if (this.media) {
      try {
        this.media.stop();
        this.media.release();
      } catch (e) {
        console.warn('Error stopping previous media:', e);
      }
      this.media = null;
    }
  
    const filePath = song.path;
  
    console.log('🟡 Attempting to play:', song.title, filePath);
  
    try {
      const media = this.mediaPlugin.create(filePath);
  
      // Delay playing until fully loaded
      media.onStatusUpdate.subscribe(status => {
        if (status === 2 && this.playToken === currentToken) {
          this.isPlaying = true;
        }
      });
  
      media.onSuccess.subscribe(() => {
        if (this.playToken === currentToken) {
          this.isPlaying = false;
          this.onEnded();
        }
      });
  
      media.onError.subscribe((err: any) => {
        if (this.playToken === currentToken) {
          const msg = `Media Error\nCode: ${err?.code ?? 'N/A'}\nMessage: ${err?.message ?? 'No message'}`;
          console.error(msg, err);
        }
      });
  
      // Only assign and play if this is still the latest click
      if (this.playToken === currentToken) {
        this.media = media;
        this.song = song;
        this.currentTime = 0;
        this.duration = 0;
        this.isPlaying = true;
        media.play();
        this.startTracking();
        console.log('✅ Playing now:', song.title);
      } else {
        media.release(); // clean up unused media
        console.warn('⚠️ Skipped outdated playback for:', song.title);
      }
    } catch (err) {
      console.error('❌ loadAndPlay failed:', err);
    }
  }

  startTracking() {
    this.stopTracking();

    this.intervalId = setInterval(() => {
      this.media?.getCurrentPosition().then(pos => {
        if (pos >= 0) this.currentTime = Math.floor(pos);
      });

      if (this.duration === 0 && this.media) {
        const dur = this.media.getDuration();
        if (dur > 0) {
          this.duration = Math.floor(dur);
        }
      }
    }, 1000);
  }

  stopTracking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  togglePlay() {
    if (!this.media) return;

    if (this.isPlaying) {
      this.media.pause();
      this.isPlaying = false;
    } else {
      this.media.play();
      this.isPlaying = true;
    }
  }

  seekTo(event: any) {
    const value = typeof event.detail.value === 'number'
      ? event.detail.value
      : (event.detail.value?.lower ?? 0); // fallback if range
  
    this.media?.seekTo(value * 1000);
    this.currentTime = value;
  }
  
  async onEnded() {
    this.isPlaying = false;

    if (this.repeat) {
      this.media?.seekTo(0);
      this.media?.play();
      this.isPlaying = true;
      return;
    }

    this.playNextSong();
  }

  playNextSong() {
    if (this.shuffle) {
      let next;
      do {
        next = Math.floor(Math.random() * this.songsList.length);
      } while (next === this.currentIndex && this.songsList.length > 1);
      this.currentIndex = next;
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.songsList.length;
    }

    this.loadAndPlay(this.songsList[this.currentIndex]);
  }

  playPreviousSong() {
    this.currentIndex = (this.currentIndex - 1 + this.songsList.length) % this.songsList.length;
    this.loadAndPlay(this.songsList[this.currentIndex]);
  }

  stop() {
    this.stopTracking();
    if (this.media) {
      this.media.stop();
      this.media.release();
      this.media = null;
    }
  }

  toggleRepeat() {
    this.repeat = !this.repeat;
    if (this.repeat) this.shuffle = false;
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    if (this.shuffle) this.repeat = false;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${this.pad(mins)}:${this.pad(secs)}`;
  }

  pad(num: number): string {
    return num < 10 ? '0' + num : num.toString();
  }

  ngOnDestroy() {
    this.stop();
  }
}
