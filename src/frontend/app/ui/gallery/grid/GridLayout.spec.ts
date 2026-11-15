import {GridLayout, GridLayoutParams} from './GridLayout';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {MediaGroup} from '../navigator/sorting.service';

describe('GridLayout', () => {
  const params: GridLayoutParams = {
    width: 1000,
    screenHeight: 1000,
    targetColCount: 5,
    minRowCount: 2,
    maxRowCount: 5,
    imageMargin: 2,
    headerHeight: 50
  };
  const photo = (name: string): PhotoDTO => ({
    name,
    directory: {name: 'd', path: 'p'},
    metadata: {size: {width: 3000, height: 2000}}
  } as PhotoDTO);
  const photos = (count: number, prefix = ''): PhotoDTO[] => Array.from({length: count}, (_, i) => photo(prefix + i + '.jpg'));
  const names = (layout: GridLayout): string[][] => layout.lines.map(l => l.segments.map(s => s.group.name));

  it('should lay out all media, not only the ones on the screen', () => {
    const all = photos(80000);
    const start = performance.now();
    const layout = new GridLayout([{name: '', media: all}], params);
    const time = performance.now() - start;

    expect(layout.lines.flatMap(l => l.segments.flatMap(s => s.media.map(m => m.media)))).toEqual(all);
    expect(layout.length).toBeGreaterThan(1000);
    expect(layout.totalHeight).toBeGreaterThan(1000 * params.screenHeight / params.maxRowCount);
    expect(time, 'a phone lays out a large folder fast too').toBeLessThan(1000);
  });

  it('should fill the rows to the width of the grid', () => {
    const layout = new GridLayout([{name: '', media: photos(40)}], params);
    for (const line of layout.lines.slice(0, -1)) {
      const width = line.segments[0].media.reduce((w, m) => w + m.renderWidth + 2 * params.imageMargin, 0);
      expect(width).toBeLessThanOrEqual(params.width);
      expect(width).toBeGreaterThan(params.width - 2);
    }
  });

  it('should stack the lines', () => {
    const layout = new GridLayout([{name: 'a', media: photos(20, 'a')}, {name: 'b', media: photos(20, 'b')}], params);
    let top = 0;
    for (let i = 0; i < layout.length; ++i) {
      expect(layout.top(i)).toBeCloseTo(top);
      top += layout.height(i);
    }
    expect(layout.totalHeight).toBeCloseTo(top);
  });

  it('should add the header height to the first line of a named group', () => {
    const layout = new GridLayout([{name: 'a', media: photos(20, 'a')}], params);
    const row = layout.lines[0].segments[0].media[0].renderHeight + 2 * params.imageMargin;
    expect(layout.lines[0].segments[0].header).toBe(true);
    expect(layout.height(0)).toBeCloseTo(row + 50);
    expect(layout.lines[1].segments[0].header).toBe(false);
    expect(layout.height(1)).toBeCloseTo(row);
  });

  it('should put small groups on one line while they fit', () => {
    const layout = new GridLayout([
      {name: '1', media: photos(1, 'a')},
      {name: '2', media: photos(2, 'b')},
      {name: '3', media: photos(3, 'c')},
      {name: '4', media: photos(20, 'd')},
      {name: '5', media: photos(1, 'e')}
    ], {...params, width: 2000});
    expect(names(layout)[0]).toEqual(['1', '2']);
    expect(names(layout)[1]).toEqual(['3']);
    // a large group has its own lines
    expect(names(layout).filter(n => n.includes('4')).every(n => n.length === 1)).toBe(true);
    expect(names(layout).at(-1)).toEqual(['5']);
  });

  it('should render not full rows of different groups with the same height', () => {
    const layout = new GridLayout([{name: '1', media: photos(1, 'a')}, {name: '2', media: photos(2, 'b')}], {...params, width: 4000});
    const heights = layout.lines[0].segments.map(s => s.media.map(m => m.renderHeight));
    expect(heights).toEqual([[heights[0][0]], [heights[0][0], heights[0][0]]]);
  });

  it('should break the line before a group that starts a new line', () => {
    const groups: MediaGroup[] = [
      {name: '2025', media: photos(1, 'a')},
      {name: '2022', startsNewLine: true, media: photos(1, 'b')},
      {name: '2022 too', media: photos(1, 'c')}
    ];
    expect(names(new GridLayout(groups, {...params, width: 4000}))).toEqual([['2025'], ['2022', '2022 too']]);
  });

  it('should find the line of a y position and of a media', () => {
    const all = photos(100);
    const layout = new GridLayout([{name: '', media: all}], params);
    expect(layout.lineAt(-100)).toBe(0);
    expect(layout.lineAt(0)).toBe(0);
    expect(layout.lineAt(layout.top(5))).toBe(5);
    expect(layout.lineAt(layout.top(5) - 0.5)).toBe(4);
    expect(layout.lineAt(layout.totalHeight + 100)).toBe(layout.length - 1);
    const line = layout.lineOf(all[50]);
    expect(layout.lines[line].segments[0].media.some(m => m.media === all[50])).toBe(true);
    expect(layout.lineOf(photo('missing.jpg'))).toBe(-1);
  });

  it('should move the lines below a measured one', () => {
    const layout = new GridLayout([{name: 'a', media: photos(40)}], params);
    const top = layout.top(3);
    expect(layout.setHeight(1, layout.height(1) + 100)).toBe(true);
    layout.updateTops();
    expect(layout.top(3)).toBeCloseTo(top + 100);
    expect(layout.setHeight(1, layout.height(1)), 'same height').toBe(false);
  });

  it('should estimate the not measured headers with the measured header height', () => {
    const layout = new GridLayout([{name: 'a', media: photos(1, 'a')}, {name: 'b', media: photos(20, 'b')}, {name: 'c', media: photos(20, 'c')}],
      {...params, width: 500});
    const first = layout.height(0);
    const header = layout.lines.findIndex((l, i) => i > 0 && l.segments[0].header);
    const other = layout.height(header);
    layout.setHeight(0, first + 5);
    expect(layout.setHeaderHeight(60)).toBe(true);
    layout.updateTops();
    expect(layout.height(0), 'measured').toBeCloseTo(first + 5);
    expect(layout.height(header)).toBeCloseTo(other + 10);
  });

  // e.g. browser back to a folder: the saved scroll position is in the measured page
  it('should start with the measured heights of an earlier layout of the same lines', () => {
    const cache = new Map<string, number>();
    const all = photos(40);
    const first = new GridLayout([{name: 'a', media: all}], params, cache);
    first.setHeight(0, 300);
    first.setHeight(2, 250);

    const again = new GridLayout([{name: 'a', media: [...all]}], params, cache);
    expect(again.height(0)).toBe(300);
    expect(again.height(1)).toBeCloseTo(first.height(1));
    expect(again.height(2)).toBe(250);
    expect(again.top(3)).toBeCloseTo(300 + again.height(1) + 250);

    const otherWidth = new GridLayout([{name: 'a', media: all}], {...params, width: 800}, cache);
    expect(otherWidth.height(0), 'other lines').not.toBe(300);
  });

  it('should have no lines without width', () => {
    const layout = new GridLayout([{name: '', media: photos(10)}], {...params, width: 0});
    expect(layout.length).toBe(0);
    expect(layout.totalHeight).toBe(0);
  });
});
