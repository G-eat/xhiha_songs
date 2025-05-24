import { Component } from '@angular/core';
import { SqliteService } from '../services/sqlite.service';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page {
  newPlaylistName = '';
  playlists: { id: number; name: string }[] = [];
  selectedPlaylistId: number | null = null;
  songsInPlaylist: any[] = [];

  constructor(private sqliteService: SqliteService, private alertCtrl: AlertController, private router: Router) {}

  async ionViewWillEnter() {
    await this.loadPlaylists();
    this.selectedPlaylistId = null;
    this.songsInPlaylist = [];
  }

  async loadPlaylists() {
    this.playlists = await this.sqliteService.getPlaylists();
  }

  async createPlaylist() {
    const name = this.newPlaylistName.trim();
    if (!name) return;
    try {
      await this.sqliteService.createPlaylist(name);
      this.newPlaylistName = '';
      await this.loadPlaylists();
    } catch (err) {
      console.error('Playlist creation failed:', err);
    }
  }

  async selectPlaylist(playlistId: number) {
    this.selectedPlaylistId = playlistId;
    this.songsInPlaylist = await this.sqliteService.getSongsInPlaylist(playlistId);
  }

  async deletePlaylist(playlistId: number) {
    const confirmed = confirm('Are you sure you want to delete this playlist?');
    if (!confirmed) return;
  
    try {
      await this.sqliteService.deletePlaylist(playlistId);
      await this.loadPlaylists();
      if (this.selectedPlaylistId === playlistId) {
        this.selectedPlaylistId = null;
        this.songsInPlaylist = [];
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  }

  async removeSongFromPlaylist(songId: number) {
    const alert = await this.alertCtrl.create({
      header: 'Remove Song',
      message: 'Are you sure you want to remove this song from the playlist?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            if (!this.selectedPlaylistId) return;
            await this.sqliteService.removeSongFromPlaylist(this.selectedPlaylistId, songId);
            this.songsInPlaylist = await this.sqliteService.getSongsInPlaylist(this.selectedPlaylistId);
          }
        }
      ]
    });
  
    await alert.present();
  }

  async playPlaylist(playlistId: number) {
    const songs = await this.sqliteService.getSongsInPlaylist(playlistId);
    if (songs.length === 0) return;
  
    this.router.navigateByUrl('/tabs/tab3', {
      state: {
        playlistSongs: songs,
        playIndex: 0
      }
    });
  }

  playSongFromPlaylist(song: any) {
    if (!this.songsInPlaylist || this.songsInPlaylist.length === 0) return;
  
    const index = this.songsInPlaylist.findIndex(s => s.id === song.id);
  
    this.router.navigateByUrl('/tabs/tab3', {
      state: {
        playlistSongs: this.songsInPlaylist,
        playIndex: index
      }
    });
  }  
  
}
