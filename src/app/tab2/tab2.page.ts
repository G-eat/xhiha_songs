import { Component, OnInit } from '@angular/core';
import { SqliteService } from '../services/sqlite.service';
import { Media, MediaObject } from '@awesome-cordova-plugins/media/ngx';
import { Router } from '@angular/router';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {
  songs: { title: string; path: string; thumbnail?: string }[] = [];
  currentAudio: MediaObject | null = null;
  searchQuery = '';
  filteredSongs: any[] = [];

  constructor(private sqliteService: SqliteService, private media: Media, private router: Router, private alertCtrl: AlertController, private toastCtrl: ToastController) {}

  async ionViewWillEnter() {
    this.songs = await this.sqliteService.getSongs();
    this.filteredSongs = this.songs;
    this.searchQuery = '';
  }

  onSearchChange(event: any) {
    const query = event.detail.value.toLowerCase();
    this.filteredSongs = this.songs.filter(song =>
      song.title.toLowerCase().includes(query)
    );
  }

  playSong(path: string) {
    
    // Stop current song if playing
    if (this.currentAudio) {
      this.currentAudio.stop();
      this.currentAudio.release();
    }

    // Create new song and play
    this.currentAudio = this.media.create(path);
    this.currentAudio.play();
  }

  openInPlayer(song: any) {
    this.router.navigateByUrl('/tabs/tab3', { state: { song } });
  }

  async deleteSong(song: { title: string; path: string; thumbnail?: string }) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Song',
      message: `Are you sure you want to delete ->${song.title}<-"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.sqliteService.deleteSongByTitle(song.title);
              this.songs = this.songs.filter(s => s.title !== song.title);
              this.filteredSongs = this.songs;
              this.searchQuery = '';
              
              const fileName = song.path.split('/').pop();
  
              await Filesystem.deleteFile({
                path: fileName!,
                directory: Directory.Documents
              });
  
              const toast = await this.toastCtrl.create({
                message: 'Song deleted',
                duration: 1500,
                color: 'danger',
                position: 'bottom'
              });
              toast.present();
            } catch (error) {
              console.error('Delete failed:', error);
            }
          }
        }
      ]
    });
  
    await alert.present();
  }

  async openPlaylistSelector(song: any) {
    const playlists = await this.sqliteService.getPlaylists();
    const linked = await this.sqliteService.getPlaylistIdsForSong(song.id); // returns number[]
  
    const alert = await this.alertCtrl.create({
      header: 'Manage Playlists',
      inputs: playlists.map(p => ({
        type: 'checkbox',
        label: p.name,
        value: p.id,
        checked: linked.includes(p.id)
      })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (selectedIds: number[]) => {
            const toAdd = selectedIds.filter(id => !linked.includes(id));
            const toRemove = linked.filter(id => !selectedIds.includes(id));
  
            for (const id of toAdd) {
              await this.sqliteService.addSongToPlaylist(id, song.id);
            }
  
            for (const id of toRemove) {
              await this.sqliteService.removeSongFromPlaylist(id, song.id);
            }
          }
        }
      ]
    });
  
    await alert.present();
  }
  
}
