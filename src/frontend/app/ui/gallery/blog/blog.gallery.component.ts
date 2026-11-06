import {Component, computed, inject, input, model} from '@angular/core';
import {BlogService, GroupedMarkdown} from './blog.service';
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
    FileDTOToRelativePathPipe
]
})
export class GalleryBlogComponent {
  blogService = inject(BlogService);

  readonly open = model<boolean>(false);
  /**
   * Blog is inserted to the top (when date is null) and to all date groups, when date is set
   */
  readonly date = input<Date>();
  readonly markdowns = computed((): GroupedMarkdown[] | undefined => this.blogService.getMarkDowns(this.date()));


  toggleCollapsed(): void {
    this.open.update(open => !open);
  }
}

