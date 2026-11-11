import {TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA, signal} from '@angular/core';
import {provideIcons} from '@ng-icons/core';
import {FacesComponent} from './faces.component';
import {FacesService} from './faces.service';
import {QueryService} from '../../model/query.service';
import {PiTitleService} from '../../model/pi-title.service';
import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {SortByDirectionalTypes} from '../../../../common/entities/SortingMethods';
import {FrameComponent} from '../frame/frame.component';
import {FaceComponent} from './face/face.component';
import {FacesNavigatorComponent} from './navigator/navigator.faces.component';
import {appIcons} from '../../icons';

describe('FacesComponent - empty state', () => {

  const render = async (persons: PersonDTO[]): Promise<HTMLElement> => {
    const facesService = {
      persons: signal(persons),
      sorting: signal({method: SortByDirectionalTypes.Name, ascending: true}),
      getPersons: () => Promise.resolve()
    } as unknown as FacesService;
    TestBed.configureTestingModule({
      providers: [
        provideIcons(appIcons),
        {provide: FacesService, useValue: facesService},
        {provide: QueryService, useValue: null},
        {provide: PiTitleService, useValue: {setTitle: (): void => undefined}},
      ]
    });
    // the navbar (app-frame) and the face cards are not needed: only the faces page itself is rendered
    TestBed.overrideComponent(FacesComponent, {
      remove: {imports: [FrameComponent, FaceComponent, FacesNavigatorComponent]},
      add: {schemas: [NO_ERRORS_SCHEMA]}
    });
    const fixture = TestBed.createComponent(FacesComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  /**
   * The block that tells that there are no faces.
   */
  const emptyState = (el: HTMLElement): HTMLElement | null => el.querySelector('.no-face-msg');

  // the second name has accents: non-ASCII person names must be listed too
  it('should list the faces, accented names too, without the empty state', async () => {
    const el = await render([
      {id: 1, name: 'Alice', isFavourite: false} as PersonDTO,
      {id: 2, name: 'Árvíztűrő Tükörfúrógép', isFavourite: true} as PersonDTO,
    ]);
    expect(emptyState(el)).toBeNull();
    expect(el.querySelectorAll('app-face').length).toBe(2);
  });

  it('should tell that there are no faces', async () => {
    const el = await render([]);
    expect(emptyState(el)?.textContent).toContain('No faces to show.');
    expect(el.querySelectorAll('app-face').length).toBe(0);
  });

  // TODO #1312: an icon and a short explanation (faces come from the face regions in the photos' metadata), not only ":( No faces to show."
  it.fails('should show an icon and a short explanation when there are no faces yet', async () => {
    const el = await render([]);
    const state = emptyState(el);
    expect(state, 'the empty state').not.toBeNull();
    expect(state!.querySelector('ng-icon'), 'icon of the empty state').not.toBeNull();
    expect(state!.textContent).toMatch(/metadata|tag|face region|keyword/i);
  });
});
