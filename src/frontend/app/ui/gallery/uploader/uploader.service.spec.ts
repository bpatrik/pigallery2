import type {Mocked} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {computed, signal} from '@angular/core';
import {HttpEventType} from '@angular/common/http';
import {Subject} from 'rxjs';
import {UploaderService} from './uploader.service';
import {NetworkService} from '../../../model/network/network.service';
import {NotificationService} from '../../../model/notification.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {ContentLoaderService} from '../contentLoader.service';
import {ToastService} from '../../toast/toast.service';
import {Config} from '../../../../../common/config/public/Config';
import {UserRoles} from '../../../../../common/entities/UserDTO';
import {ErrorCodes} from '../../../../../common/entities/Error';

class MockNetworkService {
  requests: Subject<unknown>[] = [];

  postFormData(): Subject<unknown> {
    const request = new Subject<unknown>();
    this.requests.push(request);
    return request;
  }
}

class MockContentLoaderService {
  readonly content = signal({directory: {path: '.', name: 'Summer', media: [{name: 'exists.jpg'}], metaFile: []}});
  reloadCurrentContent = vi.fn().mockResolvedValue(undefined);
}

class MockAuthenticationService {
  readonly user = signal({name: 'admin', role: UserRoles.Admin});
  readonly isAuthenticated = computed((): boolean => !!this.user());
  isAuthorized(role: UserRoles): boolean {
    return this.user().role >= role;
  }
}

