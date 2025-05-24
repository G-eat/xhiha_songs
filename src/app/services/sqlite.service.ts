import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

@Injectable({
  providedIn: 'root'
})
export class SqliteService {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  db: SQLiteDBConnection | null = null;

  async initDB() {
    this.db = await this.sqlite.createConnection('musicdb', false, 'no-encryption', 1, false);
    await this.db.open();
    await this.db.execute(`CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      path TEXT,
      thumbnail TEXT
    )`);
    
    await this.db.execute(`CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )`);
  
    await this.db.execute(`CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id),
      FOREIGN KEY (song_id) REFERENCES songs(id)
    )`);
  }

  async saveSong(title: string, path: string, thumbnail: string) {
    if (!this.db) await this.initDB();
    if (this.db) {
      await this.db.run(
        'INSERT INTO songs (title, path, thumbnail) VALUES (?, ?, ?)',
        [title, path, thumbnail]
      );
    }
  }

  async songExists(path: string): Promise<boolean> {
    if (!this.db) await this.initDB();
    if (this.db) {
      const result = await this.db.query('SELECT COUNT(*) as count FROM songs WHERE path LIKE ?', [`%${path}`]);
      return result.values?.[0]?.count > 0;
    }

    return false;
  }  

  async deleteSongByTitle(title: string) {
    if (!this.db) await this.initDB();
    if (this.db) {
      await this.db.run('DELETE FROM songs WHERE title = ?', [title]);
    }
  }

  async getSongs(): Promise<{ title: string; path: string }[]> {
    if (!this.db) {
      await this.initDB();
    }
  
    if (this.db) {
      const res = await this.db.query('SELECT * FROM songs');
      return res.values ?? [];
    }
  
    return [];
  }

  async createPlaylist(name: string) {
    if (!this.db) await this.initDB();
    await this.db?.run('INSERT INTO playlists (name) VALUES (?)', [name]);
  }
  
  async getPlaylists(): Promise<{ id: number; name: string }[]> {
    if (!this.db) await this.initDB();
    const res = await this.db?.query('SELECT * FROM playlists');
    return res?.values ?? [];
  }
  
  async addSongToPlaylist(playlistId: number, songId: number) {
    if (!this.db) await this.initDB();
    await this.db?.run(
      'INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)',
      [playlistId, songId]
    );
  }

  async getSongsInPlaylist(playlistId: number): Promise<any[]> {
    if (!this.db) await this.initDB();
    const res = await this.db?.query(`
      SELECT s.* FROM songs s
      JOIN playlist_songs ps ON s.id = ps.song_id
      WHERE ps.playlist_id = ?`, [playlistId]);
    return res?.values ?? [];
  }

  async deletePlaylist(playlistId: number): Promise<void> {
    if (!this.db) await this.initDB();
  
    // Delete all related entries from playlist_songs first
    await this.db?.run('DELETE FROM playlist_songs WHERE playlist_id = ?', [playlistId]);
  
    // Then delete the playlist itself
    await this.db?.run('DELETE FROM playlists WHERE id = ?', [playlistId]);
  }
  
  async getPlaylistIdsForSong(songId: number): Promise<number[]> {
    if (!this.db) await this.initDB();
    const res = await this.db?.query('SELECT playlist_id FROM playlist_songs WHERE song_id = ?', [songId]);
    return res?.values?.map(row => row.playlist_id) ?? [];
  }
  
  async removeSongFromPlaylist(playlistId: number, songId: number) {
    if (!this.db) await this.initDB();
    await this.db?.run('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?', [playlistId, songId]);
  }
  
  
}
