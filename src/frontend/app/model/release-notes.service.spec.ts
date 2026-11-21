import type {Mocked} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {ApplicationRef, signal, WritableSignal} from '@angular/core';
import {ReleaseNotesService} from './release-notes.service';
import {NetworkService} from './network/network.service';
import {AuthenticationService} from './network/authentication.service';
import {ReleaseNotesDTO} from '../../../common/entities/ReleaseNotesDTO';

describe('ReleaseNotesService', () => {
  let networkService: Mocked<NetworkService>;
  let isAdmin: WritableSignal<boolean>;

  const releaseNotes = (appVersion: string | null, seenVersion: string | null, notes: string | null = '## Main new features\n\n- Albums'): ReleaseNotesDTO => ({
    build: {appVersion, buildTime: null, buildCommitHash: null, upTime: null, isDocker: false, nodeVersion: 'v22.0.0', platform: 'linux/arm64'},
    notes,
    seenVersion
  });

  const setUp = async (dto: ReleaseNotesDTO, admin = true): Promise<ReleaseNotesService> => {
    networkService = {
      getJson: vi.fn().mockResolvedValue(dto),
      postJson: vi.fn().mockResolvedValue('ok'),
    } as unknown as Mocked<NetworkService>;
    isAdmin = signal(admin);
    TestBed.configureTestingModule({
      providers: [
        ReleaseNotesService,
        {provide: NetworkService, useValue: networkService},
        {provide: AuthenticationService, useValue: {isAdmin}},
      ]
    });
    const service = TestBed.inject(ReleaseNotesService);
    // loads the notes, then runs the effect that opens the popup
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    return service;
  };

  describe('isUnseen', () => {
    it('should be unseen when the admin confirmed an other version', () => {
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.8.0', null))).toBe(true);
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.8.0', '3.7.0'))).toBe(true);
      // a downgrade shows the notes again
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.7.0', '3.8.0'))).toBe(true);
    });

    it('should be seen when the admin confirmed this version', () => {
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.8.0', '3.8.0'))).toBe(false);
    });

    it('should show a release candidate, but not edge', () => {
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.8.0-rc.1', '3.7.0'))).toBe(true);
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.9.0-edge', '3.8.0'))).toBe(false);
    });

    it('should not show empty notes', () => {
      expect(ReleaseNotesService.isUnseen(releaseNotes('3.8.0', null, null))).toBe(false);
      expect(ReleaseNotesService.isUnseen(releaseNotes(null, null))).toBe(false);
    });
  });

  describe('cleanNotes', () => {
    it('should drop the comment and the empty sections', () => {
      const markdown = '<!--\nfor the writers\n-->\n\n## Breaking changes\n\n## Main new features\n\n- Árvíztűrő albums\n\n## Further changes\n';
      expect(ReleaseNotesService.cleanNotes(markdown)).toBe('## Main new features\n\n- Árvíztűrő albums');
    });

    it('should be null without content', () => {
      expect(ReleaseNotesService.cleanNotes('<!-- template -->\n## Breaking changes\n\n## Further changes\n')).toBe(null);
      expect(ReleaseNotesService.cleanNotes(null)).toBe(null);
    });
  });

  it('should not open the popup for notes with empty sections only', async () => {
    const service = await setUp(releaseNotes('3.8.0', '3.7.0', '<!-- template -->\n## Breaking changes\n'));
    expect(service.notes()?.notes).toBe(null);
    expect(service.isOpen()).toBe(false);
  });

  it('should open the popup for an admin who has not seen the version, and save it as seen on close', async () => {
    const service = await setUp(releaseNotes('3.8.0', '3.7.0'));
    expect(networkService.getJson).toHaveBeenCalledWith('/admin/release-notes');
    expect(service.isOpen()).toBe(true);

    await service.close();
    expect(service.isOpen()).toBe(false);
    expect(networkService.postJson).toHaveBeenCalledExactlyOnceWith('/admin/release-notes/seen');
    expect(service.notes()?.seenVersion).toBe('3.8.0');

    // opened again from the about page: closing it does not save it again
    service.open();
    await service.close();
    expect(networkService.postJson).toHaveBeenCalledOnce();
  });

  it('should not open the popup when the admin saw the version', async () => {
    const service = await setUp(releaseNotes('3.8.0', '3.8.0'));
    expect(service.isOpen()).toBe(false);
  });

  it('should not load the notes for a non-admin', async () => {
    const service = await setUp(releaseNotes('3.8.0', null), false);
    expect(networkService.getJson).not.toHaveBeenCalled();
    expect(service.notes()).toBe(null);
    expect(service.isOpen()).toBe(false);
  });
});
