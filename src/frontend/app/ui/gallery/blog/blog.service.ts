import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {FileDTO} from '../../../../../common/entities/FileDTO';
import {Utils} from '../../../../../common/Utils';
import {ContentService} from '../content.service';
import {mergeMap, Observable, shareReplay} from 'rxjs';
import {MDFilesFilterPipe} from '../../../pipes/MDFilesFilterPipe';
import {MDFileDTO} from '../../../../../common/entities/MDFileDTO';
import {Config} from '../../../../../common/config/public/Config';

@Injectable()
export class BlogService {
  cache: { [key: string]: Promise<string> | string } = {};
  public groupedMarkdowns: Observable<GroupedMarkdown[]>;

  constructor(private networkService: NetworkService,
              private galleryService: ContentService,
              private mdFilesFilterPipe: MDFilesFilterPipe) {

    this.groupedMarkdowns = this.galleryService.sortedFilteredContent.pipe(
      mergeMap(async content => {
        if (!content) {
          return [];
        }
        const dates = content.mediaGroups.map(g => g.date)
          .filter(d => !!d).map(d => d.getTime());


        let firstMedia = Number.MAX_SAFE_INTEGER;
        if (content.mediaGroups.length > 0) {
          firstMedia = content.mediaGroups[0].media.reduce((p, m) =>
            Math.min(Utils.getTimeMS(m.metadata.creationDate, m.metadata.creationDateOffset, Config.Gallery.ignoreTimestampOffset), p), Number.MAX_SAFE_INTEGER);
        }

        const files = this.mdFilesFilterPipe.transform(content.metaFile)
          .map(f => this.splitMarkDown(f, dates, firstMedia));

        return (await Promise.all(files)).flat();
      }), shareReplay(1));
  }

  private async splitMarkDown(file: MDFileDTO, dates: number[], firstMedia: number): Promise<GroupedMarkdown[]> {
    const markdown = (await this.getMarkDown(file)).trim();

    if (!markdown) {
      return [];
    }

    // there is no date group by
    if (dates.length == 0) {
      return [{
        text: markdown,
        file: file,
        date: null,
        textShort: markdown.substring(0, 200)
      }];
    }

    dates.sort();

    const splitterRgx = new RegExp(/^\s*<!--\s*@pg-date:?\s*\d{4}-\d{1,2}-\d{1,2}\s*-->/, 'gim');
    const dateRgx = new RegExp(/\d{4}-\d{1,2}-\d{1,2}/);

    const ret: GroupedMarkdown[] = [];
    const matches = Array.from(markdown.matchAll(splitterRgx));

    const getDateGroup = (date: Date) => {
      // get UTC midnight date
      const dateNum = Utils.makeUTCMidnight(date, undefined).getTime();
      let groupDate = dates.find((d, i) => i > dates.length - 1 ? false : dates[i + 1] > dateNum);   //dates are sorted

      // cant find the date. put to the last group (as it was later)
      if (groupDate === undefined) {
        groupDate = dates[dates.length - 1];
      }
      return groupDate;
    };

    // There is no splits
    if (matches.length == 0) {
      return [{
        text: markdown,
        file: file,
        textShort: markdown.substring(0, 200),
        date: getDateGroup(new Date(file.date))
      }];
    }


    const baseText = markdown.substring(0, matches[0].index).trim();

    // don't show empty
    if (baseText) {
      if (file.date === firstMedia) {
        ret.push({
          text: baseText,
          file: file,
          date: null
        });
      } else {
        ret.push({
          text: baseText,
          file: file,
          date: getDateGroup(new Date(file.date))
        });
      }
    }

    for (let i = 0; i < matches.length; ++i) {
      const matchedStr = matches[i][0];
      const dateNum = new Date(matchedStr.match(dateRgx)[0]);

      const groupDate = getDateGroup(dateNum);

      const text = (i + 1 >= matches.length ? markdown.substring(matches[i].index) : markdown.substring(matches[i].index, matches[i + 1].index)).trim();

      // don't show empty
      if (!text) {
        continue;
      }
      // if it would be in the same group. Concatenate it
      const sameGroup = ret.find(g => g.date == groupDate);
      if (sameGroup) {
        sameGroup.text += text;
        continue;
      }
      ret.push({
        date: groupDate,
        text: text,
        file: file
      });
    }

    ret.forEach(md => md.textShort = md.text.substring(0, 200));
    return ret;
  }

  public getMarkDown(file: FileDTO): Promise<string> {
    const filePath = Utils.concatUrls(
      file.directory.path,
      file.directory.name,
      file.name
    );
    if (!this.cache[filePath]) {
      this.cache[filePath] = this.networkService.getText(
        '/gallery/content/' + filePath
      );
      (this.cache[filePath] as Promise<string>).then((val: string) => {
        this.cache[filePath] = val;
      });
    }
    return Promise.resolve(this.cache[filePath]);
  }
}


export interface GroupedMarkdown {
  date: number | null;
  text: string;
  textShort?: string;
  file: FileDTO;
}
