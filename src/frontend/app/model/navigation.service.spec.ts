import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {NavigationService} from './navigation.service';
import {ShareService} from '../ui/gallery/share.service';
import {PublicSharingDTO} from '../../../common/entities/SharingDTO';
import {Config} from '../../../common/config/public/Config';
import {NavigationLinkConfig, NavigationLinkTypes} from '../../../common/config/public/ClientConfig';
import {SearchQueryTypes, TextSearch} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

describe('NavigationService', () => {

  const setUp = (publicSharing: PublicSharingDTO, isSharing = true) => {
    const router = {navigate: vi.fn(), isActive: vi.fn()};
    router.navigate.mockReturnValue(Promise.resolve(true));
    const shareService = {
      wait: () => Promise.resolve(),
      isSharing: () => isSharing,
      getSharingKey: () => 'key',
      getPublicSharing: vi.fn().mockReturnValue(Promise.resolve(publicSharing))
    };
    TestBed.configureTestingModule({
      providers: [
        {provide: Router, useValue: router},
        {provide: ShareService, useValue: shareService},
      ]
    });
    const service = TestBed.inject(NavigationService);
    return {router, shareService, service};
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toLogin', () => {
    it('should navigate to share login for password protected sharing', async () => {
      const {router, shareService, service} = setUp({sharingKey: 'key', passwordProtected: true});
      await service.toLogin();
      expect(shareService.getPublicSharing).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['shareLogin'], {queryParams: {sk: 'key'}});
    });

    it('should navigate to error, if the sharing info is not available', async () => {
      // e.g.: logging out of a sharing that is not valid anymore
      const {router, service} = setUp(null);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.toLogin();
      expect(router.navigate).toHaveBeenCalledWith(['error']);
      expect(console.error).toHaveBeenCalledWith('Navigating to share login with an invalid sharing');
    });

    it('should navigate to login without sharing', async () => {
      const {router, shareService, service} = setUp(null, false);
      await service.toLogin();
      expect(shareService.getPublicSharing).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['login']);
    });
  });

  describe('toDefault', () => {
    let originalLinks: NavigationLinkConfig[];
    beforeEach(() => {
      originalLinks = Config.Gallery.NavBar.links;
    });
    afterEach(() => {
      Config.Gallery.NavBar.links = originalLinks;
    });

    it('should navigate to the url friendly search of the first link', async () => {
      const searchQuery = {type: SearchQueryTypes.any_text, value: 'cat'} as TextSearch;
      Config.Gallery.NavBar.links = [new NavigationLinkConfig(NavigationLinkTypes.search, 'Cats', searchQuery)];
      const {router, service} = setUp(null, false);
      await service.toDefault();
      expect(router.navigate).toHaveBeenCalledWith(['search', SearchQueryUtils.urlify(searchQuery)]);
    });

    it('should fall back to the gallery for a search link without a query (#1176)', async () => {
      Config.Gallery.NavBar.links = [new NavigationLinkConfig(NavigationLinkTypes.search)];
      const {router, service} = setUp(null, false);
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.toDefault();
      expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['gallery', '']);
      expect(console.error).toHaveBeenCalledWith('First navbar link is a search without a query, falling back to the gallery.');
    });
  });
});
