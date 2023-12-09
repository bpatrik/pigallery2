import {getTestBed, inject, TestBed} from '@angular/core/testing';
import {HttpClientTestingModule, HttpTestingController,} from '@angular/common/http/testing';
import {NetworkService} from './network.service';
import {Message} from '../../../../common/entities/Message';
import {LoadingBarService} from '@ngx-loading-bar/core';
import {VersionService} from '../version.service';
import {Config} from '../../../../common/config/public/Config';

describe('NetworkService Success tests', () => {
  const testUrl = '/test/url';
  const testData = {data: 'testData'};
  const testResponse = 'testResponse';
  const testResponseMessage = new Message(null, testResponse);
  let injector;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VersionService, LoadingBarService, NetworkService],
    });
    injector = getTestBed();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call GET', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService
            .getJson(testUrl)
            .then((res: string) => {
              expect(res).toBe(testResponse);
            })
            .catch((err) => {
              console.error(err);
              expect(err).toBeUndefined();
            });

        const mockReq = httpMock.expectOne({method: 'GET'});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        mockReq.flush(testResponseMessage);
      }
  ));

  it('should call POST', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService
            .postJson(testUrl, testData)
            .then((res: string) => {
              expect(res).toBe(testResponse);
            })
            .catch((err) => {
              console.error(err);
              expect(err).toBeUndefined();
            });

        let mockReq = httpMock.expectOne(Config.Server.apiPath + testUrl);
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        mockReq.flush(testResponseMessage);
        expect(mockReq.request.body).toBe(testData);

        networkService
            .postJson(testUrl)
            .then((res: string) => {
              expect(res).toBe(testResponse);
            })
            .catch((err) => {
              console.error(err);
              expect(err).toBeUndefined();
            });

        mockReq = httpMock.expectOne(Config.Server.apiPath + testUrl);
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        expect(mockReq.request.body).toEqual({});
        mockReq.flush(testResponseMessage);
      }
  ));

  it('should call DELETE', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService.deleteJson(testUrl).then((res: any) => {
          expect(res).toBe(testResponse);
        });

        const mockReq = httpMock.expectOne({method: 'DELETE'});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        mockReq.flush(testResponseMessage);
      }
  ));

  it('should call PUT', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService.putJson(testUrl, testData).then((res: any) => {
          expect(res).toBe(testResponse);
        });

        let mockReq = httpMock.expectOne({});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        expect(mockReq.request.body).toEqual(testData);
        mockReq.flush(testResponseMessage);

        networkService.putJson(testUrl).then((res: any) => {
          expect(res).toBe(testResponse);
        });

        mockReq = httpMock.expectOne({});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        expect(mockReq.request.body).toEqual({});
        mockReq.flush(testResponseMessage);
      }
  ));
});

describe('NetworkService Fail tests', () => {
  const testUrl = '/test/url';
  const testData = {data: 'testData'};
  const testError = 'testError';
  let injector;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VersionService, LoadingBarService, NetworkService],
    });
    injector = getTestBed();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should call GET with error', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService
            .getJson(testUrl)
            .then((res: any) => {
              expect(res).toBe(null);
            })
            .catch((err) => {
              expect(err).toBe(
                  `Http failure response for ${Config.Server.apiPath}/test/url: 0 ` + testError
              );
            });

        const mockReq = httpMock.expectOne({method: 'GET'});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        mockReq.error(null, {statusText: testError});
      }
  ));

  it('should call POST with error', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService
            .postJson(testUrl, testData)
            .then((res: any) => {
              expect(res).toBe(null);
            })
            .catch((err) => {
              expect(err).toBe(
                  `Http failure response for ${Config.Server.apiPath}/test/url: 0 ` + testError
              );
            });

        const mockReq = httpMock.expectOne({method: 'POST'});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        expect(mockReq.request.body).toEqual(testData);
        mockReq.error(null, {statusText: testError});
      }
  ));

  it('should call PUT with error', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService
            .putJson(testUrl, testData)
            .then((res: any) => {
              expect(res).toBe(null);
            })
            .catch((err) => {
              expect(err).toBe(
                  `Http failure response for ${Config.Server.apiPath}/test/url: 0 ` + testError
              );
            });

        const mockReq = httpMock.expectOne({method: 'PUT'});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        expect(mockReq.request.body).toEqual(testData);
        mockReq.error(null, {statusText: testError});
      }
  ));

  it('should call DELETE with error', inject(
      [NetworkService],
      (networkService: NetworkService) => {
        networkService
            .deleteJson(testUrl)
            .then((res: any) => {
              expect(res).toBe(null);
            })
            .catch((err) => {
              expect(err).toBe(
                  `Http failure response for ${Config.Server.apiPath}/test/url: 0 ` + testError
              );
            });

        const mockReq = httpMock.expectOne({method: 'DELETE'});
        expect(mockReq.cancelled).toBeFalsy();
        expect(mockReq.request.responseType).toEqual('json');
        mockReq.error(null, {statusText: testError});
      }
  ));
});
