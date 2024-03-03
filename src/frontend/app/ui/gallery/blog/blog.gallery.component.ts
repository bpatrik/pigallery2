import {Component, EventEmitter, Input, Output,OnChanges} from '@angular/core';
import {BlogService, GroupedMarkdown} from './blog.service';
import {map, Observable} from 'rxjs';

@Component({
  selector: 'app-gallery-blog',
  templateUrl: './blog.gallery.component.html',
  styleUrls: ['./blog.gallery.component.css'],
})
export class GalleryBlogComponent implements OnChanges {
  @Input() open: boolean;
  @Input() date: Date;
  @Output() openChange = new EventEmitter<boolean>();
  public markdowns: string[] = [];
  mkObservable: Observable<GroupedMarkdown[]>;

  constructor(public blogService: BlogService) {
  }


  ngOnChanges(): void {
    const utcDate = this.date ? this.date.getTime() : undefined;
    this.mkObservable = this.blogService.groupedMarkdowns.pipe(map(gm => {
      if (!this.date) {
        return gm.filter(g => !g.date);
      }
      return gm.filter(g => g.date == utcDate);
    }));
  }


  toggleCollapsed(): void {
    this.open = !this.open;
    this.openChange.emit(this.open);
  }
}

