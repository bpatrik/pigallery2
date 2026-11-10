import '../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA, signal} from '@angular/core';
import {provideRouter} from '@angular/router';
import {DuplicateComponent} from './duplicates.component';
import {DuplicateService} from './duplicates.service';
import {QueryService} from '../../model/query.service';
import {PiTitleService} from '../../model/pi-title.service';
import {FrameComponent} from '../frame/frame.component';
import {DuplicatesPhotoComponent} from './photo/photo.duplicates.component';
import {DuplicatesDTO} from '../../../../common/entities/DuplicatesDTO';
import {MediaDTO} from '../../../../common/entities/MediaDTO';

describe('DuplicateComponent', () => {

  const media = (dir: string, name: string): MediaDTO => ({
    name,
    directory: {path: '/', name: dir},
    metadata: {fileSize: 1024, creationDate: Date.UTC(2024, 6, 20, 10, 30), size: {width: 10, height: 10}}
  } as unknown as MediaDTO);

  /**
   * Renders the duplicates page (without the navbar and the thumbnails).
   * duplicates: null while the page is loading them.
   */
  const render = async (duplicates: DuplicatesDTO[] | null): Promise<HTMLElement> => {
    const duplicateService = {
      duplicates: signal<DuplicatesDTO[] | null>(duplicates),
      // never answers while loading
      getDuplicates: () => duplicates === null ? new Promise<void>(() => undefined) : Promise.resolve()
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: DuplicateService, useValue: duplicateService},
        {provide: QueryService, useValue: {params: signal({})}},
        {provide: PiTitleService, useValue: {setTitle: (): void => undefined}},
      ]
    });
    TestBed.overrideComponent(DuplicateComponent, {
      remove: {imports: [FrameComponent, DuplicatesPhotoComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
    const fixture = TestBed.createComponent(DuplicateComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('should list the duplicates with a summary', async () => {
    const el = await render([{media: [media('Balaton', 'Tihany.jpg'), media('Nyár', 'Tihany.jpg')]}]);
    expect(el.querySelector('.alert')!.textContent!.replace(/\s+/g, ' ')).toContain('Listing 1 duplicates (2 photos).');
    expect(el.querySelectorAll('.card').length).toBe(1);
    expect(el.querySelector('.card')!.textContent).toContain('/Nyár/');
    expect(el.textContent).not.toContain('No duplicates found');
  });

  // #1315: no duplicates is an empty state, not a blank page
  it('should tell that there are no duplicates when the list is empty', async () => {
    const el = await render([]);
    expect(el.querySelector('.alert')?.textContent?.trim()).toBe('No duplicates found');
    expect(el.querySelectorAll('.card').length).toBe(0);
    expect(el.textContent).not.toMatch(/Listing/);
  });

  // TODO #1315: while the duplicates load (it can take a while on a big gallery), the page shows a loading state;
  // today it says "No duplicates found" until they arrive
  it.fails('should show a loading state, not "No duplicates found", while loading', async () => {
    const el = await render(null);
    expect(el.textContent).not.toContain('No duplicates found');
    expect(el.querySelector('.spinner-border, [role="status"]') !== null || /loading/i.test(el.textContent ?? ''),
      'a loading indicator').toBe(true);
  });
});
