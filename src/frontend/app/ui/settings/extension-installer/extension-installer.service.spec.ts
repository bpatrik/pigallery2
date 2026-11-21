import {TestBed} from '@angular/core/testing';
import {ExtensionInstallerService} from './extension-installer.service';
import {NetworkService} from '../../../model/network/network.service';

describe('ExtensionInstallerService', () => {
  let service: ExtensionInstallerService;
  let network: { getJson: ReturnType<typeof vi.fn>, postJson: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    network = {getJson: vi.fn().mockResolvedValue([]), postJson: vi.fn().mockResolvedValue(undefined)};
    TestBed.configureTestingModule({providers: [{provide: NetworkService, useValue: network}]});
    service = TestBed.inject(ExtensionInstallerService);
  });

  it('should list the extensions of the repository', async () => {
    await service.getExtensions();
    expect(network.getJson).toHaveBeenCalledWith('/extension/list');
  });

  it('should install, reload and delete an extension', async () => {
    await service.installExtension('pigallery2-sample-extension');
    expect(network.postJson).toHaveBeenCalledWith('/extension/install', {id: 'pigallery2-sample-extension'});
    await service.reloadExtension('sample-extension');
    expect(network.postJson).toHaveBeenCalledWith('/extension/reload', {path: 'sample-extension'});
    await service.deleteExtension('sample-extension');
    expect(network.postJson).toHaveBeenCalledWith('/extension/delete', {path: 'sample-extension'});
  });

  it('should pass on a failed install', async () => {
    network.postJson.mockRejectedValue(new Error('npm install failed'));
    await expect(service.installExtension('broken')).rejects.toThrow('npm install failed');
  });
});
