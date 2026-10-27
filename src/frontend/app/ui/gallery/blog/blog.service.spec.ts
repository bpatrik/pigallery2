import {TestBed} from '@angular/core/testing';
import {BlogService, GroupedMarkdown} from './blog.service';
import {NetworkService} from '../../../model/network/network.service';
import {ContentService} from '../content.service';
import {MDFilesFilterPipe} from '../../../pipes/MDFilesFilterPipe';
import {of} from 'rxjs';
import {MDFileDTO} from '../../../../../common/entities/MDFileDTO';
import {DirectoryPathDTO} from '../../../../../common/entities/DirectoryDTO';

describe('BlogService', () => {
  let service: BlogService;
  let mockNetworkService: jasmine.SpyObj<NetworkService>;
  let mockGalleryService: jasmine.SpyObj<ContentService>;
  let mockMdFilesFilterPipe: jasmine.SpyObj<MDFilesFilterPipe>;

  const createMockDirectory = (path: string, name: string): DirectoryPathDTO => ({
    path: path,
    name: name
  } as DirectoryPathDTO);

  const createMockMDFile = (name: string, date: number, directory?: DirectoryPathDTO): MDFileDTO => ({
    id: 1,
    name: name,
    directory: directory || createMockDirectory('/test', 'folder'),
    date: date
  } as MDFileDTO);

  beforeEach(() => {
    mockNetworkService = jasmine.createSpyObj('NetworkService', ['getText']);
    mockGalleryService = jasmine.createSpyObj('ContentService', [], {
      sortedFilteredContent: of(null)
    });
    mockMdFilesFilterPipe = jasmine.createSpyObj('MDFilesFilterPipe', ['transform']);

    TestBed.configureTestingModule({
      providers: [
        BlogService,
        {provide: NetworkService, useValue: mockNetworkService},
        {provide: ContentService, useValue: mockGalleryService},
        {provide: MDFilesFilterPipe, useValue: mockMdFilesFilterPipe}
      ]
    });

    service = TestBed.inject(BlogService);
  });

  describe('splitMarkDown', () => {
    it('should return empty array for empty markdown', async () => {
      const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
      mockNetworkService.getText.and.returnValue(Promise.resolve(''));

      const result = await (service as any).splitMarkDown(file, [], 0);

      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only markdown', async () => {
      const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
      mockNetworkService.getText.and.returnValue(Promise.resolve('   \n\n  \t  \n  '));

      const result = await (service as any).splitMarkDown(file, [], 0);

      expect(result).toEqual([]);
    });

    it('should return entire markdown with date=null when no date groups exist', async () => {
      const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
      const markdown = '# Test Markdown\n\nSome content here.';
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, [], 0);

      expect(result.length).toBe(1);
      expect(result[0].text).toBe(markdown);
      expect(result[0].date).toBeNull();
      expect(result[0].file).toBe(file);
      expect(result[0].textShort).toBe(markdown.substring(0, 200));
    });

    it('should remove date tags and comments when no date groups exist', async () => {
      const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
      const markdown = '<!-- comment -->\n# Intro\n\n<!-- @pg-date 2025-02-01 -->\n## Day 1\n\nContent.';
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, [], 0);

      expect(result.length).toBe(1);
      expect(result[0].text).toBe('# Intro\n\n\n## Day 1\n\nContent.');
    });

    it('should return empty array for comment-only markdown', async () => {
      const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
      mockNetworkService.getText.and.returnValue(Promise.resolve('<!-- only a comment -->'));

      expect(await (service as any).splitMarkDown(file, [], 0)).toEqual([]);
      expect(await (service as any).splitMarkDown(file, [Date.UTC(2025, 1, 1)], 0)).toEqual([]);
    });

    it('should place undated markdown at top (date=null) when not a search result', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '# Test Markdown\n\nNo date tags here.';
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBeNull();
      expect(result[0].text).toBe(markdown);
    });

    it('should place undated markdown at first media date group when search result', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const fileDate = Date.UTC(2025, 1, 5);
      const file = createMockMDFile('test.md', fileDate);
      const markdown = '# Test Markdown\n\nNo date tags here.';
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 5));
      expect(result[0].text).toBe(markdown);
    });

    it('should assign dated section to exact matching date group', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '<!-- @pg-date 2025-02-03 -->\n## Day 1\n\nContent for Feb 3rd.';
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 3)); // Feb 3rd matches exactly
    });

    it('should assign dated section to closest younger date group', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '<!-- @pg-date 2025-02-02 -->\n## Day 1\n\nContent for Feb 2nd.';
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1)); // Feb 2nd → Feb 1st (closest younger)
    });

    it('should handle multiple dated sections', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = `<!-- @pg-date 2025-02-01 -->
## Day 1
Content for Feb 1st.

<!-- @pg-date 2025-02-03 -->
## Day 2
Content for Feb 3rd.`;
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(2);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1));
      expect(result[0].text).toContain('Day 1');
      expect(result[1].date).toBe(Date.UTC(2025, 1, 3));
      expect(result[1].text).toContain('Day 2');
    });

    it('should concatenate sections with same date group', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = `<!-- @pg-date 2025-02-01 -->
## Part 1
First part.

<!-- @pg-date 2025-02-02 -->
## Part 2
Second part (goes to Feb 1).`;
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 5)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1));
      expect(result[0].text).toContain('Part 1');
      expect(result[0].text).toContain('Part 2');
    });

    it('should handle mixed undated and dated sections', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = `# Intro
This is undated.

<!-- @pg-date 2025-02-03 -->
## Day 1
This is dated.`;
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(2);
      expect(result[0].date).toBeNull(); // Undated section goes to top
      expect(result[0].text).toContain('Intro');
      expect(result[1].date).toBe(Date.UTC(2025, 1, 3));
      expect(result[1].text).toContain('Day 1');
    });

    it('should handle date tag with colon syntax', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '<!-- @pg-date: 2025-02-01 -->\n## Day 1\n\nContent.';
      const dates = [Date.UTC(2025, 1, 1)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1));
    });

    it('should handle whitespace variations in date tags', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '  <!--   @pg-date   2025-02-01   -->  \n## Day 1\n\nContent.';
      const dates = [Date.UTC(2025, 1, 1)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1));
    });

    it('should generate textShort preview for all sections', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const longText = 'A'.repeat(300);
      const markdown = `<!-- @pg-date 2025-02-01 -->\n${longText}`;
      const dates = [Date.UTC(2025, 1, 1)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result[0].textShort).toBe(result[0].text.substring(0, 200));
      expect(result[0].textShort.length).toBe(200);
    });

    it('should handle dates in different day of same group correctly', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '<!-- @pg-date 2025-02-03 -->\n## Content at 23:59\n\nLate in the day.';
      const dates = [Date.UTC(2025, 1, 3)];
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 3)); // Same day group
    });

    it('should handle dates in original order (ascending)', async () => {
      const firstMedia = Date.UTC(2025, 1, 1);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '<!-- @pg-date 2025-02-02 -->\n## Content\n\nTest.';
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)]; // Ascending
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result[0].date).toBe(Date.UTC(2025, 1, 1)); // Should find closest correctly
    });

    it('should handle dates in descending order', async () => {
      const firstMedia = Date.UTC(2025, 1, 5);
      const file = createMockMDFile('test.md', firstMedia);
      const markdown = '<!-- @pg-date 2025-02-02 -->\n## Content\n\nTest.';
      const dates = [Date.UTC(2025, 1, 5), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 1)]; // Descending
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      const result = await (service as any).splitMarkDown(file, dates, firstMedia);

      expect(result[0].date).toBe(Date.UTC(2025, 1, 3)); // Feb 2nd → Feb 3rd (closest after in descending)
    });
  });

  describe('parseMarkdownSections', () => {
    it('should return single section for markdown without date tags', () => {
      const markdown = '# Test\n\nNo dates here.';
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections.length).toBe(1);
      expect(sections[0].date).toBeNull();
      expect(sections[0].text).toBe(markdown);
    });

    it('should parse markdown with one date tag', () => {
      const markdown = '<!-- @pg-date 2025-02-01 -->\n## Day 1\n\nContent.';
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections.length).toBe(1);
      expect(sections[0].date).toEqual(new Date('2025-02-01'));
      expect(sections[0].text).toContain('Day 1');
    });

    it('should parse markdown with undated section before first date tag', () => {
      const markdown = '# Intro\n\nUndated.\n\n<!-- @pg-date 2025-02-01 -->\n## Day 1\n\nDated.';
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections.length).toBe(2);
      expect(sections[0].date).toBeNull();
      expect(sections[0].text).toContain('Intro');
      expect(sections[1].date).toEqual(new Date('2025-02-01'));
      expect(sections[1].text).toContain('Day 1');
    });

    it('should parse markdown with multiple date tags', () => {
      const markdown = `<!-- @pg-date 2025-02-01 -->
## Day 1

<!-- @pg-date 2025-02-03 -->
## Day 2`;
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections.length).toBe(2);
      expect(sections[0].date).toEqual(new Date('2025-02-01'));
      expect(sections[1].date).toEqual(new Date('2025-02-03'));
    });

    it('should handle empty sections gracefully', () => {
      const markdown = '<!-- @pg-date 2025-02-01 -->\n\n\n<!-- @pg-date 2025-02-02 -->\n## Content';
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections.length).toBe(1); // Empty sections are filtered out
      expect(sections[0].text).toBe('## Content');
      expect(sections[0].date).toEqual(new Date('2025-02-02'));
    });

    it('should trim whitespace from sections', () => {
      const markdown = '   \n\n# Content\n\n   ';
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections[0].text).toBe('# Content');
    });

    it('should handle malformed date tag gracefully', () => {
      const markdown = '<!-- @pg-date invalid-date -->\n## Content\n\nSome text.';
      const sections = (service as any).parseMarkdownSections(markdown);

      // Tag doesn't match the date regex, so it's treated as regular markdown
      expect(sections.length).toBe(1);
      expect(sections[0].date).toBeNull();
      expect(sections[0].text).toContain('Content');
    });

    it('should remove standalone comments but keep comments inside text', () => {
      const markdown = '<!-- comment -->\n# Intro\n<!-- multi\nline -->\nUse `<!-- @pg-date <ISO_DATE> -->` tags.\n' +
        '<!-- @pg-date 2025-02-01 -->\n<!-- another -->  \n## Day 1';
      const sections = (service as any).parseMarkdownSections(markdown);

      expect(sections.length).toBe(2);
      expect(sections[0].text).toBe('# Intro\n\nUse `<!-- @pg-date <ISO_DATE> -->` tags.');
      expect(sections[1].text).toBe('## Day 1');
    });
  });

  describe('findClosestDateGroup', () => {
    it('should find exact matching date group', () => {
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      const timestamp = Date.UTC(2025, 1, 3);

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 3));
    });

    it('should find closest younger date group', () => {
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      const timestamp = Date.UTC(2025, 1, 2); // Feb 2nd

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 1)); // Feb 1st is closest younger
    });

    it('should return last date group for dates older than all groups', () => {
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      const timestamp = Date.UTC(2025, 0, 1); // Jan 1st, before all groups

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 1)); // First group (default to last in array, which is dates[dates.length-1] after no match)
    });

    it('should return last date group for dates newer than all groups', () => {
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 5)];
      const timestamp = Date.UTC(2025, 1, 10); // Feb 10th, after all groups

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 5)); // Last group
    });

    it('should handle single date group', () => {
      const dates = [Date.UTC(2025, 1, 1)];
      const timestamp = Date.UTC(2025, 1, 5);

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 1));
    });

    it('should handle two date groups in ascending order', () => {
      const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 5)];
      const timestamp = Date.UTC(2025, 1, 3); // Between the two dates

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 1)); // Closest younger
    });

    it('should handle two date groups in descending order', () => {
      const dates = [Date.UTC(2025, 1, 5), Date.UTC(2025, 1, 1)];
      const timestamp = Date.UTC(2025, 1, 3); // Between the two dates

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 5)); // Closest after in descending
    });

    it('should find exact matching date group in descending order', () => {
      const dates = [Date.UTC(2025, 1, 5), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 1)];
      const timestamp = Date.UTC(2025, 1, 3);

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 3));
    });

    it('should find closest younger date group in descending order', () => {
      const dates = [Date.UTC(2025, 1, 5), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 1)];
      const timestamp = Date.UTC(2025, 1, 2); // Feb 2nd

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 3)); // Feb 3rd is closest after in descending
    });

    it('should return last date group for dates older than all groups in descending order', () => {
      const dates = [Date.UTC(2025, 1, 5), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 1)];
      const timestamp = Date.UTC(2025, 0, 1); // Jan 1st, before all groups

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 1)); // Last group (oldest in descending)
    });

    it('should return last date group for dates newer than all groups in descending order', () => {
      const dates = [Date.UTC(2025, 1, 5), Date.UTC(2025, 1, 3), Date.UTC(2025, 1, 1)];
      const timestamp = Date.UTC(2025, 1, 10); // Feb 10th, after all groups

      const result = (service as any).findClosestDateGroup(timestamp, dates);

      expect(result).toBe(Date.UTC(2025, 1, 5)); // First group in descending (newest)
    });
  });

  describe('groupSectionsByDate', () => {
    const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
    const dates = [Date.UTC(2025, 1, 1), Date.UTC(2025, 1, 3)];

    it('should place undated section at top when not search result', () => {
      const sections: Array<{ date: Date | null; text: string }> = [{date: null, text: '# Test'}];
      const firstMedia = Date.UTC(2025, 1, 1);

      const result = (service as any).groupSectionsByDate(sections, file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBeNull();
    });

    it('should place undated section at file date group when search result', () => {
      const sections: Array<{ date: Date | null; text: string }> = [{date: null, text: '# Test'}];
      const firstMedia = Date.UTC(2025, 0, 1); // Different from file.date

      const result = (service as any).groupSectionsByDate(sections, file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1));
    });

    it('should assign dated sections to correct date groups', () => {
      const sections = [
        {date: new Date('2025-02-01'), text: '# Day 1'},
        {date: new Date('2025-02-03'), text: '# Day 2'}
      ];
      const firstMedia = Date.UTC(2025, 1, 1);

      const result = (service as any).groupSectionsByDate(sections, file, dates, firstMedia);

      expect(result.length).toBe(2);
      expect(result[0].date).toBe(Date.UTC(2025, 1, 1));
      expect(result[1].date).toBe(Date.UTC(2025, 1, 3));
    });

    it('should concatenate sections with same date group', () => {
      const sections = [
        {date: new Date('2025-02-01'), text: '# Part 1'},
        {date: new Date('2025-02-01'), text: '# Part 2'}
      ];
      const firstMedia = Date.UTC(2025, 1, 1);

      const result = (service as any).groupSectionsByDate(sections, file, dates, firstMedia);

      expect(result.length).toBe(1);
      expect(result[0].text).toContain('Part 1');
      expect(result[0].text).toContain('Part 2');
      expect(result[0].text).toContain('\n\n'); // Concatenated with double newline
    });

    it('should generate textShort for all groups', () => {
      const longText = 'A'.repeat(300);
      const sections = [{date: new Date('2025-02-01'), text: longText}];
      const firstMedia = Date.UTC(2025, 1, 1);

      const result = (service as any).groupSectionsByDate(sections, file, dates, firstMedia);

      expect(result[0].textShort).toBe(longText.substring(0, 200));
    });
  });

  describe('getMarkDown caching', () => {
    it('should cache markdown content', async () => {
      const file = createMockMDFile('test.md', Date.UTC(2025, 1, 1));
      const markdown = '# Test Content';
      mockNetworkService.getText.and.returnValue(Promise.resolve(markdown));

      await (service as any).getMarkDown(file);
      await (service as any).getMarkDown(file);

      expect(mockNetworkService.getText).toHaveBeenCalledTimes(1);
    });

    it('should build correct file path', async () => {
      const directory = createMockDirectory('/photos/2025', 'vacation');
      const file = createMockMDFile('index.md', Date.UTC(2025, 1, 1), directory);
      mockNetworkService.getText.and.returnValue(Promise.resolve('# Test'));

      await (service as any).getMarkDown(file);

      expect(mockNetworkService.getText).toHaveBeenCalledWith('/gallery/content//photos/2025/vacation/index.md');
    });
  });
});
