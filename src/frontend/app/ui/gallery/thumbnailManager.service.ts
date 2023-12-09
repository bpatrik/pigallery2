import {Injectable} from '@angular/core';
import {ThumbnailLoaderService, ThumbnailLoadingListener, ThumbnailLoadingPriority, ThumbnailTaskEntity,} from './thumbnailLoader.service';
import {Media} from './Media';
import {MediaIcon} from './MediaIcon';
import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {Person} from '../faces/Person';

@Injectable()
export class ThumbnailManagerService {
  constructor(private thumbnailLoader: ThumbnailLoaderService) {
  }

  public getThumbnail(photo: Media): Thumbnail {
    return new Thumbnail(photo, this.thumbnailLoader);
  }

  public getLazyThumbnail(photo: Media): Thumbnail {
    return new Thumbnail(photo, this.thumbnailLoader, false);
  }

  public getIcon(photo: MediaIcon): IconThumbnail {
    return new IconThumbnail(photo, this.thumbnailLoader);
  }

  public getPersonThumbnail(person: PersonDTO): PersonThumbnail {
    return new PersonThumbnail(person, this.thumbnailLoader);
  }
}

export abstract class ThumbnailBase {
  public loading = false;
  protected available = false;
  protected src: string = null;
  protected error = false;
  protected onLoad: () => void = null;
  protected thumbnailTask: ThumbnailTaskEntity = null;

  protected constructor(protected thumbnailService: ThumbnailLoaderService) {
  }

  abstract set Visible(visible: boolean);

  set OnLoad(onLoad: () => void) {
    this.onLoad = onLoad;
  }

  get Available(): boolean {
    return this.available;
  }

  get Src(): string {
    return this.src;
  }

  get Loading(): boolean {
    return this.loading;
  }

  get Error(): boolean {
    return this.error;
  }

  destroy(): void {
    if (this.thumbnailTask != null) {
      this.thumbnailService.removeTask(this.thumbnailTask);
      this.thumbnailTask = null;
    }
  }
}

export class PersonThumbnail extends ThumbnailBase {
  constructor(
      private person: PersonDTO,
      thumbnailService: ThumbnailLoaderService
  ) {
    super(thumbnailService);
    this.src = '';
    this.error = false;
    if (!this.person.missingThumbnail) {
      this.src = Person.getThumbnailUrl(person);
      this.available = true;
      if (this.onLoad) {
        this.onLoad();
      }
      return;
    }

    setTimeout((): void => {
      const listener: ThumbnailLoadingListener = {
        onStartedLoading: (): void => {
          // onLoadStarted
          this.loading = true;
        },
        onLoad: (): void => {
          // onLoaded
          this.src = Person.getThumbnailUrl(person);
          if (this.onLoad) {
            this.onLoad();
          }
          this.available = true;
          this.loading = false;
          this.thumbnailTask = null;
        },
        onError: (): void => {
          // onError
          this.thumbnailTask = null;
          this.loading = false;
          this.error = true;
        },
      };
      this.thumbnailTask = this.thumbnailService.loadPersonThumbnail(
          person,
          ThumbnailLoadingPriority.high,
          listener
      );
    }, 0);
  }

  set Visible(visible: boolean) {
    if (!this.thumbnailTask) {
      return;
    }
    if (visible === true) {
      this.thumbnailTask.priority = ThumbnailLoadingPriority.high;
    } else {
      this.thumbnailTask.priority = ThumbnailLoadingPriority.medium;
    }
  }
}

export class IconThumbnail extends ThumbnailBase {
  constructor(
      private media: MediaIcon,
      thumbnailService: ThumbnailLoaderService
  ) {
    super(thumbnailService);
    this.src = '';
    this.error = false;
    if (this.media.isIconAvailable()) {
      this.src = this.media.getIconPath();
      this.available = true;
      if (this.onLoad) {
        this.onLoad();
      }
    }

    if (!this.media.isIconAvailable()) {
      setTimeout((): void => {
        const listener: ThumbnailLoadingListener = {
          onStartedLoading: (): void => {
            // onLoadStarted
            this.loading = true;
          },
          onLoad: (): void => {
            // onLoaded
            this.src = this.media.getIconPath();
            if (this.onLoad) {
              this.onLoad();
            }
            this.available = true;
            this.loading = false;
            this.thumbnailTask = null;
          },
          onError: (): void => {
            // onError
            this.thumbnailTask = null;
            this.loading = false;
            this.error = true;
          },
        };
        this.thumbnailTask = this.thumbnailService.loadIcon(
            this.media,
            ThumbnailLoadingPriority.high,
            listener
        );
      }, 0);
    }
  }

  set Visible(visible: boolean) {
    if (!this.thumbnailTask) {
      return;
    }
    if (visible === true) {
      this.thumbnailTask.priority = ThumbnailLoadingPriority.high;
    } else {
      this.thumbnailTask.priority = ThumbnailLoadingPriority.medium;
    }
  }
}

export class Thumbnail extends ThumbnailBase {
  constructor(
      private media: Media,
      thumbnailService: ThumbnailLoaderService,
      autoLoad = true
  ) {
    super(thumbnailService);
    if (this.media.isThumbnailAvailable()) {
      this.src = this.media.getThumbnailPath();
      this.available = true;
      if (this.onLoad) {
        this.onLoad();
      }
    } else if (this.media.isReplacementThumbnailAvailable()) {
      this.src = this.media.getReplacementThumbnailPath();
      this.available = true;
    }
    if (autoLoad) {
      this.load();
    }
  }

  set CurrentlyWaiting(value: boolean) {
    if (!this.thumbnailTask) {
      return;
    }
    if (value === true) {
      if (this.media.isReplacementThumbnailAvailable()) {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.medium;
      } else {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.extraHigh;
      }
    } else {
      if (this.media.isReplacementThumbnailAvailable()) {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.low;
      } else {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.medium;
      }
    }
  }

  set Visible(visible: boolean) {
    if (!this.thumbnailTask) {
      return;
    }
    if (visible === true) {
      if (this.media.isReplacementThumbnailAvailable()) {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.medium;
      } else {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.high;
      }
    } else {
      if (this.media.isReplacementThumbnailAvailable()) {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.low;
      } else {
        this.thumbnailTask.priority = ThumbnailLoadingPriority.medium;
      }
    }
  }

  public load(): void {
    if (!this.media.isThumbnailAvailable() && this.thumbnailTask == null) {
      //    setTimeout(() => {
      const listener: ThumbnailLoadingListener = {
        onStartedLoading: (): void => {
          // onLoadStarted
          this.loading = true;
        },
        onLoad: (): void => {
          // onLoaded
          this.src = this.media.getThumbnailPath();
          if (this.onLoad) {
            this.onLoad();
          }
          this.available = true;
          this.loading = false;
          this.thumbnailTask = null;
        },
        onError: (): void => {
          // onError
          this.thumbnailTask = null;
          this.loading = false;
          this.error = true;
        },
      };
      if (this.media.isReplacementThumbnailAvailable()) {
        this.thumbnailTask = this.thumbnailService.loadImage(
            this.media,
            ThumbnailLoadingPriority.medium,
            listener
        );
      } else {
        this.thumbnailTask = this.thumbnailService.loadImage(
            this.media,
            ThumbnailLoadingPriority.high,
            listener
        );
      }
      // }, 0);
    }
  }
}

