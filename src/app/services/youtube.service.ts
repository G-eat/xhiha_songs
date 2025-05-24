import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment'; 

@Injectable({
  providedIn: 'root'
})
export class YoutubeService {
  private apiKey = environment.youtubeApiKey;
  private apiUrl = 'https://www.googleapis.com/youtube/v3/search';

  constructor(private http: HttpClient) {}

  searchVideos(query: string, pageToken: string = ''): Observable<any> {
    const params = new HttpParams()
      .set('part', 'snippet')
      .set('q', query)
      .set('type', 'video')
      .set('key', this.apiKey)
      .set('maxResults', '100');
  
    return this.http.get(this.apiUrl, { params });
  }
  
}
