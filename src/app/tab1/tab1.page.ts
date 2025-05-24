import { Component, OnInit } from '@angular/core';
import { YoutubeService } from '../services/youtube.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { SqliteService } from '../services/sqlite.service';
import { LoadingController } from '@ionic/angular';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs'; // Add this

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit {
  searchQuery = '';
  videos: any[] = [];
  private searchSubject = new Subject<string>();

  constructor(private youtubeService: YoutubeService, private http: HttpClient, private sqliteService: SqliteService, private loadingCtrl: LoadingController, private toastCtrl: ToastController) {}

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(1000), // wait 2 seconds
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.length > 2) {
        this.youtubeService.searchVideos(query).subscribe((res: any) => {
          this.videos = res.items;
        });
      }
    });
  }

  onSearch() {
    this.searchSubject.next(this.searchQuery);
  }

  async download(videoId: string) {
    const loading = await this.loadingCtrl.create({
      message: 'Downloading...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const fileName = `${videoId}.mp3`;

      const exists = await this.sqliteService.songExists(fileName);
      if (exists) {
        this.showToast('Already downloaded ❌');
        return;
      }
  
      const url = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
      const headers = new HttpHeaders({
        'X-RapidAPI-Key': environment.mp3DownloadApi,
        'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com',
      });
  
      const res: any = await firstValueFrom(this.http.get(url, { headers }));
      const mp3Url = res.link;
  
      const blob = await firstValueFrom(this.http.get(mp3Url, { responseType: 'blob' }));
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = this.arrayBufferToBase64(arrayBuffer);
  
      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });
  
      const result = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Documents
      });
  
      const video = this.videos.find(v => v.id.videoId === videoId);
      const title = video?.snippet.title ?? videoId;
      const thumbnail = video?.snippet.thumbnails?.default?.url ?? '';
  
      await this.sqliteService.saveSong(title, result.uri, thumbnail);
  
      this.showToast('Saved successfully ✅');
    } catch (error) {
      console.error('Download failed:', error);
      this.showToast('Download failed ❌');
    } finally {
      loading.dismiss(); // ✅ always dismiss
    }
  }
  
  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: message.includes('✅') ? 'success' : 'danger',
      position: 'bottom'
    });
    toast.present();
  }
  
  
  arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }
}
