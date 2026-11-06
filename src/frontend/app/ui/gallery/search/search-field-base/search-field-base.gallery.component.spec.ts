import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {GallerySearchFieldBaseComponent} from './search-field-base.gallery.component';
import {AutoCompleteResult, AutoCompleteService, RenderableAutoCompleteItem} from '../autocomplete.service';

describe('GallerySearchFieldBaseComponent - autocomplete', () => {

  const item = (value: string): RenderableAutoCompleteItem => ({value, queryHint: value});

  const deferred = () => {
    let resolve!: (items: RenderableAutoCompleteItem[]) => void;
    const promise = new Promise<RenderableAutoCompleteItem[]>((r) => resolve = r);
    return {promise, resolve};
  };

  const setUp = (results: AutoCompleteResult[]) => {
    const autoCompleteService = {
      autoComplete: vi.fn().mockImplementation(() => results.shift()),
      getPrefixLessSearchText: (text: string): string => text,
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });
    // the component provides its own AutoCompleteService
    TestBed.overrideComponent(GallerySearchFieldBaseComponent, {
      set: {providers: [{provide: AutoCompleteService, useValue: autoCompleteService}]}
    });
    const component = TestBed.createComponent(GallerySearchFieldBaseComponent).componentInstance;
    return {component, autoCompleteService};
  };

  const type = (component: GallerySearchFieldBaseComponent, text: string): void => {
    component.rawSearchText.set(text);
    component.onSearchChange();
  };

  const values = (component: GallerySearchFieldBaseComponent): string[] =>
    component.autoCompleteRenders().map((r) => r.text);

  it('should show the keywords first, then the server results', async () => {
    const server = deferred();
    const {component} = setUp([{items: [item('árvíztűrő')], more: server.promise}]);

    type(component, 'árv');
    expect(component.autoCompleteRenders().length).toBe(1);

    server.resolve([item('árvíztűrő'), item('árvácska')]);
    await vi.waitFor(() => expect(component.autoCompleteRenders().length).toBe(2));
  });

  it('should not let a late answer of an older request overwrite the newer results', async () => {
    const older = deferred();
    const newer = deferred();
    const {component, autoCompleteService} = setUp([
      {items: [], more: older.promise},
      {items: [], more: newer.promise},
    ]);

    type(component, 'Ál');
    type(component, 'Álmos');
    expect(autoCompleteService.autoComplete).toHaveBeenCalledTimes(2);

    newer.resolve([item('Álmos Ödön')]);
    await vi.waitFor(() => expect(component.autoCompleteRenders().length).toBe(1));

    older.resolve([item('Ál1'), item('Ál2')]);
    await older.promise;
    await new Promise((r) => setTimeout(r, 0));

    expect(values(component)).toEqual(['Álmos Ödön']);
  });
});
