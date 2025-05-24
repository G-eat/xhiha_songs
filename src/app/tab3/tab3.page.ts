import { Component, ViewChild, ElementRef } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { SqliteService } from '../services/sqlite.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  @ViewChild('audioPlayer', { static: false }) audioPlayer!: ElementRef<HTMLAudioElement>;

  song: { title: string; path: string; thumbnail?: string } | null = null;
  songsList: { title: string; path: string; thumbnail?: string }[] = [];

  isPlaying = false;
  duration = 0;
  currentTime = 0;
  repeat = false;
  shuffle = false;

  constructor(private sqliteService: SqliteService) {}

  async ionViewWillEnter() {
    const state = history.state;
  
    // 🎵 If playlist passed, use it
    if (state.playlistSongs && Array.isArray(state.playlistSongs)) {
      this.songsList = state.playlistSongs;
      const startIndex = state.playIndex ?? 0;
      const songToPlay = this.songsList[startIndex];
      if (songToPlay) {
        await this.loadAndPlay(songToPlay);
      }
      return;
    }
  
    // 🎵 Otherwise load all songs fresh
    this.songsList = await this.sqliteService.getSongs();
  
    const newSong = state.song;
    if (newSong) {
      await this.loadAndPlay(newSong);
    }
  }
  

  async loadAndPlay(song: { title: string; path: string; thumbnail?: string }) {
    const audio = this.audioPlayer.nativeElement;

    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;

    audio.pause();
    audio.src = '';
    audio.load();

    try {
      const fileName = song.path.split('/').pop();
      const file = await Filesystem.readFile({
        path: fileName!,
        directory: Directory.Documents
      });

      if (!file.data) {
        console.error('No file data found');
        return;
      }

      const blob = this.base64ToBlob(file.data as string, 'audio/mp3');
      const blobUrl = URL.createObjectURL(blob);

      audio.src = blobUrl;

      audio.onloadedmetadata = () => {
        audio.play().catch(err => {
          console.warn('Playback failed:', err);
        });
        this.isPlaying = true;
      };

      audio.load();
      this.song = song;
    } catch (error) {
      console.error('Error loading file:', error);
    }
  }

  base64ToBlob(base64: string, mime: string): Blob {
    const binary = atob(base64);
    const array = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new Blob([array], { type: mime });
  }

  togglePlay() {
    const audio = this.audioPlayer.nativeElement;
    if (audio.paused) {
      audio.play();
      this.isPlaying = true;
    } else {
      audio.pause();
      this.isPlaying = false;
    }
  }

  onTimeUpdate() {
    this.currentTime = this.audioPlayer.nativeElement.currentTime;
  }

  onLoadedMetadata() {
    this.duration = this.audioPlayer.nativeElement.duration;
  }

  seekTo(event: CustomEvent) {
    const value = (event.detail.value as number);
    this.audioPlayer.nativeElement.currentTime = value;
  }

  toggleRepeat() {
    this.repeat = !this.repeat;
    if (this.repeat) this.shuffle = false;
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    if (this.shuffle) this.repeat = false;
  }

  async onEnded() {
    this.isPlaying = false;

    if (this.repeat) {
      this.audioPlayer.nativeElement.currentTime = 0;
      await this.audioPlayer.nativeElement.play();
      this.isPlaying = true;
      return;
    }

    this.playNextSong();
  }

  playNextSong() {
    if (!this.songsList.length) return;

    if (this.shuffle) {
      const nextSong = this.getRandomSong();
      this.loadAndPlay(nextSong);
    } else {
      const currentIndex = this.songsList.findIndex(s => s.path === this.song?.path);
      const nextIndex = (currentIndex + 1) % this.songsList.length;
      const nextSong = this.songsList[nextIndex];
      this.loadAndPlay(nextSong);
    }
  }

  playPreviousSong() {
    if (!this.songsList.length) return;

    const currentIndex = this.songsList.findIndex(s => s.path === this.song?.path);
    const prevIndex = (currentIndex - 1 + this.songsList.length) % this.songsList.length;
    const prevSong = this.songsList[prevIndex];
    this.loadAndPlay(prevSong);
  }

  getRandomSong() {
    let randomSong;
    do {
      const i = Math.floor(Math.random() * this.songsList.length);
      randomSong = this.songsList[i];
    } while (randomSong.path === this.song?.path && this.songsList.length > 1);
    return randomSong;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${this.pad(mins)}:${this.pad(secs)}`;
  }

  pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}
