import {expect} from 'chai';
import {
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
});