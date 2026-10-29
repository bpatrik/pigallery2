import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ChangeDetectorRef} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';

import {GalleryGridComponent} from './grid.gallery.component';
import {OverlayService} from '../overlay.service';
import {ContentService} from '../content.service';
import {GallerySortingService} from '../navigator/sorting.service';
import {QueryService} from '../../../model/query.service';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {GridMedia} from './GridMedia';
import {GalleryNavigatorService} from '../navigator/navigator.service';
import {GridSizes} from '../../../../../common/entities/GridSizes';
import {provideHttpClient} from '@angular/common/http';
import {BlogService, GroupedMarkdown} from '../blog/blog.service';

class MockQueryService {
}

class MockOverlayService {
  getPhantomScrollbarWidth(): number {
    return 0;
  }
}

class MockContentService {
}

class MockGallerySortingService {
}

class MockGalleryNavigatorService {
  girdSize = new BehaviorSubject(GridSizes.medium);
}


class MockBlogService {
  getMarkDowns(date: Date): Observable<GroupedMarkdown[]> {
    return of([]);
  }
}

describe('GalleryGridComponent', () => {
  let component: GalleryGridComponent;
  let fixture: ComponentFixture<GalleryGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GalleryGridComponent],
      providers: [
        ChangeDetectorRef, Router,
        {provide: ContentService, useClass: MockContentService},
        {provide: QueryService, useClass: MockQueryService},
        {provide: OverlayService, useClass: MockOverlayService},
        {provide: BlogService, useClass: MockBlogService},
        {provide: GallerySortingService, useClass: MockGallerySortingService},
        {provide: GalleryNavigatorService, useClass: MockGalleryNavigatorService},
        {provide: OverlayService, useClass: MockOverlayService},
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of([{id: 1}]),
            params: of([{id: 1}]),
          },
        },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(GalleryGridComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('lightbox', {
      setGridPhotoQL: () => {
        // mock
      }
    } as never);
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
    component.mediaToRender = [{name: 'equal 1', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'equal 1', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'empty render', media: [phs[0], phs[1]]}]);
    component.mediaToRender = [];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'no 2nd yet', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[3]]}]);
    component.mediaToRender = [{name: 'no 2nd yet', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'no 2nd yet', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'eql 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[3]]}]);
    component.mediaToRender = [{name: 'eql 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'eql 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', []);
    component.mediaToRender = [{name: 'empty', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'no overlap', media: [phs[2], phs[3]]}, {name: '1', media: [phs[0], phs[1]]}]);
    component.mediaToRender = [{name: '1', media: [gPhs[0], gPhs[1]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed 2nd 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2]]}]);
    component.mediaToRender = [{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3], gPhs[4]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed 2nd 2', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2], phs[5]]}]);
    component.mediaToRender = [{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {
      name: '2',
      media: [gPhs[2], gPhs[5], gPhs[3], gPhs[4]]
    }];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed 2nd 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[5]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed from 1st', media: [phs[0]]}, {name: '2', media: [phs[2], phs[3], phs[4]]}]);
    component.mediaToRender = [{name: 'removed from 1st', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3], gPhs[4]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed from 1st', media: [gPhs[0]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed 2nd', media: [phs[0], phs[1]]}, {name: '2', media: [phs[2]]}]);
    component.mediaToRender = [{name: 'removed 2nd', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed 2nd', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'removed from 1st 2', media: [phs[0]]}, {name: '2', media: [phs[2], phs[3]]}]);
    component.mediaToRender = [{name: 'removed from 1st 2', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'removed from 1st 2', media: [gPhs[0]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: 'merged', media: [phs[0], phs[1], phs[2], phs[3]]}]);
    component.mediaToRender = [{name: 'merged dif name', media: [gPhs[0], gPhs[1]]}, {name: '2', media: [gPhs[2], gPhs[3]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'merged', media: [gPhs[0]]}]);
    /*-----------------------*/
    fixture.componentRef.setInput('mediaGroups', [{name: '3', media: [phs[0], phs[1], phs[2], phs[3]]}]);
    component.mediaToRender = [{name: '1', media: [gPhs[0], gPhs[1], gPhs[3], gPhs[2]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: '3', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    resetData();
    gPhs[1].rowId = 3;
    gPhs[3].rowId = 3;
    gPhs[2].rowId = 3;
    fixture.componentRef.setInput('mediaGroups', [{name: '3', media: [phs[0], phs[1], phs[2], phs[3]]}]);
    component.mediaToRender = [{name: '1', media: [gPhs[0], gPhs[1], gPhs[3], gPhs[2]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: '3', media: [gPhs[0]]}]);
    /*-----------------------*/
    resetData();
    gPhs[0].rowId = 1;
    gPhs[1].rowId = 1;
    gPhs[2].rowId = 3;
    gPhs[3].rowId = 3;
    gPhs[4].rowId = 4;
    gPhs[5].rowId = 4;
    fixture.componentRef.setInput('mediaGroups', [{name: 'X', media: [phs[0], phs[1], phs[2], phs[3], phs[4], phs[5], phs[6]]}]);
    component.mediaToRender = [{name: '1', media: [gPhs[0], gPhs[1], gPhs[2], gPhs[3]]}, {name: '2', media: [gPhs[4], gPhs[5]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: 'X', media: [gPhs[0], gPhs[1]]}]);
    /*-----------------------*/
    resetData();
    gPhs[0].rowId = 1;
    gPhs[1].rowId = 1;
    gPhs[2].rowId = 3;
    gPhs[3].rowId = 3;
    gPhs[4].rowId = 5;
    gPhs[5].rowId = 5;
    fixture.componentRef.setInput('mediaGroups', [{name: '1', media: [phs[0], phs[1], phs[2], phs[3]]}, {name: '2', media: [phs[4], phs[5]]}]);
    component.mediaToRender = [{name: 'X', media: [gPhs[0], gPhs[1], gPhs[2], gPhs[3], gPhs[4], gPhs[5]]}];
    component.mergeNewPhotos();
    expect(component.mediaToRender).toEqual([{name: '1', media: [gPhs[0], gPhs[1], gPhs[2], gPhs[3]]}]);

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
    component.mediaToRender = [];
    component.renderARow();
    component.renderARow();
    const heights = component.mediaToRender.map(g => g.media.map(m => m.renderHeight));
    expect(heights).toEqual([[heights[0][0]], [heights[0][0], heights[0][0]]]);
  });
});
