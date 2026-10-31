import { Injectable, inject } from '@angular/core';
import {HttpEventType} from '@angular/common/http';
import {Subscription} from 'rxjs';
import {NetworkService} from '../../../model/network/network.service';
import {UploadUtils} from '../../../../../common/UploadUtils';
import {Utils} from '../../../../../common/Utils';
import {ContentLoaderService} from '../contentLoader.service';
import {Config} from '../../../../../common/config/public/Config';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {NotificationService} from '../../../model/notification.service';
import {PG2ConfMap} from '../../../../../common/PG2ConfMap';
import {ToastRef, ToastService, ToastSummary} from '../../toast/toast.service';

// A file while it is queued or uploading. Its toast shows the progress.
export interface UploadProgress {
  name: string;
  progress: number;
  status: 'queued' | 'uploading';
  toast: ToastRef;
  request?: Subscription; // unsubscribing aborts the upload
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
  private networkService = inject(NetworkService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthenticationService);
  private contentLoaderService = inject(ContentLoaderService);
  private toastService = inject(ToastService);

  private static readonly TOAST_GROUP = 'uploads';
  public uploadProgress: UploadProgress[] = [];
  // Result of the current batch: everything uploaded since the queue was last empty
  private batchUploaded = 0;
  private batchFailed = 0;
  private batchCanceled = 0;
  private uploadQueue: QueuedUpload[] = [];
  private activeUploads = 0;
  private MAX_CONCURRENT_UPLOADS = 1;
  private readonly DEFAULT_MAX_CONCURRENT_UPLOADS = 1;
  private readonly MAX_ALLOWED_CONCURRENT_UPLOADS = 10;
  private speedTimer: any = null;
  private lastProgressSum = 0;
  private lastUpdateTimestamp = 0;

