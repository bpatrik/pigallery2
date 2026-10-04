import {expect} from 'chai';
import {
  getTimelineEffectiveTime,
  loadTimelinePage,
  TimelineScanCursor,
} from '../../../../../src/backend/model/timeline/TimelinePaging';
import {MediaDTO} from '../../../../../src/common/entities/MediaDTO';

function media(
  id: number,
  creationDate: number,
  creationDateOffset?: string
): MediaDTO {
  return {
    id,
    metadata: {creationDate, creationDateOffset},
  } as MediaDTO;
}

function fetcher(rows: MediaDTO[]) {
  const sorted = [...rows].sort(
    (left, right) =>
      right.metadata.creationDate - left.metadata.creationDate ||
      right.id - left.id
  );
  return async (
    scanAfter: TimelineScanCursor | null,
    rawUpperBound: number | null,
    limit: number
  ): Promise<MediaDTO[]> =>
    sorted
      .filter(row => rawUpperBound === null || row.metadata.creationDate <= rawUpperBound)
      .filter(
        row =>
          scanAfter === null ||
          row.metadata.creationDate < scanAfter.creationDate ||
          (row.metadata.creationDate === scanAfter.creationDate && row.id < scanAfter.id)
      )
      .slice(0, limit);
}

describe('TimelinePaging', () => {
  it('keeps effective-time order and resolves raw timestamp ties across batches', async () => {
    const rows = [
      media(1, 10_000, '+01:00'),
      media(3, 10_000, '+00:00'),
      media(2, 10_000, '+00:30'),
      media(4, 9_000, '+00:30'),
    ];
    const page = await loadTimelinePage(fetcher(rows), {
      limit: 2,
      batchSize: 2,
      ignoreTimestampOffset: true,
    });

    expect(page.media.map(item => item.id)).to.deep.equal([1, 2]);
    expect(page.next).to.deep.equal({from: 1_810_000, after: 2});
  });

  it('treats missing and invalid offsets as zero and supports global time', async () => {
    const rows = [media(1, 2_000, 'bad'), media(2, 1_000), media(3, 1_500, '-00:30')];
    const local = await loadTimelinePage(fetcher(rows), {
      limit: 3,
      ignoreTimestampOffset: true,
    });
    const global = await loadTimelinePage(fetcher(rows), {
      limit: 3,
      ignoreTimestampOffset: false,
    });

    expect(local.media.map(item => item.id)).to.deep.equal([1, 2, 3]);
    expect(global.media.map(item => item.id)).to.deep.equal([1, 3, 2]);
  });

  it('applies an exclusive before bound and binds no upper bound initially', async () => {
    const rows = [media(1, 300), media(2, 200), media(3, 100)];
    let observedUpperBound: number | null = 1;
    const page = await loadTimelinePage(
      async (scanAfter, upperBound, limit) => {
        observedUpperBound = upperBound;
        return fetcher(rows)(scanAfter, upperBound, limit);
      },
      {limit: 2, ignoreTimestampOffset: false, before: 250}
    );

    expect(observedUpperBound).to.equal(250);
    expect(page.media.map(item => item.id)).to.deep.equal([2, 3]);
    expect(page.next).to.deep.equal({from: 100, after: 3});
  });

  it('uses an unbounded initial scan and includes the 14-hour continuation edge', async () => {
    let initialUpperBound: number | null | undefined;
    await loadTimelinePage(
      async (scanAfter, upperBound, limit) => {
        initialUpperBound = upperBound;
        return fetcher([media(1, 100)])(scanAfter, upperBound, limit);
      },
      {limit: 2, ignoreTimestampOffset: true}
    );
    expect(initialUpperBound).to.equal(null);

    const cursorTime = 100;
    const rawAtWindowEdge = media(
      1,
      cursorTime + 14 * 60 * 60 * 1000,
      '-14:00'
    );
    let continuationUpperBound: number | null = null;
    const page = await loadTimelinePage(
      async (scanAfter, upperBound, limit) => {
        continuationUpperBound = upperBound;
        return fetcher([rawAtWindowEdge])(scanAfter, upperBound, limit);
      },
      {
        limit: 2,
        ignoreTimestampOffset: true,
        cursor: {from: cursorTime, after: 2},
      }
    );
    expect(continuationUpperBound).to.equal(
      cursorTime + 14 * 60 * 60 * 1000
    );
    expect(page.media.map(item => item.id)).to.deep.equal([1]);
  });

  it('returns a null cursor when fewer than a page remain', async () => {
    const page = await loadTimelinePage(fetcher([media(1, 100)]), {
      limit: 2,
      ignoreTimestampOffset: false,
    });

    expect(page.media.map(item => item.id)).to.deep.equal([1]);
    expect(page.next).to.equal(null);
  });

  it('uses the cursor effective time and id as a strict continuation', async () => {
    const rows = [media(4, 1_000), media(3, 1_000), media(2, 1_000), media(1, 900)];
    const page = await loadTimelinePage(fetcher(rows), {
      limit: 2,
      ignoreTimestampOffset: false,
      cursor: {from: 1_000, after: 3},
    });

    expect(page.media.map(item => item.id)).to.deep.equal([2, 1]);
  });

  it('splits equal effective times across pages without skipping lower ids', async () => {
    // Same effective time (10:00 local) reached through different raw timestamps.
    const hour = 60 * 60 * 1000;
    const rows = [
      media(6, 10 * hour - 2 * hour, '+02:00'),
      media(5, 10 * hour, '+00:00'),
      media(4, 10 * hour + 3 * hour, '-03:00'),
      media(3, 10 * hour - 2 * hour, '+02:00'),
      media(2, 10 * hour + 3 * hour, '-03:00'),
      media(1, 9 * hour, '+00:00'),
    ];
    const first = await loadTimelinePage(fetcher(rows), {
      limit: 3,
      batchSize: 1,
      ignoreTimestampOffset: true,
    });
    expect(first.media.map(item => item.id)).to.deep.equal([6, 5, 4]);
    expect(first.next).to.deep.equal({from: 10 * hour, after: 4});

    const second = await loadTimelinePage(fetcher(rows), {
      limit: 3,
      batchSize: 1,
      ignoreTimestampOffset: true,
      cursor: first.next!,
    });
    expect(second.media.map(item => item.id)).to.deep.equal([3, 2, 1]);
  });

  it('returns an empty final page when the previous page ended exactly at EOF', async () => {
    const rows = [media(2, 200), media(1, 100)];
    const first = await loadTimelinePage(fetcher(rows), {
      limit: 2,
      ignoreTimestampOffset: false,
    });
    expect(first.media.map(item => item.id)).to.deep.equal([2, 1]);
    expect(first.next).to.deep.equal({from: 100, after: 1});

    const last = await loadTimelinePage(fetcher(rows), {
      limit: 2,
      ignoreTimestampOffset: false,
      cursor: first.next!,
    });
    expect(last.media).to.be.empty;
    expect(last.next).to.equal(null);
  });

  for (const ignoreTimestampOffset of [true, false]) {
    it(`traverses mixed offsets exactly once (ignoreTimestampOffset=${ignoreTimestampOffset})`, async () => {
      let seed = 42;
      const random = (max: number): number => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % max;
      };
      const offsets = [undefined, 'bad', '+00:00', '-00:30', '+05:45', '-12:00', '+14:00'];
      const rows = Array.from({length: 120}, (_, index) =>
        media(index + 1, random(48) * 30 * 60 * 1000, offsets[random(offsets.length)])
      );
      const expected = [...rows]
        .sort((left, right) =>
          getTimelineEffectiveTime(right, ignoreTimestampOffset) -
          getTimelineEffectiveTime(left, ignoreTimestampOffset) ||
          right.id - left.id
        )
        .map(item => item.id);

      for (const startBefore of [undefined, getTimelineEffectiveTime(rows[7], ignoreTimestampOffset)]) {
        const ids: number[] = [];
        let page = await loadTimelinePage(fetcher(rows), {
          limit: 7,
          batchSize: 3,
          ignoreTimestampOffset,
          before: startBefore,
        });
        ids.push(...page.media.map(item => item.id));
        while (page.next) {
          page = await loadTimelinePage(fetcher(rows), {
            limit: 7,
            batchSize: 3,
            ignoreTimestampOffset,
            cursor: page.next,
          });
          ids.push(...page.media.map(item => item.id));
        }
        const expectedIds = startBefore === undefined
          ? expected
          : expected.filter(id =>
            getTimelineEffectiveTime(rows[id - 1], ignoreTimestampOffset) < startBefore
          );
        expect(ids).to.deep.equal(expectedIds);
      }
    });
  }
});