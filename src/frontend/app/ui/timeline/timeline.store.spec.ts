import {fakeAsync, flushMicrotasks} from '@angular/core/testing';
import {BehaviorSubject} from 'rxjs';
import {TimelineStore} from './timeline.store';
import {MediaDTO} from '../../../../common/entities/MediaDTO';
import {TimelinePageDTO} from '../../../../common/entities/TimelineDTO';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {groupTimelineByDay} from './timeline-grouping';

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
  let user: BehaviorSubject<UserDTO>;
  let version: BehaviorSubject<string>;
  let store: TimelineStore;

  beforeEach(() => {
    requests = [];
    user = new BehaviorSubject<UserDTO>({id: 1, name: 'u', role: UserRoles.User} as UserDTO);
    version = new BehaviorSubject<string>('v1');
    const network = {
      getJson: (url: string, query: Record<string, number>) => {
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
