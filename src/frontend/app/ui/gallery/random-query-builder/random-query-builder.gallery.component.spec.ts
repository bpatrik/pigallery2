import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {ActivatedRoute, Params} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {BsModalService} from 'ngx-bootstrap/modal';
import '../../../../../common/config/public/Config';
import {RandomQueryBuilderGalleryComponent} from './random-query-builder.gallery.component';
import {ContentLoaderService} from '../contentLoader.service';
import {NotificationService} from '../../../model/notification.service';
import {SearchQueryParserService} from '../search/search-query-parser.service';
import {ContentWrapperWithError} from '../../../../../common/entities/ContentWrapper';
import {DirectorySearch, SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../common/entities/SearchQueryDTO';
import {QueryParams} from '../../../../../common/QueryParams';
import {SearchQueryUtils} from '../../../../../common/SearchQueryUtils';

describe('RandomQueryBuilderGalleryComponent', () => {
  let component: RandomQueryBuilderGalleryComponent;
  let content: ReturnType<typeof signal<ContentWrapperWithError>>;
  let routeParams: BehaviorSubject<Params>;
  let modalService: { show: ReturnType<typeof vi.fn> };
  let notificationService: { success: ReturnType<typeof vi.fn> };

  const folder = (path: string, name: string): ContentWrapperWithError =>
    ({directory: {path, name}} as unknown as ContentWrapperWithError);

  beforeEach(() => {
    content = signal<ContentWrapperWithError>({} as ContentWrapperWithError);
    routeParams = new BehaviorSubject<Params>({});
    modalService = {
      show: vi.fn().mockReturnValue({hide: vi.fn()}),
    };
    notificationService = {
      success: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        {provide: ContentLoaderService, useValue: {content}},
        {provide: ActivatedRoute, useValue: {params: routeParams.asObservable()}},
        {provide: BsModalService, useValue: modalService},
        {provide: NotificationService, useValue: notificationService},
        {provide: SearchQueryParserService, useValue: {}},
      ],
    });

    TestBed.overrideComponent(RandomQueryBuilderGalleryComponent, {set: {template: '', imports: []}});
    component = TestBed.createComponent(RandomQueryBuilderGalleryComponent).componentInstance;
  });

  it('should be disabled when there is no directory', () => {
    expect(component.enabled()).toBe(false);
    expect(component.openModal({} as never)).toBeUndefined();
  });

  it('should prefill any_text for root directory', () => {
    content.set(folder('.', ''));
    expect(component.enabled()).toBe(true);
    expect(component.searchQueryDTO()).toEqual({
      type: SearchQueryTypes.any_text,
      value: '',
    });
  });

  it('should prefill globMatch for subdirectories and encode URL properly', () => {
    content.set(folder('holidays', 'summer'));
    expect(component.enabled()).toBe(true);
    const expectedQuery: DirectorySearch = {
      type: SearchQueryTypes.directory,
      matchType: TextSearchQueryMatchTypes.globMatch,
      value: 'holidays/summer/*',
    };
    expect(component.searchQueryDTO()).toEqual(expectedQuery);

    const expectedUrlPart = encodeURIComponent(SearchQueryUtils.urlify(expectedQuery));
    expect(component.url()).toContain(expectedUrlPart);
    expect(component.url()).toContain('/gallery/random/' + expectedUrlPart);
  });

  it('should preserve user edits within the same directory', () => {
    content.set(folder('holidays', 'summer'));
    const customQuery: TextSearch = {
      type: SearchQueryTypes.any_text,
      value: 'custom-tag',
    };
    component.searchQueryDTO.set(customQuery);
    expect(component.searchQueryDTO()).toEqual(customQuery);

    // Trigger same directory update
    content.set(folder('holidays', 'summer'));
    expect(component.searchQueryDTO()).toEqual(customQuery);
  });

  it('should reset prefill when directory path changes', () => {
    content.set(folder('holidays', 'summer'));
    component.searchQueryDTO.set({type: SearchQueryTypes.any_text, value: 'custom'} as TextSearch);

    content.set(folder('holidays', 'winter'));
    expect(component.searchQueryDTO()).toEqual({
      type: SearchQueryTypes.directory,
      matchType: TextSearchQueryMatchTypes.globMatch,
      value: 'holidays/winter/*',
    });
  });

  it('should update query when route params change', () => {
    const routeQuery: TextSearch = {
      type: SearchQueryTypes.any_text,
      value: 'from-route',
    };
    routeParams.next({
      [QueryParams.gallery.search.query]: SearchQueryUtils.urlify(routeQuery),
    });

    expect(component.searchQueryDTO()).toEqual(routeQuery);
  });

  it('should open and hide modal when enabled', () => {
    content.set(folder('test', 'dir'));
    const fakeTemplate = {} as never;
    const res = component.openModal(fakeTemplate);
    expect(res).toBe(false);
    expect(modalService.show).toHaveBeenCalledWith(fakeTemplate, {class: 'modal-lg'});

    const hideSpy = component.modalRef!.hide as ReturnType<typeof vi.fn>;
    component.hideModal();
    expect(hideSpy).toHaveBeenCalled();
    expect(component.modalRef).toBeNull();
  });

  it('should notify on copy', () => {
    component.onCopy();
    expect(notificationService.success).toHaveBeenCalled();
  });
});
