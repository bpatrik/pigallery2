import {Component, HostListener, OnDestroy, OnInit} from '@angular/core';
import {DuplicateService} from './duplicates.service';
import {Utils} from '../../../../common/Utils';
import {QueryService} from '../../model/query.service';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';
import {DirectoryPathDTO} from '../../../../common/entities/DirectoryDTO';
import {Subscription} from 'rxjs';
import {Config} from '../../../../common/config/public/Config';
import {PageHelper} from '../../model/page.helper';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {PiTitleService} from '../../model/pi-title.service';

interface GroupedDuplicate {
  name: string;
  duplicates: DuplicatesDTO[];
}

@Component({
  selector: 'app-duplicate',
  templateUrl: './duplicates.component.html',
  styleUrls: ['./duplicates.component.css'],
})
export class DuplicateComponent implements OnDestroy, OnInit {
  directoryGroups: GroupedDuplicate[] = null;
  renderedDirGroups: GroupedDuplicate[] = null;
  renderedIndex = {
    group: -1,
    pairs: 0,
  };
  subscription: Subscription;
  renderTimer: number = null;
  duplicateCount = {
    pairs: 0,
    photos: 0,
  };

  constructor(
      public duplicateService: DuplicateService,
      public queryService: QueryService,
      private piTitleService: PiTitleService
  ) {
    this.duplicateService.getDuplicates().catch(console.error);
    this.subscription = this.duplicateService.duplicates.subscribe(
        (duplicates: DuplicatesDTO[]): void => {
          this.directoryGroups = [];
          this.renderedIndex = {group: -1, pairs: 0};
          this.renderedDirGroups = [];
          this.duplicateCount = {
            pairs: 0,
            photos: 0,
          };
          if (duplicates === null) {
            return;
          }
          this.duplicateCount.photos = duplicates.reduce(
              (prev: number, curr): number => prev + curr.media.length,
              0
          );
          this.duplicateCount.pairs = duplicates.length;

          const getMostFrequentDir = (
              dupls: DuplicatesDTO[]
          ): DirectoryPathDTO | null => {
            if (dupls.length === 0) {
              return null;
            }
            const dirFrequency: {
              [key: string]: { count: number; dir: DirectoryPathDTO };
            } = {};
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
            let max: { count: number; dir: DirectoryPathDTO } = {
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
            const dir = getMostFrequentDir(duplicates);
            const group = duplicates.filter(
                (d): MediaDTO =>
                    d.media.find(
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
            this.directoryGroups.push({
              name: this.getDirectoryPath(dir) + ' (' + group.length + ')',
              duplicates: group,
            });
          }
          this.renderMore();
        }
    );
  }

  ngOnInit(): void {
    this.piTitleService.setTitle($localize`Duplicates`);
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  getDirectoryPath(directory: DirectoryPathDTO): string {
    return Utils.concatUrls(directory.path, directory.name);
  }

  renderMore = (): void => {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }

    if (this.directoryGroups.length === 0) {
      return;
    }

    if (
        this.renderedIndex.group === this.directoryGroups.length - 1 &&
        this.renderedIndex.pairs >=
        this.directoryGroups[this.renderedIndex.group].duplicates.length
    ) {
      return;
    }
    if (this.shouldRenderMore()) {
      if (
          this.renderedDirGroups.length === 0 ||
          this.renderedIndex.pairs >=
          this.directoryGroups[this.renderedIndex.group].duplicates.length
      ) {
        this.renderedDirGroups.push({
          name: this.directoryGroups[++this.renderedIndex.group].name,
          duplicates: [],
        });
        this.renderedIndex.pairs = 0;
      }
      this.renderedDirGroups[this.renderedDirGroups.length - 1].duplicates.push(
          this.directoryGroups[this.renderedIndex.group].duplicates[
              this.renderedIndex.pairs++
              ]
      );

      this.renderTimer = window.setTimeout(this.renderMore, 0);
    }
  };

  @HostListener('window:scroll')
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