describe('UploaderService', () => {
  let service: UploaderService;
  let toasts: ToastService;
  let network: MockNetworkService;
  let notification: Mocked<NotificationService>;
  let uploadEnabled: boolean;

  // the second file of a batch has an accented name: non-ASCII file names must work too
  const file = (name: string): File => new File(['x'], name);
  const finish = (i: number): void => {
    network.requests[i].next({type: HttpEventType.Response, body: {result: []}});
    network.requests[i].complete();
  };
  const fail = (i: number): void => network.requests[i].error({message: 'Disk full'});
  const toast = (title: string) => toasts.toasts().find((t) => t.title === title)!;

  beforeEach(() => {
    uploadEnabled = Config.Upload.enabled;
    Config.Upload.enabled = true;
    network = new MockNetworkService();
    notification = {success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn()} as unknown as Mocked<NotificationService>;
    TestBed.configureTestingModule({
      providers: [
        {provide: NetworkService, useValue: network},
        {provide: NotificationService, useValue: notification},
        {provide: AuthenticationService, useClass: MockAuthenticationService},
        {provide: ContentLoaderService, useClass: MockContentLoaderService}
      ]
    });
    service = TestBed.inject(UploaderService);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => {
    Config.Upload.enabled = uploadEnabled;
    vi.useRealTimers();
  });

  it('should show the progress of each file at the bottom right', async () => {
    await service.uploadFiles([file('beach.jpg'), file('árvíztűrő.jpg')]);
    expect(toast('beach.jpg')).toEqual(expect.objectContaining({type: 'progress', text: '0%', placement: 'bottom-right'}));
    expect(toast('árvíztűrő.jpg')).toEqual(expect.objectContaining({type: 'progress', text: 'Queued', closable: false}));
    network.requests[0].next({type: HttpEventType.UploadProgress, loaded: 45, total: 100});
    expect(toast('beach.jpg')).toEqual(expect.objectContaining({progress: 45, text: '45%'}));
  });

  it('should hide a successful file after a while and report the batch', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    finish(0);
    expect(toast('beach.jpg').type).toBe('success');
    expect(notification.success).toHaveBeenCalledWith('Uploaded files: 1', 'Upload completed.');
    await vi.advanceTimersByTimeAsync(ToastService.TIMEOUT);
    expect(toast('beach.jpg')).toBeUndefined();
  });

  it('should keep a failed file until it is closed and report errors in the batch', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg'), file('árvíztűrő.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    fail(0);
    finish(1);
    expect(toast('beach.jpg')).toEqual(expect.objectContaining({type: 'error', text: 'Disk full', closable: true}));
    expect(notification.warning).toHaveBeenCalledWith('Uploaded: 1, failed: 1', 'Upload completed with errors');
    await vi.advanceTimersByTimeAsync(60000);
    expect(toast('beach.jpg')).toBeDefined();
  });

  it('should report a batch where everything failed', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    fail(0);
    expect(notification.error).toHaveBeenCalledWith('Failed files: 1', 'Upload failed.');
  });

  it('should cancel a queued file without sending it', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg'), file('árvíztűrő.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    toast('árvíztűrő.jpg').onCancel!();
    expect(toast('árvíztűrő.jpg')).toBeUndefined();
    finish(0);
    expect(network.requests.length).toBe(1);
    expect(notification.success).toHaveBeenCalledWith('Uploaded files: 1', 'Upload completed.');
  });

  it('should abort a file while it is sent and start the next one', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg'), file('árvíztűrő.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    network.requests[0].next({type: HttpEventType.UploadProgress, loaded: 30, total: 100});
    toast('beach.jpg').onCancel!();
    expect(network.requests[0].observed).toBe(false); // unsubscribed: the request is aborted
    expect(toast('beach.jpg')).toBeUndefined();
    expect(network.requests.length).toBe(2);
    expect(toast('árvíztűrő.jpg').text).toBe('0%');
  });

  it('should not offer canceling once a file is sent completely', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(toast('beach.jpg').onCancel).toBeDefined();
    network.requests[0].next({type: HttpEventType.UploadProgress, loaded: 100, total: 100});
    expect(toast('beach.jpg').onCancel).toBeUndefined();
    service.cancelAll();
    expect(network.requests[0].observed).toBe(true);
  });

  it('should cancel everything and say so', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('beach.jpg'), file('árvíztűrő.jpg'), file('castle.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    service.cancelAll();
    expect(toasts.toasts().length).toBe(0);
    expect(network.requests.length).toBe(1); // the queued ones never started
    expect(notification.info).toHaveBeenCalledWith('Upload canceled.');
  });

  it('should warn about an existing file instead of failing it', async () => {
    vi.useFakeTimers();
    service.uploadFiles([file('exists.jpg')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(toast('exists.jpg')).toEqual(expect.objectContaining({type: 'warning', placement: 'bottom-right'}));
    expect(network.requests.length).toBe(0);
    await vi.advanceTimersByTimeAsync(ToastService.TIMEOUT);
    expect(toast('exists.jpg')).toBeUndefined();
  });

  describe('per file errors (#1314)', () => {
    const respond = (i: number, result: { filename: string, error: string }[]): void => {
      network.requests[i].next({type: HttpEventType.Response, body: {result}});
      network.requests[i].complete();
    };

    it('should show the error the server reports for a file and upload the others', async () => {
      vi.useFakeTimers();
      service.uploadFiles([file('beach.jpg'), file('árvíztűrő.jpg')]);
      await vi.advanceTimersByTimeAsync(0);
      respond(0, [{filename: 'beach.jpg', error: 'File already exists: beach.jpg'}]);
      respond(1, []);
      expect(toast('beach.jpg')).toEqual(expect.objectContaining({type: 'error', text: 'File already exists: beach.jpg'}));
      expect(toast('árvíztűrő.jpg').type).toBe('success');
      expect(notification.warning).toHaveBeenCalledWith('Uploaded: 1, failed: 1', 'Upload completed with errors');
    });

    it('should upload the supported files of a drop that also has unsupported ones', async () => {
      vi.useFakeTimers();
      service.uploadFiles([file('beach.jpg'), file('setup.exe')]);
      await vi.advanceTimersByTimeAsync(0);
      expect(network.requests.length).toBe(1);
      expect(toast('beach.jpg')).toBeDefined();
      expect(toast('setup.exe')?.type).not.toBe('progress');
    });

    it('should name the unsupported file in its message', async () => {
      vi.useFakeTimers();
      service.uploadFiles([file('beach.jpg'), file('notes.txt')]);
      await vi.advanceTimersByTimeAsync(0);
      const messages = [
        ...toasts.toasts().map((t) => (t.title ?? '') + ' ' + (t.text ?? '')),
        ...notification.warning.mock.calls.map((c) => c.join(' ')),
        ...notification.error.mock.calls.map((c) => c.join(' '))
      ];
      expect(messages.some((m) => m.includes('notes.txt'))).toBe(true);
    });

    it('should reject a file above the size limit without sending it', async () => {
      vi.useFakeTimers();
      const maxFileSizeMB = Config.Upload.maxFileSizeMB;
      Config.Upload.maxFileSizeMB = 1;
      try {
        service.uploadFiles([new File([new Uint8Array(1024 * 1024 + 1)], 'big.jpg'), file('beach.jpg')]);
        await vi.advanceTimersByTimeAsync(0);
        expect(toast('big.jpg')).toEqual(expect.objectContaining({type: 'error', text: expect.stringContaining('1 MB')}));
        expect(network.requests.length).toBe(1); // only beach.jpg is sent
      } finally {
        Config.Upload.maxFileSizeMB = maxFileSizeMB;
      }
    });

    it('should not offer the upload to a user below the minimum upload role', () => {
      const minimumRole = Config.Upload.minimumRole;
      Config.Upload.minimumRole = UserRoles.Admin;
      try {
        (TestBed.inject(AuthenticationService) as unknown as MockAuthenticationService).user.set({name: 'Eve', role: UserRoles.User});
        expect(service.canUpload()).toBe(false);
      } finally {
        Config.Upload.minimumRole = minimumRole;
      }
    });

    it('should say "Can\'t save to this folder" when the server refuses the folder', async () => {
      vi.useFakeTimers();
      service.uploadFiles([file('beach.jpg')]);
      await vi.advanceTimersByTimeAsync(0);
      // the error interceptor passes on the ErrorDTO of the response
      network.requests[0].error({code: ErrorCodes.PERMISSION_DENIED, message: 'Upload is not enabled in this directory'});
      const messages = [
        ...toasts.toasts().map((t) => (t.title ?? '') + ' ' + (t.text ?? '')),
        ...notification.error.mock.calls.map((c) => c.join(' '))
      ];
      expect(messages.some((m) => m.includes('Can\'t save to this folder'))).toBe(true);
      expect(toast('beach.jpg').onRetry).toBeUndefined(); // it would fail the same way
    });

    it('should offer a retry for a file whose connection dropped', async () => {
      vi.useFakeTimers();
      service.uploadFiles([file('beach.jpg')]);
      await vi.advanceTimersByTimeAsync(0);
      fail(0);
      expect(toast('beach.jpg').onRetry).toBeDefined();
      toast('beach.jpg').onRetry!();
      await vi.advanceTimersByTimeAsync(0);
      expect(network.requests.length).toBe(2);
      expect(toast('beach.jpg')).toEqual(expect.objectContaining({type: 'progress', text: '0%', onRetry: undefined}));
      finish(1);
      expect(toast('beach.jpg').type).toBe('success');
      expect(notification.success).toHaveBeenCalledWith('Uploaded files: 1', 'Upload completed.');
    });
  });
});
