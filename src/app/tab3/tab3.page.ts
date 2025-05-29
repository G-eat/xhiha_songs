import { Component } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { SqliteService } from '../services/sqlite.service';
import { Media, MediaObject } from '@awesome-cordova-plugins/media/ngx';
import { File } from '@awesome-cordova-plugins/file/ngx';
import { Platform } from '@ionic/angular';
import { App } from '@capacitor/app';
import { NgZone } from '@angular/core';

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
    private platform: Platform,
    private zone: NgZone
  ) {
    App.addListener('resume', () => {
      if (this.media && this.isPlaying) {
        console.log('🔁 Resuming playback');
        this.startTracking(); // ✅ Restart timer updates
      }
    });

    App.addListener('pause', () => {
      console.log('⏸️ App paused, stopping tracking');
      this.stopTracking(); // optional: stop while backgrounded
    });
  }

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
    const index = this.songsList.findIndex(s => s.path === song.path);
    if (index !== -1) this.currentIndex = index; // ✅ Track current index
  
    const currentToken = ++this.playToken;
  
    // Stop existing media
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
  
    try {
      const media = this.mediaPlugin.create(filePath);
  
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
          console.error('Media Error:', err);
        }
      });
  
      if (this.playToken === currentToken) {
        this.media = media;
        this.song = song;               // ✅ update song object
        this.currentTime = 0;           // ✅ reset time
        this.duration = 0;              // ✅ reset duration
        this.isPlaying = true;
        media.play();
        this.startTracking();
      } else {
        media.release();
      }
    } catch (err) {
      console.error('loadAndPlay failed:', err);
    }
  }
  

  startTracking() {
    this.stopTracking();
  
    this.intervalId = setInterval(() => {
      this.media?.getCurrentPosition().then(pos => {
        if (pos >= 0) {
          this.zone.run(() => {
            this.currentTime = Math.floor(pos); // ✅ triggers UI update
          });
        }
      });
  
      if (this.duration === 0 && this.media) {
        const dur = this.media.getDuration();
        if (dur > 0) {
          this.zone.run(() => {
            this.duration = Math.floor(dur); // ✅ triggers UI update
          });
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
