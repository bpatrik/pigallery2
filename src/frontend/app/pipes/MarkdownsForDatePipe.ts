import {Pipe, PipeTransform} from '@angular/core';
import type {GroupedMarkdown} from '../ui/gallery/blog/blog.service';

/**
 * The markdowns of a date group. Without a date, the ones that go to the top.
 * Undefined while the markdowns are not loaded.
 */
export const filterMarkdownsByDate = (markdowns: GroupedMarkdown[], date: Date): GroupedMarkdown[] => {
  if (!markdowns) {
    return undefined;
  }
  if (!date) {
    return markdowns.filter(g => !g.date);
  }
  const utcDate = date.getTime();
  return markdowns.filter(g => g.date == utcDate);
};

@Pipe({
  name: 'markdownsForDate'
})
export class MarkdownsForDatePipe implements PipeTransform {
  transform(markdowns: GroupedMarkdown[], date: Date): GroupedMarkdown[] {
    return filterMarkdownsByDate(markdowns, date);
  }
}
