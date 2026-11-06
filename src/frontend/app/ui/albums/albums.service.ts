import { Injectable, inject, signal } from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {AlbumBaseDTO} from '../../../../common/entities/album/AlbumBaseDTO';
import {SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';

@Injectable({providedIn: 'root'})
export class AlbumsService {
  private networkService = inject(NetworkService);

  public readonly albums = signal<AlbumBaseDTO[] | null>(null);

  public async getAlbums(): Promise<void> {
    this.albums.set(
        (await this.networkService.getJson<AlbumBaseDTO[]>('/albums')).sort(
            (a, b): number => a.name.localeCompare(b.name)
        )
    );
  }

  async deleteAlbum(album: AlbumBaseDTO): Promise<void> {
    await this.networkService.deleteJson('/albums/' + album.id);
    await this.getAlbums();
  }

  async addSavedSearch(
      name: string,
      searchQuery: SearchQueryDTO
  ): Promise<void> {
    await this.networkService.putJson('/albums/saved-searches', {
      name,
      searchQuery,
    });
    await this.getAlbums();
  }
}
