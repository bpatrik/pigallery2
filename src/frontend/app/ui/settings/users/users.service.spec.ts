import {TestBed} from '@angular/core/testing';
import {UsersSettingsService} from './users.service';
import {NetworkService} from '../../../model/network/network.service';
import {UserDTO, UserRoles} from '../../../../../common/entities/UserDTO';

describe('UsersSettingsService', () => {
  let service: UsersSettingsService;
  let network: { getJson: ReturnType<typeof vi.fn>, putJson: ReturnType<typeof vi.fn>, postJson: ReturnType<typeof vi.fn>, deleteJson: ReturnType<typeof vi.fn> };
  const user = {id: 7, name: 'alice', password: 'pass', role: UserRoles.User} as UserDTO;

  beforeEach(() => {
    network = {
      getJson: vi.fn().mockResolvedValue([user]),
      putJson: vi.fn().mockResolvedValue(undefined),
      postJson: vi.fn().mockResolvedValue(undefined),
      deleteJson: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({providers: [{provide: NetworkService, useValue: network}]});
    service = TestBed.inject(UsersSettingsService);
  });

  it('should list the users', async () => {
    expect(await service.getUsers()).toEqual([user]);
    expect(network.getJson).toHaveBeenCalledWith('/user/list');
  });

  it('should create a user', async () => {
    await service.createUser(user);
    expect(network.putJson).toHaveBeenCalledWith('/user', {newUser: user});
  });

  it('should delete a user by id', async () => {
    await service.deleteUser(user);
    expect(network.deleteJson).toHaveBeenCalledWith('/user/7');
  });

  it('should change the role of a user', async () => {
    await service.updateRole({...user, role: UserRoles.Guest});
    expect(network.postJson).toHaveBeenCalledWith('/user/7/role', {newRole: UserRoles.Guest});
  });

  it('should save the settings of a user', async () => {
    const settings = {overrideAllowBlockList: true, allowQuery: null, blockQuery: null} as never;
    await service.updateSettings(7, settings);
    expect(network.postJson).toHaveBeenCalledWith('/user/7/settings', {settings});
  });

  it('should unlink the OIDC account of a user', async () => {
    await service.unlinkOidc(user);
    expect(network.deleteJson).toHaveBeenCalledWith('/user/7/oidc');
  });

  it('should pass on a refused request (e.g. an admin deleting themselves)', async () => {
    network.deleteJson.mockRejectedValue(new Error('Not authorised'));
    await expect(service.deleteUser(user)).rejects.toThrow('Not authorised');
  });
});
