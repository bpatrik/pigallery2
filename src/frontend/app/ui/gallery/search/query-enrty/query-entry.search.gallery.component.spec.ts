// load the client config first, like main.ts does; the component's enum translations import the private config
import '../../../../../../common/config/public/Config';
import {TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NgIconComponent, provideIcons} from '@ng-icons/core';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {GallerySearchQueryEntryComponent} from './query-entry.search.gallery.component';
import {appIcons} from '../../../../icons';
import {ANDSearchQuery, SearchQueryTypes, TextSearch} from '../../../../../../common/entities/SearchQueryDTO';

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
});
