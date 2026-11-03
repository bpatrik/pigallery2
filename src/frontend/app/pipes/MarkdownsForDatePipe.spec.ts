import {MarkdownsForDatePipe} from './MarkdownsForDatePipe';
import {GroupedMarkdown} from '../ui/gallery/blog/blog.service';

describe('MarkdownsForDatePipe', () => {
  const pipe = new MarkdownsForDatePipe();
  const day = new Date(Date.UTC(2023, 6, 15));
  const top = {date: null, text: '# Nyári túra'} as GroupedMarkdown;
  const ofDay = {date: day.getTime(), text: '## Balatonfüred, július 15.'} as GroupedMarkdown;
  const other = {date: day.getTime() + 86400000, text: '## Tihany'} as GroupedMarkdown;

  it('should return the markdowns of the date', () => {
    expect(pipe.transform([top, ofDay, other], new Date(day.getTime()))).toEqual([ofDay]);
  });

  it('should return the markdowns without a date when there is no date', () => {
    expect(pipe.transform([top, ofDay, other], null)).toEqual([top]);
  });

  it('should return undefined while the markdowns are not loaded', () => {
    expect(pipe.transform(undefined, day)).toBeUndefined();
  });
});
