// load the client config first, like main.ts does; the component's enum translations import the private config
import '../../../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NgIconComponent, provideIcons} from '@ng-icons/core';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {GallerySearchQueryEntryComponent} from './query-entry.search.gallery.component';
import {appIcons} from '../../../../icons';
import {
  ANDSearchQuery,
  OrientationSearch,
  RatingSearch,
  SearchQueryDTO,
  SearchQueryTypes,
  TextSearch,
  TextSearchQueryMatchTypes
} from '../../../../../../common/entities/SearchQueryDTO';

describe('GallerySearchQueryEntryComponent', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the add icon of a list query', async () => {
    const warn = vi.spyOn(console, 'warn');
    await TestBed.configureTestingModule({
      imports: [GallerySearchQueryEntryComponent],
      providers: [provideIcons(appIcons)]
    }).compileComponents();
    const fixture = TestBed.createComponent(GallerySearchQueryEntryComponent);
    fixture.componentInstance.writeValue({
      type: SearchQueryTypes.AND,
      list: [
        {type: SearchQueryTypes.any_text, value: 'Árvíztűrő'} as TextSearch,
        {type: SearchQueryTypes.any_text, value: 'tükörfúrógép'} as TextSearch
      ]
    } as ANDSearchQuery);
    fixture.detectChanges();
    await fixture.whenStable();

    const iconNames = fixture.debugElement.queryAll(By.directive(NgIconComponent))
      .map(d => (d.componentInstance as NgIconComponent).name());
    expect(iconNames).toContain('ionAddOutline');
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('No icon named'));
  });

  const create = async (query: SearchQueryDTO) => {
    await TestBed.configureTestingModule({
      imports: [GallerySearchQueryEntryComponent],
      providers: [provideIcons(appIcons)]
    }).compileComponents();
    const fixture = TestBed.createComponent(GallerySearchQueryEntryComponent);
    fixture.componentInstance.writeValue(query);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };
  const relationSelect = (fixture: Awaited<ReturnType<typeof create>>): HTMLSelectElement =>
    fixture.debugElement.query(By.css('#negateNA')).nativeElement as HTMLSelectElement;
  const selectedText = (select: HTMLSelectElement): string | undefined =>
    select.selectedIndex === -1 ? undefined : select.options[select.selectedIndex].textContent?.trim();

  it('shows the relation of a range query', async () => {
    const fixture = await create({type: SearchQueryTypes.rating, min: 1, max: 2} as RatingSearch);
    expect(fixture.componentInstance.SelectedMatchType).toBe('=');
    expect(selectedText(relationSelect(fixture))).toBe('=');
  });

  it('shows the negated relation of a range query', async () => {
    const fixture = await create({type: SearchQueryTypes.rating, min: 1, max: 2, negate: true} as RatingSearch);
    expect(fixture.componentInstance.SelectedMatchType).toBe('!=');
    expect(selectedText(relationSelect(fixture))).toBe('!=');
  });

  it('keeps != selected on a range query', async () => {
    const fixture = await create({type: SearchQueryTypes.rating, min: 1, max: 2} as RatingSearch);
    fixture.componentInstance.SelectedMatchType = '!=';
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.componentInstance.queryEntry() as RatingSearch).negate).toBe(true);
    expect(selectedText(relationSelect(fixture))).toBe('!=');
  });

  it('shows a relation after switching from a list query to a range query', async () => {
    const fixture = await create({
      type: SearchQueryTypes.OR,
      list: [
        {type: SearchQueryTypes.any_text, value: 'a'} as TextSearch,
        {type: SearchQueryTypes.any_text, value: 'b'} as TextSearch
      ]
    } as SearchQueryDTO);
    fixture.componentInstance.queryEntry()!.type = SearchQueryTypes.rating;
    fixture.componentInstance.onChangeType();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(selectedText(relationSelect(fixture))).toBe('=');
  });

  it('drops the text-only fields when switching from a text query to a range query', async () => {
    const fixture = await create({type: SearchQueryTypes.keyword, value: 'a', negate: true, matchType: TextSearchQueryMatchTypes.exact_match} as TextSearch);
    fixture.componentInstance.queryEntry()!.type = SearchQueryTypes.rating;
    fixture.componentInstance.onChangeType();
    expect(fixture.componentInstance.queryEntry()).toEqual({type: SearchQueryTypes.rating, negate: true});
  });

  it('offers no negation for orientation, as it has none', async () => {
    const fixture = await create({type: SearchQueryTypes.orientation, landscape: true} as OrientationSearch);
    expect(fixture.componentInstance.MatchingTypes.map(m => m.value)).toEqual(['=']);
    expect(selectedText(relationSelect(fixture))).toBe('=');
  });
});
