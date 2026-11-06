import { Injectable, inject } from '@angular/core';
import {HttpClient, HttpEvent, HttpEventType, HttpResponse} from '@angular/common/http';
import {Message} from '../../../../common/entities/Message';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {ErrorCodes, ErrorDTO} from '../../../../common/entities/Error';
import {Config} from '../../../../common/config/public/Config';
import {CustomHeaders} from '../../../../common/CustomHeaders';
import {VersionService} from '../version.service';
import {lastValueFrom, Observable, tap} from 'rxjs';

@Injectable({providedIn: 'root'})
export class NetworkService {
  private http = inject(HttpClient);
  private loadingBarService = inject(LoadingBarService);
  private versionService = inject(VersionService);

  readonly apiBaseUrl = Config.Server.getApiUrl();
  private globalErrorHandlers: ((error: ErrorDTO) => boolean)[] = [];

  public static buildUrl(url: string, data?: Record<string, unknown>): string {
    if (data) {
      const keys = Object.getOwnPropertyNames(data);
      if (keys.length > 0) {
        url += '?';
        for (let i = 0; i < keys.length; i++) {
          url += keys[i] + '=' + data[keys[i]];
          if (i < keys.length - 1) {
            url += '&';
          }
        }
      }
    }
    return url;
  }

  public getXML(url: string): Promise<Document> {
    this.loadingBarService.useRef().start();

    const process = (res: string): Document => {
      this.loadingBarService.useRef().complete();
      const parser = new DOMParser();
      return parser.parseFromString(res, 'text/xml');
    };

    const err = <T>(error: T) => {
      this.loadingBarService.useRef().complete();
      return this.handleError(error);
    };

    return lastValueFrom(this.http
      .get(this.apiBaseUrl + url, {responseType: 'text'}))
      .then(process)
      .catch(err);
  }

  public getText(url: string): Promise<string> {
    this.loadingBarService.useRef().start();

    const process = (res: string): string => {
      this.loadingBarService.useRef().complete();
      return res;
    };

    const err = <T>(error: T) => {
      this.loadingBarService.useRef().complete();
      return this.handleError(error);
    };

    return lastValueFrom(this.http
      .get(this.apiBaseUrl + url, {responseType: 'text'}))
      .then(process)
      .catch(err);
  }

  public postJson<T>(url: string, data = {}): Promise<T> {
    return this.callJson('post', url, data);
  }

  public postFormData<T>(url: string, data: FormData): Observable<HttpEvent<Message<T>>> {
    this.loadingBarService.useRef().start();
    return this.http.post<Message<T>>(this.apiBaseUrl + url, data, {
      reportProgress: true,
      observe: 'events',
    }).pipe(tap({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.loadingBarService.useRef().complete();
          const dataVersion = event.headers.get(CustomHeaders.dataVersion);
          if (dataVersion !== null) {
            this.versionService.onNewVersion(dataVersion);
          }
          const appVersion = event.headers.get(CustomHeaders.appVersion);
          if (appVersion !== null) {
            this.versionService.onNewAppVersion(appVersion);
          }
        }
      },
      error: () => {
        this.loadingBarService.useRef().complete();
      },
      // the upload was canceled
      unsubscribe: () => {
        this.loadingBarService.useRef().complete();
      }
    }));
  }

  public putJson<T>(url: string, data = {}): Promise<T> {
    return this.callJson('put', url, data);
  }

  public getJson<T>(url: string, query?: Record<string, unknown>): Promise<T> {
    return this.callJson('get', NetworkService.buildUrl(url, query));
  }

  public deleteJson<T>(url: string): Promise<T> {
    return this.callJson('delete', url);
  }

  addGlobalErrorHandler(fn: (error: ErrorDTO) => boolean): void {
    this.globalErrorHandlers.push(fn);
  }

  private callJson<T>(
    method: 'get' | 'post' | 'delete' | 'put',
    url: string,
    data = {}
  ): Promise<T> {
    const body = data;

    this.loadingBarService.useRef().start();

    const process = (res: HttpResponse<Message<T>>): T => {
      this.loadingBarService.useRef().complete();
      const msg = res.body;
      const dataVersion = res.headers.get(CustomHeaders.dataVersion);
      if (dataVersion !== null) {
        this.versionService.onNewVersion(dataVersion);
      }
      const appVersion = res.headers.get(CustomHeaders.appVersion);
      if (appVersion !== null) {
        this.versionService.onNewAppVersion(appVersion);
      }
      if (!msg) {
        throw new Error('Empty response from the server');
      }
      if (msg.error) {
        if (msg.error.code) {
          (msg.error as ErrorDTO & { title?: string }).title = ErrorCodes[msg.error.code];
        }
        throw msg.error;
      }
      // the caller's T says whether the result can be null
      return msg.result as T;
    };

    const err = <T>(error: T) => {
      this.loadingBarService.useRef().complete();
      return this.handleError(error);
    };

    switch (method) {
      case 'get':
        return lastValueFrom(this.http
          .get<Message<T>>(this.apiBaseUrl + url, {observe: 'response'}))
          .then(process)
          .catch(err);
      case 'delete':
        return lastValueFrom(this.http
          .delete<Message<T>>(this.apiBaseUrl + url, {observe: 'response'}))
          .then(process)
          .catch(err);
      case 'post':
        return lastValueFrom(this.http
          .post<Message<T>>(this.apiBaseUrl + url, body, {
            observe: 'response',
          }))
          .then(process)
          .catch(err);
      case 'put':
        return lastValueFrom(this.http
          .put<Message<T>>(this.apiBaseUrl + url, body, {observe: 'response'}))
          .then(process)
          .catch(err);
      default:
        throw new Error('Unknown method');
    }
  }

  /**
   * Handle errors from the server.
   * Also look at error.interceptor.ts
   * @param error
   * @private
   */
  private handleError<T>(error: T): Promise<T> {
    if (typeof (error as ErrorDTO).code !== 'undefined') {
      // being handled somewhere else (e.g.: not authenticated in the authentication service)
      for (const item of this.globalErrorHandlers) {
        if (item(error as ErrorDTO) === true) {
          // handled: the request resolves with undefined
          return Promise.resolve(undefined as T);
        }
      }
      return Promise.reject(error);
    }
    // instead of just logging it to the console
    return Promise.reject((error as ErrorDTO).message || error || 'Server error');
  }

}
