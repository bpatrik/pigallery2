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
