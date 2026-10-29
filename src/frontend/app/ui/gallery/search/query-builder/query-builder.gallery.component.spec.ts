import {Component} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {provideRouter} from '@angular/router';
import {NgIconsModule} from '@ng-icons/core';
import {ionTrashOutline} from '@ng-icons/ionicons';

import {GallerySearchQueryBuilderComponent} from './query-bulder.gallery.component';
import {GallerySearchQueryEntryComponent} from '../query-enrty/query-entry.search.gallery.component';
import {SearchQueryParserService} from '../search-query-parser.service';
import {AutoCompleteService} from '../autocomplete.service';
import {RangeSearch, SearchQueryDTO, SearchQueryTypes, TextSearch} from '../../../../../../common/entities/SearchQueryDTO';

@Component({
  template: `
    <form>
      <app-gallery-search-query-builder name="query" [(ngModel)]="query" />
    </form>`,
  imports: [FormsModule, GallerySearchQueryBuilderComponent]
})
class HostComponent {
  query: SearchQueryDTO = {type: SearchQueryTypes.any_text, value: ''} as TextSearch;
}

describe('GallerySearchQueryBuilderComponent - date range', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const builder = (): GallerySearchQueryBuilderComponent =>
    fixture.debugElement.query(By.directive(GallerySearchQueryBuilderComponent)).componentInstance;
  const entry = (): GallerySearchQueryEntryComponent =>
    fixture.debugElement.query(By.directive(GallerySearchQueryEntryComponent)).componentInstance;
  const dateInput = (id: 'date_min' | 'date_max'): HTMLInputElement =>
    fixture.debugElement.query(By.css('#' + id)).nativeElement;

  // ngModel writes values asynchronously, and the value passes host -> builder -> entry
  const render = async (): Promise<void> => {
    for (let i = 0; i < 3; ++i) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  const typeDate = async (id: 'date_min' | 'date_max', value: string): Promise<void> => {
    const input = dateInput(id);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await render();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, NgIconsModule.withIcons({ionTrashOutline})],
      providers: [
        SearchQueryParserService,
        provideRouter([]),
      ],
    })
      .overrideProvider(AutoCompleteService, {useValue: {}})
      .compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('should populate the search text when dates are picked', async () => {
    await render();

    // same as picking "date" in the type dropdown
    entry().queryEntry.type = SearchQueryTypes.date;
    entry().onChangeType();
    await render();

    await typeDate('date_min', '2024-01-10');
    await typeDate('date_max', '2024-02-20');

    const q = host.query as RangeSearch;
    expect(q.type).toBe(SearchQueryTypes.date);
    expect(q.min).toBe(Date.UTC(2024, 0, 10));
    expect(q.max).toBe(Date.UTC(2024, 1, 20));
    expect((q as unknown as TextSearch).value).toBeUndefined();
    expect(builder().rawSearchText).toBe('date:2024-01-10..2024-02-20');
  });

  it('should update the search text when the end date is deleted', async () => {
    host.query = {type: SearchQueryTypes.date, min: Date.UTC(2024, 0, 10), max: Date.UTC(2024, 1, 20)} as RangeSearch;
    await render();
    expect(builder().rawSearchText).toBe('date:2024-01-10..2024-02-20');
    expect(dateInput('date_max').value).toBe('2024-02-20');

    await typeDate('date_max', '');

    expect((host.query as RangeSearch).min).toBe(Date.UTC(2024, 0, 10));
    expect((host.query as RangeSearch).max).toBeUndefined();
    expect(builder().rawSearchText).toBe('date>=2024-01-10');
  });

  it('should update the search text when the start date is deleted', async () => {
    host.query = {type: SearchQueryTypes.date, min: Date.UTC(2024, 0, 10), max: Date.UTC(2024, 1, 20)} as RangeSearch;
    await render();

    await typeDate('date_min', '');

    expect((host.query as RangeSearch).min).toBeUndefined();
    expect((host.query as RangeSearch).max).toBe(Date.UTC(2024, 1, 20));
    expect(builder().rawSearchText).toBe('date<=2024-02-20');
  });

  it('should move the end date along when the start date is set after it', async () => {
    host.query = {type: SearchQueryTypes.date, min: Date.UTC(1903, 2, 31), max: Date.UTC(2024, 1, 20)} as RangeSearch;
    await render();

    await typeDate('date_min', '2026-10-14');

    expect((host.query as RangeSearch).min).toBe(Date.UTC(2026, 9, 14));
    expect((host.query as RangeSearch).max).toBe(Date.UTC(2026, 9, 14));
    expect(dateInput('date_max').value).toBe('2026-10-14');
    expect(builder().rawSearchText).toBe('date=2026-10-14');
  });

  it('should move the start date along when the end date is set before it', async () => {
    host.query = {type: SearchQueryTypes.date, min: Date.UTC(2026, 9, 14), max: Date.UTC(2027, 1, 20)} as RangeSearch;
    await render();

    await typeDate('date_max', '1903-03-31');

    expect((host.query as RangeSearch).min).toBe(Date.UTC(1903, 2, 31));
    expect((host.query as RangeSearch).max).toBe(Date.UTC(1903, 2, 31));
    expect(dateInput('date_min').value).toBe('1903-03-31');
    expect(builder().rawSearchText).toBe('date=1903-03-31');
  });

  it('should limit the date pickers to the other end of the range', async () => {
    host.query = {type: SearchQueryTypes.date, min: Date.UTC(2024, 0, 10), max: Date.UTC(2024, 1, 20)} as RangeSearch;
    await render();

    expect(dateInput('date_min').max).toBe('2024-02-20');
    expect(dateInput('date_max').min).toBe('2024-01-10');
  });

  it('should clear the search text when both dates are deleted', async () => {
    host.query = {type: SearchQueryTypes.date, min: Date.UTC(2024, 0, 10), max: Date.UTC(2024, 1, 20)} as RangeSearch;
    await render();

    await typeDate('date_max', '');
    await typeDate('date_min', '');

    expect(builder().rawSearchText).toBe('');
  });
});
