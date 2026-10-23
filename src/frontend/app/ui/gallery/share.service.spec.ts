import {Subject} from 'rxjs';
import {ShareService} from './share.service';
import {PublicSharingDTO, ResponseSharingDTO} from '../../../../common/entities/SharingDTO';

describe('ShareService', () => {

  const setUp = (publicSharing: PublicSharingDTO) => {
    const networkService = {
      getJson: jasmine.createSpy('getJson').and.callFake((url: string) =>
        url.endsWith('/publicInfo') ? Promise.resolve(publicSharing) : Promise.resolve(null))
    };
    const router = {events: new Subject()};
    const service = new ShareService(networkService as any, router as any);
    return {networkService, service};
  };

  describe('getPublicSharing', () => {
    it('should load the public info if it is not loaded yet', async () => {
      const {networkService, service} = setUp({sharingKey: 'key', passwordProtected: false});
      service.sharingKey = 'key'; // e.g.: set from the session user, not from the route
      expect(await service.getPublicSharing()).toEqual({sharingKey: 'key', passwordProtected: false});
      expect(networkService.getJson).toHaveBeenCalledWith('/share/key/publicInfo');

      // does not load it again
      networkService.getJson.calls.reset();
      await service.getPublicSharing();
      expect(networkService.getJson).not.toHaveBeenCalled();
    });

    it('should return null for not valid sharing', async () => {
      const {service} = setUp({sharingKey: 'other_key', passwordProtected: false});
      service.sharingKey = 'key';
      expect(await service.getPublicSharing()).toBeNull();
    });
  });

  describe('dropSharing', () => {
    it('should forget the sharing', async () => {
      const {service} = setUp({sharingKey: 'key', passwordProtected: false});
      service.sharingKey = 'key';
      await service.getPublicSharing();
      service.sharingSubject.next({sharingKey: 'key'} as ResponseSharingDTO);

      service.dropSharing();

      expect(service.isSharing()).toBeFalse();
      expect(service.getSharingKey()).toBeNull();
      expect(service.sharingSubject.value).toBeNull();
      expect(service.publicSharingSubject.value).toBeNull();
    });
  });
});
