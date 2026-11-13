import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ChangeDetectorRef, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

import {GalleryGridComponent} from './grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {ContentService} from '../content.service';
import {GallerySortingService} from '../navigator/sorting.service';
import {QueryService} from '../../../model/query.service';
import {of} from 'rxjs';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {MediaDTO} from '../../../../../common/entities/MediaDTO';
import {GridMedia} from './GridMedia';
import {GalleryNavigatorService} from '../navigator/navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {GroupByTypes} from '../../../../../common/entities/SortingMethods';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {BlogService, GroupedMarkdown} from '../blog/blog.service';
import {provideIcons} from '@ng-icons/core';
import {appIcons} from '../../../icons';
import {ThumbnailManagerService} from '../thumbnailManager.service';
import {ExtensionService} from '../../../model/extension.service';
import {MediaButtonModalService} from './photo/media-button-modal/media-button-modal.service';
import {AuthenticationService} from '../../../model/network/authentication.service';
import {PageHelper} from '../../../model/page.helper';
import {ScrollRestorationService} from '../../../model/scroll-restoration.service';

class MockQueryService {
  getMediaStringId(media: MediaDTO): string {
    return media.name;
  }

  getParams(): Record<string, string> {
    return {};
  }
}

class MockOverlayService {
  getPhantomScrollbarWidth(): number {
    return 0;
  }
}

class MockContentService {
}

class MockGallerySortingService {
  readonly grouping = signal({method: GroupByTypes.NoGrouping, ascending: true});
}

class MockGalleryNavigatorService {
  readonly girdSize = signal(GridSizes.medium);
}


class MockBlogService {
  readonly groupedMarkdowns = signal<GroupedMarkdown[]>([]);

  getMarkDowns(): GroupedMarkdown[] {
    return [];
  }
}

