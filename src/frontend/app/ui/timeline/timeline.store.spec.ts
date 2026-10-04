import {fakeAsync, flushMicrotasks} from '@angular/core/testing';
import {BehaviorSubject, Subject} from 'rxjs';
import {TimelineStore} from './timeline.store';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {TimelinePageDTO, TimelineSummaryDTO} from '../../../../common/entities/TimelineDTO';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {
  formatTimelineMonth,
  getTimelineMediaId,
  getTimelineMonth,
  getTimelineMonthEnd,
  groupTimelineByDay,
  parseTimelineMonth,
} from './timeline-grouping';
import {TimelineLightboxSource} from './timeline-lightbox.source';
import {QueryParams} from '../../../../common/QueryParams';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  const d = {} as Deferred<T>;
  d.promise = new Promise<T>((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return d;
}

function media(id: number, creationDate: number): MediaDTO {
  return {
    id,
    name: id + '.jpg',
    directory: {name: 'dir', path: '/'},
    metadata: {creationDate, size: {width: 4, height: 3}},
  } as MediaDTO;
}

function page(items: MediaDTO[], next: TimelinePageDTO['next']): TimelinePageDTO {
  return {media: items, next};
}

describe('TimelineStore', () => {
  let requests: { url: string; query: Record<string, number>; response: Deferred<TimelinePageDTO> }[];
  let summaryRequests: Deferred<TimelineSummaryDTO>[];
  let user: BehaviorSubject<UserDTO>;
  let version: BehaviorSubject<string>;
  let store: TimelineStore;

  beforeEach(() => {
    requests = [];
    summaryRequests = [];
    user = new BehaviorSubject<UserDTO>({id: 1, name: 'u', role: UserRoles.User} as UserDTO);
    version = new BehaviorSubject<string>('v1');
    const network = {
      getJson: (url: string, query: Record<string, number>) => {
        if (url === '/timeline/summary') {
          const summary = deferred<TimelineSummaryDTO>();
          summaryRequests.push(summary);
          return summary.promise;
        }
        const response = deferred<TimelinePageDTO>();
        requests.push({url, query, response});
        return response.promise;
      }
    };
    store = new TimelineStore(network as never, {version} as never, {user} as never);
  });

  it('coalesces concurrent loads into one request', fakeAsync(() => {
    const first = store.loadNextPage();
    const second = store.loadNextPage();
    expect(second).toBe(first);
    expect(requests.length).toBe(1);
    expect(requests[0].query).toEqual({limit: TimelineStore.PAGE_SIZE});

    requests[0].response.resolve(page([media(2, 20), media(1, 10)], {from: 10, after: 1}));
    flushMicrotasks();
    expect(store.items.map(m => m.id)).toEqual([2, 1]);
    expect(store.loading).toBeFalse();

    store.loadNextPage();
    expect(requests[1].query).toEqual({limit: TimelineStore.PAGE_SIZE, from: 10, after: 1});
  }));

  it('dedupes by media id and still advances the cursor', fakeAsync(() => {
    store.loadNextPage();
    requests[0].response.resolve(page([media(2, 20), media(1, 10)], {from: 10, after: 1}));
    flushMicrotasks();

    store.loadNextPage();
    requests[1].response.resolve(page([media(1, 10)], {from: 5, after: 9}));
    flushMicrotasks();
    expect(store.items.map(m => m.id)).toEqual([2, 1]);

    store.loadNextPage();
    expect(requests[2].query).toEqual({limit: TimelineStore.PAGE_SIZE, from: 5, after: 9});
    requests[2].response.resolve(page([], null));
    flushMicrotasks();
    expect(store.hasMore).toBeFalse();
  }));

  it('drops responses that arrive after cancel or reset', fakeAsync(() => {
    store.loadNextPage();
    store.cancel();
    expect(store.loading).toBeFalse();
    requests[0].response.resolve(page([media(1, 10)], null));
    flushMicrotasks();
    expect(store.items).toEqual([]);
    expect(store.hasMore).toBeTrue();

    store.loadNextPage();
    store.reset();
    requests[1].response.reject('boom');
    flushMicrotasks();
    expect(store.error).toBeNull();

    store.loadNextPage();
    expect(requests.length).toBe(3);
  }));

  it('keeps errors until an explicit retry', fakeAsync(() => {
    store.loadNextPage();
    requests[0].response.reject('Server down');
    flushMicrotasks();
    expect(store.error).toBe('Server down');
    expect(store.loading).toBeFalse();

    store.loadNextPage();
    expect(store.error).toBeNull();
    expect(requests.length).toBe(2);
  }));

  it('clears state on logout and on projection change', fakeAsync(() => {
    store.loadNextPage();
    requests[0].response.resolve(page([media(1, 10)], {from: 10, after: 1}));
    flushMicrotasks();
    store.scrollAnchor = {mediaId: '/dir/1.jpg', offset: 0};

    user.next({id: 1, name: 'u', role: UserRoles.User, projectionKey: 'other'} as UserDTO);
    expect(store.items).toEqual([]);
    expect(store.scrollAnchor).toBeNull();

    store.loadNextPage();
    requests[1].response.resolve(page([media(1, 10)], null));
    flushMicrotasks();
    user.next(null);
    expect(store.items).toEqual([]);
  }));

  it('flags new data on gallery version change but keeps the list', fakeAsync(() => {
    store.loadNextPage();
    requests[0].response.resolve(page([media(1, 10)], null));
    flushMicrotasks();

    version.next('v2');
    expect(store.newDataAvailable).toBeTrue();
    expect(store.items.length).toBe(1);
  }));

  it('starts at an exclusive before boundary after reset', () => {
    store.reset(12345);
    store.loadNextPage();
    expect(requests[0].query).toEqual({limit: TimelineStore.PAGE_SIZE, before: 12345});
  });

  it('loads the summary once and drops it on user change', fakeAsync(() => {
    const summary = {years: [{year: 2015, months: [{month: 6, count: 3}]}]};
    store.loadSummary();
    store.loadSummary();
    expect(summaryRequests.length).toBe(1);
    summaryRequests[0].resolve(summary);
    flushMicrotasks();
    expect(store.summary).toEqual(summary);

    store.loadSummary();
    expect(summaryRequests.length).toBe(1);

    store.loadSummary();
    user.next({id: 2, name: 'v', role: UserRoles.Guest} as UserDTO);
    expect(store.summary).toBeNull();
    store.loadSummary();
    expect(summaryRequests.length).toBe(2);
  }));

  it('ignores a summary that arrives after the user changed', fakeAsync(() => {
    store.loadSummary();
    user.next({id: 2, name: 'v', role: UserRoles.Guest} as UserDTO);
    summaryRequests[0].resolve({years: [{year: 2015, months: [{month: 6, count: 3}]}]});
    flushMicrotasks();
    expect(store.summary).toBeNull();
  }));
});

describe('Timeline months', () => {
  it('accepts only YYYY-MM with a real month', () => {
    expect(parseTimelineMonth('2015-06')).toEqual({year: 2015, month: 6});
    expect(parseTimelineMonth('1969-12')).toEqual({year: 1969, month: 12});
    for (const bad of ['2015-6', '2015-13', '2015-00', '15-06', '2015-06-01', '', undefined, ['2015-06']]) {
      expect(parseTimelineMonth(bad)).withContext(String(bad)).toBeNull();
    }
    expect(formatTimelineMonth({year: 812, month: 3})).toBe('0812-03');
  });

  it('jumps to the exclusive first instant of the following month', () => {
    expect(getTimelineMonthEnd({year: 2015, month: 6})).toBe(Date.UTC(2015, 6, 1));
    expect(getTimelineMonthEnd({year: 2015, month: 12})).toBe(Date.UTC(2016, 0, 1));
    expect(getTimelineMonthEnd({year: 1969, month: 12})).toBe(0);
    expect(getTimelineMonthEnd({year: 50, month: 1})).toBe(new Date('0050-02-01T00:00:00Z').getTime());
  });

  it('puts media in the month of its effective time', () => {
    const item = media(1, Date.UTC(2017, 1, 28, 23, 30));
    item.metadata.creationDateOffset = '+01:00';
    expect(getTimelineMonth(item, true)).toEqual({year: 2017, month: 3});
    expect(getTimelineMonth(item, false)).toEqual({year: 2017, month: 2});
  });
});

describe('TimelineLightboxSource', () => {
  it('keeps the page params (?at) when opening and closing the viewer', () => {
    const store = {items: [media(1, 10)], changes: new Subject<void>()} as unknown as TimelineStore;
    const photos = {changes: new Subject<void>(), find: (): undefined => undefined} as never;
    const source = new TimelineLightboxSource(store, photos, () => ({at: '2015-07'}));

    const id = getTimelineMediaId(store.items[0]);
    expect(source.queryParams()).toEqual({at: '2015-07'});
    expect(source.queryParams(store.items[0])).toEqual({at: '2015-07', [QueryParams.gallery.photo]: id});
    expect(source.indexOfId(id)).toBe(0);
  });
});

describe('groupTimelineByDay', () => {
  const day = 86400000;

  it('continues the same day across page boundaries as one group', () => {
    const firstPage = [media(5, 3 * day + 100), media(4, 2 * day + 500)];
    const secondPage = [media(3, 2 * day + 10), media(2, day + 1), media(1, -1)];
    const name = (start: number): string => String(start / day);

    const groups = groupTimelineByDay([...firstPage, ...secondPage], false, name);
    expect(groups.map(g => g.name)).toEqual(['3', '2', '1', '-1']);
    expect(groups[1].media.map(m => m.id)).toEqual([4, 3]);
  });

  it('groups by local day when offsets are respected', () => {
    const item = media(1, day - 60 * 60000);
    item.metadata.creationDateOffset = '+02:00';
    expect(groupTimelineByDay([item], true, String)[0].name).toBe(String(day));
    expect(groupTimelineByDay([item], false, String)[0].name).toBe('0');
  });
});
