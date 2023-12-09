import {Injectable} from '@angular/core';
import {Config} from '../../../common/config/public/Config';
import {Title} from '@angular/platform-browser';
import {GridMedia} from '../ui/gallery/grid/GridMedia';
import {SearchQueryParserService} from '../ui/gallery/search/search-query-parser.service';
import {SearchQueryDTO} from '../../../common/entities/SearchQueryDTO';

@Injectable({
  providedIn: 'root'
})
export class PiTitleService {

  private lastNonMedia: string = null;

  constructor(
      private titleService: Title,
      private searchQueryParserService: SearchQueryParserService) {
  }

  setTitle(title: string) {
    if (title) {
      this.titleService.setTitle(Config.Server.applicationTitle + ' - ' + title);
    } else {
      this.titleService.setTitle(Config.Server.applicationTitle);
    }
  }

  setSearchTitle(searchQuery: SearchQueryDTO | string) {
    let query: SearchQueryDTO = searchQuery as SearchQueryDTO;
    if (typeof searchQuery === 'string') {
      query = JSON.parse(searchQuery);
    }
    this.lastNonMedia = this.searchQueryParserService.stringify(query);
    this.setTitle(this.lastNonMedia);
  }

  setDirectoryTitle(path: string) {
    this.lastNonMedia = path;
    this.setTitle(this.lastNonMedia);
  }

  setMediaTitle(media: GridMedia) {
    this.setTitle(media.getReadableRelativePath());
  }

  setLastNonMedia() {
    if (this.lastNonMedia) {
      this.setTitle(this.lastNonMedia);
    }
  }
}
