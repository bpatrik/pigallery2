import {Injectable} from '@angular/core';
import {HttpEventType} from '@angular/common/http';
import {NetworkService} from '../../../model/network/network.service';
import {SupportedFormats} from '../../../../../common/SupportedFormats';
import {Utils} from '../../../../../common/Utils';
import {ContentLoaderService} from '../contentLoader.service';
import {Config} from '../../../../../common/config/public/Config';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NotificationService} from '../../../model/notification.service';

export interface UploadProgress {
  name: string;
  progress: number;
  error?: string;
  done: boolean;
  status?: 'queued' | 'uploading' | 'done' | 'error';
  lastUpdate: number;
  count?: number; // Added for consolidated items
}

interface QueuedUpload {
  file: File;
  directory: string;
  progressItem: UploadProgress;
}

@Injectable({
  providedIn: 'root'
})
export class UploaderService {
  public uploadProgress: UploadProgress[] = [];
  private uploadQueue: QueuedUpload[] = [];
  private activeUploads = 0;
  private MAX_CONCURRENT_UPLOADS = 1;
  private readonly DEFAULT_MAX_CONCURRENT_UPLOADS = 1;
  private readonly MAX_ALLOWED_CONCURRENT_UPLOADS = 10;
  private speedTimer: any = null;
  private lastProgressSum = 0;
  private lastUpdateTimestamp = 0;

  constructor(private networkService: NetworkService,
              private notificationService: NotificationService,
              private authService: AuthenticationService,
              private contentLoaderService: ContentLoaderService) {
  }

  public canUpload(): boolean {
    const dir = this.contentLoaderService.content.value.directory;
    if (!Config.Upload.enabled ||
      !this.authService.isAuthenticated() ||
      this.authService.user.value.role < Config.Upload.minimumRole ||
      !dir) {
      return false;
    }

    if (Config.Upload.enforcedDirectoryConfig === true) {
      if (!dir.metaFile || !dir.metaFile.some(m => m.name === '.uploader.pg2conf')) {
        return false;
      }
    }

    return true;
  }


