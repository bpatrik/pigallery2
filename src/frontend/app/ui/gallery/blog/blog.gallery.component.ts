import { Component, Input, OnChanges, inject, input, output } from '@angular/core';
import {BlogService, GroupedMarkdown} from './blog.service';
import {map, Observable} from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { MarkdownComponent } from 'ngx-markdown';
import { NgIconComponent } from '@ng-icons/core';
import { FileDTOToRelativePathPipe } from '../../../pipes/FileDTOToRelativePathPipe';

@Component({
    selector: 'app-gallery-blog',
    templateUrl: './blog.gallery.component.html',
    styleUrl: './blog.gallery.component.css',
    imports: [
    MarkdownComponent,
    NgIconComponent,
    AsyncPipe,
    FileDTOToRelativePathPipe
]
})
export class GalleryBlogComponent implements OnChanges {
  blogService = inject(BlogService);

  // TODO: Skipped for migration because:
  //  Your application code writes to the input. This prevents migration.
  @Input() open: boolean;
  /**
   * Blog is inserted to the top (when date is null) and to all date groups, when date is set
   */
  readonly date = input<Date>(undefined);
  readonly openChange = output<boolean>();
  mkObservable: Observable<GroupedMarkdown[]>;


  ngOnChanges(): void {
    this.mkObservable = this.blogService.getMarkDowns(this.date());
  }


  toggleCollapsed(): void {
    this.open = !this.open;
    this.openChange.emit(this.open);
  }
}

