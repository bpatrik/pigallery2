import '../../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {BsModalService} from 'ngx-bootstrap/modal';
import {of} from 'rxjs';
import {PhotoFrameBuilderGalleryComponent} from './photo-frame-builder.gallery.component';
import {ContentLoaderService} from '../contentLoader.service';
import {NotificationService} from '../../../model/notification.service';
import {Config} from '../../../../../common/config/public/Config';

// The smart photo frame link (#1313, CUJ 34): the current gallery URL with the lightbox playing on its own.
describe('PhotoFrameBuilderGalleryComponent', () => {
  let component: PhotoFrameBuilderGalleryComponent;
  let router: { url: string };
  let originalPublicUrl: string;
  let originalUrlBase: string;

  beforeEach(() => {
    originalPublicUrl = Config.Server.publicUrl;
    originalUrlBase = Config.Server.urlBase;
    Config.Server.publicUrl = 'https://photos.example.com';
    Config.Server.urlBase = '';
    router = {url: '/gallery/'};
    TestBed.configureTestingModule({
      providers: [
        {provide: ContentLoaderService, useValue: {}},
        {provide: NotificationService, useValue: {}},
        {provide: ActivatedRoute, useValue: {queryParams: of({})}},
        {provide: Router, useValue: router},
        {provide: BsModalService, useValue: {}},
      ]
    });
    component = TestBed.runInInjectionContext(() => new PhotoFrameBuilderGalleryComponent());
  });

  afterEach(() => {
    component.ngOnDestroy();
    Config.Server.publicUrl = originalPublicUrl;
    Config.Server.urlBase = originalUrlBase;
  });

  const build = (url: string): URL => {
    router.url = url;
    component.onOptionsChange();
    return new URL(component.url);
  };

  // an accented photo name: non-ASCII names must survive the url encoding
  it('should build a public link of the current folder and photo that plays on its own', () => {
    const url = build('/gallery/' + encodeURIComponent('Holiday 2024') + '?p=' + encodeURIComponent('árvíztűrő.jpg'));

    expect(url.origin).toBe('https://photos.example.com');
    expect(decodeURIComponent(url.pathname)).toBe('/gallery/Holiday 2024');
    expect(url.searchParams.get('p')).toBe('árvíztűrő.jpg');
    // the defaults: playing, polling and moving on every 5 minutes, looping, caption on, controls hidden
    expect(Object.fromEntries(url.searchParams)).toEqual({
      p: 'árvíztűrő.jpg',
      play: 'true',
      auInt: '300',
      ls: 'true',
      cAO: 'true',
      cd: 'true',
      ssp: '300',
      tlt: 'titleordirectory',
      tlst: 'caption',
      blt: 'date,location',
      blst: 'persons',
    });
  });

  it('should keep a search and add the urlBase', () => {
    Config.Server.urlBase = '/myGallery';
    const query = encodeURIComponent('{"t":104,"v":"Árvíztűrő"}');
    const url = build('/search/' + query);

    expect(url.pathname).toBe('/myGallery/search/' + query);
    expect(url.searchParams.get('play')).toBe('true');
  });

  it('should leave out the options that are turned off', () => {
    component.loopSlideshow = false;
    component.captionAlwaysOn = false;
    component.hideControls = false;
    component.slideshowSpeed = 0;
    component.topLeftTitle = [];
    component.topLeftSubtitle = [];
    component.bottomLeftTitle = ['NONE'];
    component.bottomLeftSubtitle = [];
    const url = build('/gallery/');

    expect(Object.fromEntries(url.searchParams)).toEqual({play: 'true', auInt: '300'});
  });

  it('should use the chosen slideshow speed and poll interval', () => {
    component.slideshowSpeed = 30;
    component.autoPollInterval = 60;
    const url = build('/gallery/?p=a.jpg');

    expect(url.searchParams.get('ssp')).toBe('30');
    expect(url.searchParams.get('auInt')).toBe('60');
  });

  it('should override the playback options of the current URL', () => {
    component.loopSlideshow = false;
    const url = build('/gallery/?play=false&ls=true&ssp=7');

    expect(url.searchParams.get('play')).toBe('true');
    expect(url.searchParams.has('ls')).toBe(false);
    expect(url.searchParams.get('ssp')).toBe('300');
  });
});
