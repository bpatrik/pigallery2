import {Injectable} from '@angular/core';
import {NetworkService} from '../../../model/network/network.service';
import {type FileDTO} from '../../../../../common/entities/FileDTO';
import {Utils} from '../../../../../common/Utils';
import {ContentService} from '../content.service';
import {map, mergeMap, Observable, shareReplay} from 'rxjs';
import {MDFilesFilterPipe} from '../../../pipes/MDFilesFilterPipe';
import {type MDFileDTO} from '../../../../../common/entities/MDFileDTO';
import {Config} from '../../../../../common/config/public/Config';

@Injectable()
export class BlogService {
  public groupedMarkdowns: Observable<GroupedMarkdown[]>;
  private cache: { [key: string]: string } = {};

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

        const files = (this.mdFilesFilterPipe.transform(content.metaFile) || [])
          .map(f => this.splitMarkDown(f, dates, firstMedia));

        return (await Promise.all(files)).flat();
      }), shareReplay(1));
  }

  getMarkDowns(date: Date): Observable<GroupedMarkdown[]> {
    const utcDate = date ? date.getTime() : undefined;
    return this.groupedMarkdowns.pipe(map(gm => {
      if (!date) {
        return gm.filter(g => !g.date);
      }
      return gm.filter(g => g.date == utcDate);
    }));

  }

  /**
   * Loads a Markdown file from the server and caches it
   * @param file
   * @private
   */
  private async getMarkDown(file: FileDTO): Promise<string> {
    const filePath = Utils.concatUrls(
      file.directory.path,
      file.directory.name,
      file.name
    );
    if (!this.cache[filePath]) {
      this.cache[filePath] = await this.networkService.getText(
        '/gallery/content/' + filePath
      );
    }
    return this.cache[filePath];
  }

  /**
   * Splits a markdown file into date groups.
   *
   * Rules:
   * - If a MD part does not have a date tag (date=null), it goes to the top
   *   if file.date === firstMedia, then it goes if date groups are ascending.
   *   if descending, goes to the last date group
   * - If a MD part has a date tag, it goes to the closest date group.
   * - Date groups span a full day (UTC midnight to midnight).
   *
   * Example with date groups for ascending: [2025-02-01, 2025-02-03, 2025-02-04, 2025-02-10]
   * - MD part: no date → goes to null
   * - MD part: 2025-02-01 00:00 → goes to 2025-02-01
   * - MD part: 2025-02-02 00:00 → goes to 2025-02-01 (closest younger)
   * - MD part: 2025-02-03 00:00 → goes to 2025-02-03
   * - MD part: 2025-02-03 23:59 → goes to 2025-02-03
   * - MD part: 2025-02-04 00:00 → goes to 2025-02-04
   * Example with date groups for desc: [2025-02-10, 2025-02-04,2025-02-03, 2025-02-01]
   * - MD part: no date, first file date of the MD's folder  2025-02-01 → goes to 2025-02-01
   * - MD part: 2025-02-01 00:00 → goes to 2025-02-01
   * - MD part: 2025-02-02 00:00 → goes to 2025-02-02 (closest oldest)
   * - MD part: 2025-02-03 00:00 → goes to 2025-02-03
   * - MD part: 2025-02-03 23:59 → goes to 2025-02-03
   * - MD part: 2025-02-04 00:00 → goes to 2025-02-04
   *
   * @param file The markdown file to split
   * @param dates Array of date group timestamps (in milliseconds, UTC midnight)
   * @param firstMedia The timestamp of the first media in the current gallery view
   * @private
   */
  private async splitMarkDown(file: MDFileDTO, dates: number[], firstMedia: number): Promise<GroupedMarkdown[]> {
    const markdown = (await this.getMarkDown(file)).trim();

    if (!markdown) {
      return [];
    }

    // No date groups exist - return entire markdown with no date
    if (dates.length === 0) {
      return [{
        text: markdown,
        file: file,
        date: null,
        textShort: markdown.substring(0, 200)
      }];
    }

    // Keep dates in their original order from mediaGroups (respects sorting direction)

    // Parse markdown for date-tagged sections
    const sections = this.parseMarkdownSections(markdown);

    // No date tags found - treat entire markdown as one section
    if (sections.length === 1 && sections[0].date === null) {
      const beforeFirstMedia = file.date === firstMedia;
      return [{
        text: sections[0].text,
        file: file,
        textShort: sections[0].text.substring(0, 200),
        date: beforeFirstMedia ? null : this.findClosestDateGroup(file.date, dates)
      }];
    }

    // Group sections by date and concatenate sections with the same date group
    return this.groupSectionsByDate(sections, file, dates, firstMedia);
  }

  /**
   * Parses a markdown file into sections based on date tags.
   * Returns an array where each section has optional date and text content.
   *
   * @param markdown The raw markdown content
   * @private
   */
  private parseMarkdownSections(markdown: string): Array<{ date: Date | null; text: string }> {
    const splitterRgx = /^\s*<!--\s*@pg-date:?\s*\d{4}-\d{1,2}-\d{1,2}\s*-->/gim;
    const dateRgx = /\d{4}-\d{1,2}-\d{1,2}/;

    const matches = Array.from(markdown.matchAll(splitterRgx));

    if (matches.length === 0) {
      // No date tags - return entire markdown as one undated section
      return [{date: null, text: markdown.trim()}];
    }

    const sections: Array<{ date: Date | null; text: string }> = [];

    // Extract the section before the first date tag (if any)
    const preFirstTagText = markdown.substring(0, matches[0].index).trim();
    if (preFirstTagText) {
      sections.push({date: null, text: preFirstTagText});
    }

    // Extract each dated section
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const dateStr = match[0].match(dateRgx)?.[0];
      const sectionDate = dateStr ? new Date(dateStr) : null;

      // Get text from after the date tag to next match (or end of markdown)
      const startIdx = match.index! + match[0].length; // Start after the date tag
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : markdown.length;
      const sectionText = markdown.substring(startIdx, endIdx).trim();

      // Only add section if it has actual content (not just whitespace)
      if (sectionText) {
        sections.push({date: sectionDate, text: sectionText});
      }
    }

    return sections;
  }

  /**
   * Finds the closest date group on or BEFORE the given timestamp if dates are ascending OR AFTER if descending.
   * Works with both ascending and descending date arrays.
   *
   * @param timestamp The timestamp to find a date group for (in milliseconds)
   * @param dates Array of date group timestamps (in original order from mediaGroups)
   * @private
   */
  private findClosestDateGroup(timestamp: number, dates: number[]): number {
    const targetMidnight = Utils.makeUTCMidnight(new Date(timestamp), undefined).getTime();

    // Detect if dates are in ascending or descending order
    const isAscending = dates.length < 2 || dates[0] <= dates[dates.length - 1];

    let closestGroup = dates[dates.length - 1]; // if no date group found, return the last date group

    if (isAscending) {
      for (let i = 1; i < dates.length; i++) {
        if (dates[i] > targetMidnight) {
          closestGroup = dates[i - 1];
          break;
        }
      }
    } else {
      for (let i = 1; i < dates.length; i++) {
        if (dates[i] < targetMidnight) {
          closestGroup = dates[i - 1];
          break;
        }
      }
    }
    return closestGroup;
  }

  /**
   * Groups markdown sections by their appropriate date groups and concatenates
   * sections that belong to the same date group.
   *
   * @param sections Parsed markdown sections with optional dates
   * @param file The markdown file being processed
   * @param sortedDates Array of date group timestamps, sorted
   * @param firstMedia The timestamp of the first media in the current gallery view
   * @private
   */
  private groupSectionsByDate(
    sections: Array<{ date: Date | null; text: string }>,
    file: MDFileDTO,
    sortedDates: number[],
    firstMedia: number
  ): GroupedMarkdown[] {
    const grouped: GroupedMarkdown[] = [];
    const beforeFirstMedia = file.date === firstMedia;

    for (const section of sections) {
      let targetDateGroup: number | null;

      if (section.date === null) {
        // Undated section: goes to top (null) unless it's a search result
        targetDateGroup = beforeFirstMedia ? null : this.findClosestDateGroup(file.date, sortedDates);
      } else {
        // Dated section: find closest date group on or before this date
        targetDateGroup = this.findClosestDateGroup(section.date.getTime(), sortedDates);
      }

      // Try to find existing group with the same date and concatenate
      const existingGroup = grouped.find(g => g.date === targetDateGroup);
      if (existingGroup) {
        existingGroup.text += '\n\n' + section.text;
      } else {
        grouped.push({
          date: targetDateGroup,
          text: section.text,
          file: file
        });
      }
    }

    // Generate short text previews for all groups
    grouped.forEach(md => md.textShort = md.text.substring(0, 200));

    return grouped;
  }
}


export interface GroupedMarkdown {
  date: number | null;
  text: string;
  textShort?: string;
  file: FileDTO;
}
