import {NavigationService} from './navigation.service';
import {PublicSharingDTO} from '../../../common/entities/SharingDTO';
import {Config} from '../../../common/config/public/Config';
import {NavigationLinkConfig, NavigationLinkTypes} from '../../../common/config/public/ClientConfig';
import {SearchQueryTypes, TextSearch} from '../../../common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../common/SearchQueryUtils';

describe('NavigationService', () => {

  const setUp = (publicSharing: PublicSharingDTO, isSharing = true) => {
    const router = jasmine.createSpyObj('Router', ['navigate', 'isActive']);
    router.navigate.and.returnValue(Promise.resolve(true));
    const shareService = {
      wait: () => Promise.resolve(),
      isSharing: () => isSharing,
      getSharingKey: () => 'key',
      getPublicSharing: jasmine.createSpy('getPublicSharing').and.returnValue(Promise.resolve(publicSharing))
    };
    const service = new NavigationService(router, shareService as any);
    return {router, shareService, service};
  };

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
      await service.toLogin();
      expect(router.navigate).toHaveBeenCalledWith(['error']);
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
      await service.toDefault();
      expect(router.navigate).toHaveBeenCalledOnceWith(['gallery', '']);
    });
  });
});