  constructor() {
    // More than 5 files collapse into one card with the overall progress
    this.toastService.registerGroup(UploaderService.TOAST_GROUP, {
      collapseAfter: 5,
      visibleWhenCollapsed: 0,
      summary: (toasts, hidden, expanded): ToastSummary => {
        const failed = toasts.filter((t) => t.type === 'error').length;
        const running = toasts.filter((t) => t.type === 'progress').length;
        return {
          type: failed > 0 ? 'warning' : 'progress',
          title: expanded ? $localize`Hide details` : $localize`Uploading files: ${toasts.length}:count:`,
          text: failed > 0 ? $localize`Failed: ${failed}:count:` : null,
          progress: expanded ? null : Math.round(toasts.reduce((sum, t) => sum + (t.progress ?? 100), 0) / toasts.length),
          // nothing is running anymore: the whole list can be closed
          closable: running === 0,
          onCancel: running > 0 ? (): void => this.cancelAll() : undefined
        };
      }
    });
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
      if (!dir.metaFile || !dir.metaFile.some(m => PG2ConfMap.upload[m.name])) {
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
    const supportedFiles = files.filter(f =>
      UploadUtils.isUploadableExtension(UploadUtils.getExtension(f.name), Config.Upload.blockedExtensions));

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
          status: 'queued',
          toast: null
        };
        progressItem.toast = this.toastService.open({
          type: 'progress',
          color: 'secondary',
          title: f.name,
          text: $localize`Queued`,
          progress: 0,
          group: UploaderService.TOAST_GROUP,
          closable: false,
          wrap: false,
          onCancel: (): void => this.cancel(progressItem)
        });
        progressItems.push(progressItem);
        this.uploadQueue.push({
          file: f,
          directory,
          progressItem
        });
      }
    }

    if (existingFiles.length > 0) {
      // Skipped, not failed: nothing to do about it
      this.toastService.open({
        type: 'warning',
        title: existingFiles.length === 1 ? existingFiles[0].name : $localize`Files already exist: ${existingFiles.length}:count:`,
        text: existingFiles.length === 1 ? $localize`File already exists` : null,
        timeout: ToastService.TIMEOUT,
        placement: 'bottom-right',
        group: UploaderService.TOAST_GROUP,
        wrap: false
      });
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
    progressItem.toast.update({color: undefined, text: '0%'});

    const formData = new FormData();
    formData.append('files', file);

    const url = '/upload/' + (directory || '');

    progressItem.request = this.networkService.postFormData<any>(url, formData).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          progressItem.progress = Math.round((100 * event.loaded) / event.total);
          progressItem.toast.update({
            progress: progressItem.progress,
            text: progressItem.progress + '%',
            // Sent completely: the server may already be saving it, canceling would not undo that
            ...(progressItem.progress >= 100 ? {onCancel: undefined} : {})
          });
        } else if (event.type === HttpEventType.Response) {
          const response = event.body as any;
          const serverErrors = (response && response.result) ? response.result : [];

          const serverError = serverErrors.find((e: any) => e.filename === progressItem.name);
          if (serverError) {
            this.onUploadFailed(progressItem, serverError.error);
          } else {
            this.batchUploaded++;
            // a success needs no action, so it hides like the other short messages
            progressItem.toast.update({
              type: 'success',
              text: null,
              progress: 100,
              timeout: ToastService.TIMEOUT,
              closable: true,
              onCancel: undefined
            });
            this.onUploadFinished(progressItem);
          }
        }
      },
      error: (err) => {
        this.onUploadFailed(progressItem, err.message || err);
      }
    });
  }

  // Stops a queued file, or aborts it while it is being sent
  public cancel(progressItem: UploadProgress): void {
    const queueIndex = this.uploadQueue.findIndex((u) => u.progressItem === progressItem);
    if (queueIndex === -1 && (progressItem.status !== 'uploading' || progressItem.progress >= 100)) {
      return; // already finished, or the server may already be saving it
    }
    this.batchCanceled++;
    progressItem.toast.close();
    if (queueIndex !== -1) {
      this.uploadQueue.splice(queueIndex, 1);
      this.uploadProgress.splice(this.uploadProgress.indexOf(progressItem), 1);
      this.finishBatchIfDone();
      return;
    }
    progressItem.request.unsubscribe();
    this.onUploadFinished(progressItem);
  }

  public cancelAll(): void {
    // the queued ones first, so canceling a running one does not start them
    const queued = this.uploadQueue.map((u) => u.progressItem);
    queued.forEach((p) => this.cancel(p));
    [...this.uploadProgress].forEach((p) => this.cancel(p));
  }

  // An error needs the user's attention, so its toast stays until it is closed
  private onUploadFailed(progressItem: UploadProgress, error: string): void {
    this.batchFailed++;
    progressItem.toast.update({
      type: 'error',
      color: undefined,
      text: error,
      progress: 100,
      closable: true,
      wrap: true,
      onCancel: undefined
    });
    this.onUploadFinished(progressItem);
  }

  private onUploadFinished(progressItem: UploadProgress): void {
    this.uploadProgress.splice(this.uploadProgress.indexOf(progressItem), 1);
    this.activeUploads--;
    this.processQueue();
    this.finishBatchIfDone();
  }

  private finishBatchIfDone(): void {
    if (this.activeUploads > 0 || this.uploadQueue.length > 0) {
      return;
    }

    // The whole batch finished
    this.MAX_CONCURRENT_UPLOADS = this.DEFAULT_MAX_CONCURRENT_UPLOADS; // Reset for next batch
    if (this.batchUploaded > 0) {
      this.contentLoaderService.reloadCurrentContent().catch(console.error);
    }
    if (this.batchUploaded === 0 && this.batchFailed === 0) {
      if (this.batchCanceled > 0) {
        this.notificationService.info($localize`Upload canceled.`);
      }
    } else if (this.batchFailed === 0) {
      this.notificationService.success($localize`Uploaded files: ${this.batchUploaded}:count:`, $localize`Upload completed.`);
    } else if (this.batchUploaded > 0) {
      this.notificationService.warning(
        $localize`Uploaded: ${this.batchUploaded}:uploaded:, failed: ${this.batchFailed}:failed:`,
        $localize`Upload completed with errors`);
    } else {
      this.notificationService.error($localize`Failed files: ${this.batchFailed}:count:`, $localize`Upload failed.`);
    }
    this.batchUploaded = 0;
    this.batchFailed = 0;
    this.batchCanceled = 0;
  }
}