  public async uploadFiles(filesIn: FileList | File[]): Promise<void> {
    if (this.canUpload() === false) {
      this.notificationService.error($localize`Upload is not supported for this directory.`);
      return;
    }
    const files = [];
    for (let i = 0; i < filesIn.length; i++) {
      files.push(filesIn[i]);
    }
    const dirDto = this.contentLoaderService.content.value.directory;
    const directory = Utils.concatUrls(dirDto.path, dirDto.name);
    const supportedFiles = files.filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return SupportedFormats.Photos.includes(ext) ||
        SupportedFormats.Videos.includes(ext) ||
        SupportedFormats.MetaFiles.includes(ext);
    });

    if (supportedFiles.length < files.length) {
      this.notificationService.warning($localize`Some files were skipped due to unsupported format.`);
    }

    if (supportedFiles.length === 0) {
      return;
    }

    // Track each file individually in the progress list
    const progressItems: UploadProgress[] = [];
    const existingFiles: File[] = [];

    for (const f of supportedFiles) {
      // Check if the file already exists in the current directory
      const dir = this.contentLoaderService.content.value.directory;
      let fileExists = false;
      if (dir) {
        fileExists = (dir.media && dir.media.some(m => m.name === f.name)) ||
          (dir.metaFile && dir.metaFile.some(m => m.name === f.name));
      }

      if (fileExists) {
        existingFiles.push(f);
      } else {
        const progressItem: UploadProgress = {
          name: f.name,
          progress: 0,
          done: false,
          status: 'queued',
          lastUpdate: Date.now()
        };
        progressItems.push(progressItem);
        this.uploadQueue.push({
          file: f,
          directory,
          progressItem
        });
      }
    }

    if (existingFiles.length > 0) {
      const existingItem: UploadProgress = {
        name: existingFiles.length === 1 ? existingFiles[0].name : existingFiles.length + ' ' + $localize`files already exist`,
        progress: 100,
        done: true,
        status: 'error',
        lastUpdate: Date.now(),
        error: $localize`File already exists`,
        count: existingFiles.length
      };
      this.uploadProgress.push(existingItem);
      this._cleanupProgress([existingItem]);
    }

    if (progressItems.length === 0) {
      return;
    }

    this.uploadProgress.push(...progressItems);
    this.startSpeedTracking();
    this.processQueue();
  }

  private startSpeedTracking(): void {
    if (this.speedTimer) {
      return;
    }
    this.lastProgressSum = this.uploadProgress.reduce((a, b) => a + (b.status === 'uploading' ? b.progress : 0), 0);
    this.lastUpdateTimestamp = Date.now();
    this.speedTimer = setInterval(() => {
      const currentProgressSum = this.uploadProgress.reduce((a, b) => a + (b.status === 'uploading' ? b.progress : 0), 0);
      const now = Date.now();
      const timeDiff = (now - this.lastUpdateTimestamp) / 1000; // in seconds

      if (timeDiff >= 1 && this.activeUploads > 0) {
        const speed = (currentProgressSum - this.lastProgressSum) / timeDiff; // % per second

        if (speed > 20 && this.MAX_CONCURRENT_UPLOADS < this.MAX_ALLOWED_CONCURRENT_UPLOADS) {
          this.MAX_CONCURRENT_UPLOADS++;
          this.processQueue();
        } else if (speed < 20 && this.MAX_CONCURRENT_UPLOADS > this.DEFAULT_MAX_CONCURRENT_UPLOADS) {
          this.MAX_CONCURRENT_UPLOADS--;
        }

        this.lastProgressSum = currentProgressSum;
        this.lastUpdateTimestamp = now;
      }

      if (this.activeUploads === 0 && this.uploadQueue.length === 0) {
        this.stopSpeedTracking();
      }
    }, 1000);
  }

  private stopSpeedTracking(): void {
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
  }

  private processQueue(): void {
    while (this.activeUploads < this.MAX_CONCURRENT_UPLOADS && this.uploadQueue.length > 0) {
      const upload = this.uploadQueue.shift();
      this.activeUploads++;
      this._uploadFile(upload);
    }
  }

  private _uploadFile(upload: QueuedUpload): void {
    const {file, directory, progressItem} = upload;
    progressItem.status = 'uploading';

    const formData = new FormData();
    formData.append('files', file);

    const url = '/upload/' + (directory || '');

    this.networkService.postFormData<any>(url, formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          progressItem.progress = Math.round((100 * event.loaded) / event.total);
          progressItem.lastUpdate = Date.now();
        } else if (event.type === HttpEventType.Response) {
          const response = event.body as any;
          const serverErrors = (response && response.result) ? response.result : [];

          const serverError = serverErrors.find((e: any) => e.filename === progressItem.name);
          if (serverError) {
            progressItem.error = serverError.error;
            progressItem.status = 'error';
          } else {
            progressItem.progress = 100;
            progressItem.lastUpdate = Date.now();
            progressItem.status = 'done';
          }
          progressItem.done = true;

          this.activeUploads--;
          this.processQueue();

          if (this.activeUploads === 0 && this.uploadQueue.length === 0) {
            this.notificationService.success($localize`Upload completed.`);
            this.contentLoaderService.reloadCurrentContent().catch(console.error);
            this.MAX_CONCURRENT_UPLOADS = this.DEFAULT_MAX_CONCURRENT_UPLOADS; // Reset for next batch
          }
          this._cleanupProgress([progressItem]);
        }
      },
      error: (err) => {
        progressItem.error = err.message || err;
        progressItem.done = true;
        progressItem.status = 'error';
        progressItem.lastUpdate = Date.now();

        this.activeUploads--;
        this.processQueue();

        if (this.activeUploads === 0 && this.uploadQueue.length === 0) {
          this.notificationService.error($localize`Upload failed.`);
          this.MAX_CONCURRENT_UPLOADS = this.DEFAULT_MAX_CONCURRENT_UPLOADS; // Reset for next batch
        }
        this._cleanupProgress([progressItem]);
      }
    });
  }

  private _cleanupProgress(items: UploadProgress[]): void {
    // Remove from list after some time
    items.forEach(item => {
      setTimeout(() => {
        if (!item.done && item.status !== 'error') {
          // If for some reason it's not done yet, retry later
          this._cleanupProgress([item]);
          return;
        }
        const idx = this.uploadProgress.indexOf(item);
        if (idx !== -1) {
          this.uploadProgress.splice(idx, 1);
        }
      }, 5000);
    });
  }
}
