import { Component, OnInit, inject, computed, DestroyRef, signal } from '@angular/core';
import {DuplicateService} from './duplicates.service';
import {Utils} from '../../../../common/Utils';
import {QueryService} from '../../model/query.service';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';
import {DirectoryPathDTO} from '../../../../common/entities/DirectoryDTO';
import {Config} from '../../../../common/config/public/Config';
import {PageHelper} from '../../model/page.helper';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {PiTitleService} from '../../model/pi-title.service';
import { FrameComponent } from '../frame/frame.component';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DuplicatesPhotoComponent } from './photo/photo.duplicates.component';
import { FileSizePipe } from '../../pipes/FileSizePipe';

// a duplicate media with the path of its directory
interface DuplicateMedia {
  media: MediaDTO;
  directoryPath: string;
}

interface GroupedDuplicate {
  name: string;
  duplicates: { media: DuplicateMedia[] }[];
}

@Component({
    selector: 'app-duplicate',
    host: {
      '(window:scroll)': 'onScroll()'
    },
    templateUrl: './duplicates.component.html',
    styleUrl: './duplicates.component.css',
    imports: [
    FrameComponent,
    RouterLink,
    DuplicatesPhotoComponent,
    DatePipe,
    FileSizePipe
]
})
export class DuplicateComponent implements OnInit {
  duplicateService = inject(DuplicateService);
  queryService = inject(QueryService);
  private piTitleService = inject(PiTitleService);

  readonly directoryGroups = computed((): GroupedDuplicate[] => {
    let duplicates = this.duplicateService.duplicates();
    const groups: GroupedDuplicate[] = [];
    if (duplicates === null) {
      return groups;
    }
    const getMostFrequentDir = (
        dupls: DuplicatesDTO[]
    ): DirectoryPathDTO | null => {
      if (dupls.length === 0) {
        return null;
      }
      const dirFrequency: Record<string, { count: number; dir: DirectoryPathDTO }> = {};
      dupls.forEach((d): void =>
          d.media.forEach((m): void => {
            const k = Utils.concatUrls(m.directory.path, m.directory.name);
            dirFrequency[k] = dirFrequency[k] || {
              dir: m.directory,
              count: 0,
            };
            dirFrequency[k].count++;
          })
      );
      let max: { count: number; dir: DirectoryPathDTO | null } = {
        count: -1,
        dir: null,
      };
      for (const freq of Object.values(dirFrequency)) {
        if (max.count <= freq.count) {
          max = freq;
        }
      }
      return max.dir;
    };

    while (duplicates.length > 0) {
      const dir = getMostFrequentDir(duplicates)!; // duplicates is not empty and every group has media
      const group = duplicates.filter(
          (d): boolean =>
              !!d.media.find(
                  (m): boolean =>
                      m.directory.name === dir.name && m.directory.path === dir.path
              )
      );
      duplicates = duplicates.filter(
          (d): boolean =>
              !d.media.find(
                  (m): boolean =>
                      m.directory.name === dir.name && m.directory.path === dir.path
              )
      );
      groups.push({
        name: this.getDirectoryPath(dir) + ' (' + group.length + ')',
        duplicates: group.map(d => ({
          media: d.media.map(m => ({media: m, directoryPath: this.getDirectoryPath(m.directory)}))
        })),
      });
    }
    return groups;
  });
  // grows while rendering; its groups and pair lists are pushed to in place, so it is set to a new array after each step
  readonly renderedDirGroups = signal<GroupedDuplicate[] | null>(null);
  renderedIndex = {
    group: -1,
    pairs: 0,
  };
  renderTimer: number | null = null;
  readonly duplicateCount = computed(() => {
    const duplicates = this.duplicateService.duplicates();
    return {
      pairs: duplicates?.length ?? 0,
      photos: duplicates?.reduce(
          (prev: number, curr): number => prev + curr.media.length,
          0
      ) ?? 0,
    };
  });
  private destroyed = false;

  constructor() {
    this.startRendering();
    this.duplicateService.getDuplicates()
        .then(() => this.startRendering())
        .catch(console.error);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.renderTimer !== null) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
    });
  }

  ngOnInit(): void {
    this.piTitleService.setTitle($localize`Duplicates`);
  }

  /**
   * Restarts the progressive rendering with the current duplicates.
   */
  private startRendering(): void {
    if (this.destroyed) {
      return;
    }
    this.renderedIndex = {group: -1, pairs: 0};
    this.renderedDirGroups.set([]);
    if (this.duplicateService.duplicates() === null) {
      return;
    }
    this.renderMore();
  }

  getDirectoryPath(directory: DirectoryPathDTO): string {
    return Utils.concatUrls(directory.path, directory.name);
  }

  renderMore = (): void => {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }

    if (this.directoryGroups().length === 0) {
      return;
    }

    if (
        this.renderedIndex.group === this.directoryGroups().length - 1 &&
        this.renderedIndex.pairs >=
        this.directoryGroups()[this.renderedIndex.group].duplicates.length
    ) {
      return;
    }
    if (this.shouldRenderMore()) {
      const groups = this.renderedDirGroups() ?? [];
      if (
          groups.length === 0 ||
          this.renderedIndex.pairs >=
          this.directoryGroups()[this.renderedIndex.group].duplicates.length
      ) {
        groups.push({
          name: this.directoryGroups()[++this.renderedIndex.group].name,
          duplicates: [],
        });
        this.renderedIndex.pairs = 0;
      }
      groups[groups.length - 1].duplicates.push(
          this.directoryGroups()[this.renderedIndex.group].duplicates[
              this.renderedIndex.pairs++
              ]
      );

      this.renderedDirGroups.set([...groups]);
      this.renderTimer = window.setTimeout(this.renderMore, 0);
    }
  };

  onScroll(): void {
    this.renderMore();
  }

  private shouldRenderMore(): boolean {
    return (
        Config.Gallery.enableOnScrollRendering === false ||
        PageHelper.ScrollY >= PageHelper.MaxScrollY * 0.7 ||
        document.body.clientHeight * 0.85 < window.innerHeight
    );
  }
}