describe('GalleryGridComponent', () => {
  let component: GalleryGridComponent;
  let fixture: ComponentFixture<GalleryGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryGridComponent],
      providers: [
        provideIcons(appIcons),
        ChangeDetectorRef, Router,
        {provide: ContentService, useClass: MockContentService},
        {provide: QueryService, useClass: MockQueryService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: BlogService, useClass: MockBlogService},
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: GalleryNavigatorService, useClass: MockGalleryNavigatorService},
        {provide: OverlayService, useClass: MockOverlayService},
        // for the tiles
        {provide: ThumbnailManagerService, useValue: {getThumbnail: () => ({Available: true, Error: false, loading: false, Src: '', destroy: (): void => undefined})}},
        {provide: ExtensionService, useValue: {UIExtensionConfig: []}},
        {provide: MediaButtonModalService, useValue: {}},
        {provide: AuthenticationService, useValue: {canSearch: () => false}},
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of([{id: 1}]),
            params: of([{id: 1}]),
          },
        },
        provideHttpClient(withXhr()),
        provideHttpClientTesting()
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(GalleryGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('should mergePhotos', () => {
    let phs: PhotoDTO[] = [];
    let gPhs: GridMedia[] = [];
    const resetData = () => {
      phs = [];
      gPhs = [];
      for (let i = 0; i < 10; ++i) {
        const p = {name: i + '.jpg', directory: {name: 'd' + i, path: 'p' + i}} as PhotoDTO;
        phs.push(p);
        gPhs.push(new GridMedia(p, 1, 1, i));
      }
    };
    /*-----------------------*/
    resetData();
    fixture.componentRef.setInput('mediaGroups', [{name: 'equal 1', media: [phs[0], phs[1]]}]);
    component.mediaToRender.set([{name: 'equal 1', media: [gPhs[0], gPhs[1]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'equal 1', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'empty render', media: [phs[0], phs[1]]}]);
    component.mediaToRender.set([]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'no 2nd yet', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[3]]}]);
    component.mediaToRender.set([{name: 'no 2nd yet', media: [gPhs[0], gPhs[1]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'no 2nd yet', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'eql 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[3]]}]);
    component.mediaToRender.set([{name: 'eql 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'eql 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', []);
    component.mediaToRender.set([{name: 'empty', media: [gPhs[0], gPhs[1]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'no overlap', media: [phs[2], phs[3]]}, {name: '1', media: [phs[0], phs[1]]}]);
    component.mediaToRender.set([{name: '1', media: [gPhs[0], gPhs[1]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed 2nd 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2]]}]);
    component.mediaToRender.set([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3], gPhs[4]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed 2nd 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[5]]}]);
    component.mediaToRender.set([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {
      name: '2',
      media: [gPhs[2], gPhs[5], gPhs[3], gPhs[4]]
    }]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[5]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed from 1st', media: [phs[0]]}, {name: '2', media: [phs[2], phs[3], phs[4]]}]);
    component.mediaToRender.set([{name: 'removed from 1st', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3], gPhs[4]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'removed from 1st', media: [gPhs[0]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed 2nd', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2]]}]);
    component.mediaToRender.set([{name: 'removed 2nd', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'removed 2nd', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed from 1st 2', media: [phs[0]]}, {name: '2', media: [phs[2], phs[3]]}]);
    component.mediaToRender.set([{name: 'removed from 1st 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'removed from 1st 2', media: [gPhs[0]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'merged', media: [phs[0], phs[1], phs[2], phs[3]]}]);
    component.mediaToRender.set([{name: 'merged dif name', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'merged', media: [gPhs[0]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: '3', media: [phs[0], phs[1], phs[2], phs[3]]}]);
    component.mediaToRender.set([{name: '1', media: [gPhs[0], gPhs[1], gPhs[3], gPhs[2]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: '3', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    resetData();
    gPhs[1].rowId = 3;
    gPhs[3].rowId = 3;
    gPhs[2].rowId = 3;
    fixture.componentRef.setInput('mediaGroups', [{name: '3', media: [phs[0], phs[1], phs[2], phs[3]]}]);
    component.mediaToRender.set([{name: '1', media: [gPhs[0], gPhs[1], gPhs[3], gPhs[2]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: '3', media: [gPhs[0]]}]);
    /*-----------------------*/
    resetData();
    gPhs[0].rowId = 1;
    gPhs[1].rowId = 1;
    gPhs[2].rowId = 3;
    gPhs[3].rowId = 3;
    gPhs[4].rowId = 4;
    gPhs[5].rowId = 4;
    fixture.componentRef.setInput('mediaGroups', [{name: 'X', media: [phs[0], phs[1], phs[2], phs[3], phs[4], phs[5], phs[6]]}]);
    component.mediaToRender.set([{name: '1', media: [gPhs[0], gPhs[1], gPhs[2], gPhs[3]]}, {name: '2', media: [gPhs[4], gPhs[5]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: 'X', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    resetData();
    gPhs[0].rowId = 1;
    gPhs[1].rowId = 1;
    gPhs[2].rowId = 3;
    gPhs[3].rowId = 3;
    gPhs[4].rowId = 5;
    gPhs[5].rowId = 5;
    fixture.componentRef.setInput('mediaGroups', [{name: '1', media: [phs[0], phs[1], phs[2], phs[3]]}, {name: '2', media: [phs[4], phs[5]]}]);
    component.mediaToRender.set([{name: 'X', media: [gPhs[0], gPhs[1], gPhs[2], gPhs[3], gPhs[4], gPhs[5]]}]);
    component.mergeNewPhotos();
    expect(component.mediaToRender()).toEqual([{name: '1', media: [gPhs[0], gPhs[1], gPhs[2], gPhs[3]]}]);

  });
  it('should render not full rows of different groups with the same height', () => {
    const p = (name: string) => ({
      name,
      directory: {name: 'd', path: 'p'},
      metadata: {size: {width: 3000, height: 2000}}
    } as PhotoDTO);
    component.containerWidth = 4000;
    component.screenHeight = 1000;
    fixture.componentRef.setInput('mediaGroups', [{name: '1', media: [p('1.jpg')]}, {name: '2', media: [p('2.jpg'), p('3.jpg')]}]);
    component.mediaToRender.set([]);
    component.renderARow();
    component.renderARow();
    const heights = component.mediaToRender().map(g => g.media.map(m => m.renderHeight));
    expect(heights).toEqual([[heights[0][0]], [heights[0][0], heights[0][0]]]);
  });

  // #1308, CUJ 6: a large folder renders while scrolling, not all media at once
  describe('on scroll', () => {
    let pageHeight: number;
    let scrollY: number;
    let frames: FrameRequestCallback[];

    // the height of the rendered rows: what the page would be after the browser laid them out
    const renderedHeight = (): number => {
      const rows = new Map<string, number>();
      component.mediaToRender().forEach((g, i) => g.media.forEach(gm => rows.set(i + '-' + gm.rowId, gm.renderHeight)));
      return [...rows.values()].reduce((sum, h) => sum + h + 2 * component.IMAGE_MARGIN, 0);
    };
    // a scroll event, then the browser lays out the new rows
    const scroll = (): number => {
      component.onScroll();
      frames.splice(0).forEach(cb => cb(0));
      pageHeight = renderedHeight();
      return component.getNumberOfRenderedMedia();
    };
    const maxScrollY = (): number => Math.max(0, pageHeight - window.innerHeight);

    beforeEach(() => {
      pageHeight = 0;
      scrollY = 0;
      frames = [];
      // jsdom has no layout: the page is as high as the rendered rows
      vi.spyOn(PageHelper, 'MaxScrollY', 'get').mockImplementation(maxScrollY);
      vi.spyOn(PageHelper, 'ScrollY', 'get').mockImplementation(() => scrollY);
      const photos: PhotoDTO[] = [];
      for (let i = 0; i < 500; ++i) {
        photos.push({name: i + '.jpg', directory: {name: 'd', path: 'p'}, metadata: {size: {width: 3000, height: 2000}}} as PhotoDTO);
      }
      component.containerWidth = 1000;
      component.screenHeight = 1000;
      fixture.componentRef.setInput('mediaGroups', [{name: 'all', media: photos}]);
      // after setInput: the change detection scheduler uses it too
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
        frames.push(cb);
        return frames.length;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should render only the first screens, then more rows when scrolled to the bottom', () => {
      scroll();
      scroll();
      const firstScreens = scroll();
      expect(firstScreens).toBeGreaterThan(0);
      expect(firstScreens).toBeLessThan(500);
      // staying at the top renders nothing more
      expect(scroll()).toBe(firstScreens);
      expect(pageHeight).toBeGreaterThan(window.innerHeight);

      scrollY = maxScrollY();
      const afterScroll = scroll();
      expect(afterScroll).toBeGreaterThan(firstScreens);
      expect(afterScroll).toBeLessThan(500);

      // scrolling down to the end renders all of them, a few rows at a time
      let steps = 0;
      while (component.getNumberOfRenderedMedia() < 500 && steps < 1000) {
        scrollY = maxScrollY();
        scroll();
        steps++;
      }
      expect(component.getNumberOfRenderedMedia()).toBe(500);
      expect(steps).toBeGreaterThan(2);
    });

    // #1308: back to a folder that was scrolled down, the page must be high enough to scroll there
    it('should render down to the scroll position of a browser back, then scroll there', async () => {
      vi.spyOn(TestBed.inject(ScrollRestorationService), 'takePending').mockReturnValueOnce(5000);
      vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockImplementation(renderedHeight);
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      scroll();

      (component as unknown as { restoreScroll(): void }).restoreScroll();
      expect(renderedHeight()).toBeGreaterThanOrEqual(5000 + window.innerHeight);
      expect(component.getNumberOfRenderedMedia(), 'not all at once').toBeLessThan(500);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(scrollTo).toHaveBeenCalledWith({left: window.scrollX, top: 5000, behavior: 'instant'});
    });
  });

  describe('as the lightbox grid', () => {
    const photo = (name: string): PhotoDTO => ({
      name,
      directory: {name: 'd', path: 'p'},
      metadata: {size: {width: 3000, height: 2000}}
    } as PhotoDTO);
    let photos: PhotoDTO[];

    beforeEach(() => {
      photos = [];
      for (let i = 0; i < 40; ++i) {
        photos.push(photo('p' + i + '.jpg'));
      }
      component.containerWidth = 1000;
      component.screenHeight = 1000;
      fixture.componentRef.setInput('mediaGroups', [
        {name: 'first', media: photos.slice(0, 2)},
        {name: 'second', media: photos.slice(2)}
      ]);
    });

    it('should list all media in grid order, not only the rendered ones', () => {
      expect(component.getNumberOfRenderedMedia()).toBe(0);
      expect(component.media()).toEqual(photos);
    });

    it('should list no media while the content loads', () => {
      fixture.componentRef.setInput('mediaGroups', undefined);
      expect(component.media()).toBeNull();
    });

    it('should render up to the media plus one row and resolve its tile after render', async () => {
      const target = photos[20];
      const revealed = component.revealMedia(target);
      // rendered on the fly, the tile is read after the next render
      const rendered = component.mediaToRender();
      const secondGroup = rendered[1].media;
      const index = secondGroup.findIndex(gm => gm.media === target);
      expect(index).toBe(18);
      expect(secondGroup[secondGroup.length - 1].rowId).toBeGreaterThan(secondGroup[index].rowId);
      // only one more row than needed
      const nextRowStart = secondGroup.findIndex(gm => gm.rowId > secondGroup[index].rowId);
      expect(secondGroup.slice(nextRowStart).every(gm => gm.rowId === secondGroup[nextRowStart].rowId)).toBe(true);
      expect(component.getNumberOfRenderedMedia()).toBeLessThan(photos.length);

      TestBed.tick();
      const tile = (await revealed)!;
      expect(tile.gridMedia.media).toBe(target);
      expect(tile.gridMedia).toBe(secondGroup[index]);
      expect(tile.rect).toEqual({top: 0, left: 0, width: 0, height: 0}); // jsdom has no layout
    });

    it('should resolve null for a media that is not in the grid, without navigating', async () => {
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'navigate');

      const tile = await component.revealMedia(photo('missing.jpg'));

      expect(tile).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });
});
