// eslint-disable-next-line @typescript-eslint/no-var-requires
import {DBTestHelper} from '../../../DBTestHelper';
import {Connection} from 'typeorm';
import {SessionContext} from '../../../../../src/backend/model/SessionContext';
import {ObjectManagers} from '../../../../../src/backend/model/ObjectManagers';
import {SQLConnection} from '../../../../../src/backend/model/database/SQLConnection';

import {DefaultsJobs} from '../../../../../src/common/entities/job/JobDTO';
import {JobRepository} from '../../../../../src/backend/model/jobs/JobRepository';
import {Config} from '../../../../../src/common/config/private/Config';
import {UserEntity} from '../../../../../src/backend/model/database/enitites/UserEntity';
import {UserDTO} from '../../../../../src/common/entities/UserDTO';

const deepEqualInAnyOrder = require('deep-equal-in-any-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chai = require('chai');

chai.use(deepEqualInAnyOrder);
const {expect} = chai;

// to help WebStorm to handle the test cases
declare let describe: any;
declare const before: any;
declare const after: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;
const tmpDescribe = describe;
describe = DBTestHelper.describe();


describe('AlbumCoverFillingJob', (sqlHelper: DBTestHelper) => {
  describe = tmpDescribe;

  let connection: Connection;

  const waitForJobToFinish = async (jobName: string, timeout = 5000): Promise<void> => {
    const start = Date.now();
    // find the job instance by name in repository
    const job = JobRepository.Instance.getAvailableJobs().find(j => j.Name === jobName);
    if (!job) {
      throw new Error('Job not found: ' + jobName);
    }
    while (job.InProgress && Date.now() - start < timeout) {
      await new Promise(res => setTimeout(res, 10));
    }
    if (job.InProgress) {
      throw new Error('Job did not finish in time: ' + jobName);
    }
  };

  before(async () => {
    await sqlHelper.initDB();
    await sqlHelper.setUpTestGallery();
    connection = await SQLConnection.getConnection();
  });

  after(sqlHelper.clearDB);


  it('runs full flow: Persons -> Albums -> Directory for all sessions and directories', async () => {
    // Arrange: fake sessions
    const s1 = new SessionContext();
    const s2 = new SessionContext();
    s1.user = {projectionKey: 'pk1'} as UserDTO;
    s2.user = {projectionKey: 'pk2'} as UserDTO;
    const sessions = [s1, s2];

    // Stub SessionManager.getAvailableUserSessions
    const origGetSessions = ObjectManagers.getInstance().SessionManager.getAvailableUserSessions;
    (ObjectManagers.getInstance().SessionManager as any).getAvailableUserSessions = (() => Promise.resolve(sessions)) as any;

    // Prepare directories: two directories without covers, and then empty on re-fetch
    const dirs = [
      {id: 1, name: 'd1', path: '/a/'},
      {id: 2, name: 'd2', path: '/b/'}
    ];
    let coverCall = 0;
    const origGetDirs = ObjectManagers.getInstance().CoverManager.getPartialDirsWithoutCovers;
    (ObjectManagers.getInstance().CoverManager as any).getPartialDirsWithoutCovers = (async (): Promise<any[]> => {
      coverCall++;
      return coverCall === 1 ? dirs.slice() : [];
    }) as any;

    // Spy PersonManager.getAll and AlbumManager.getAll counts
    let personCalls = 0;
    let albumCalls = 0;
    const origGetAllPersons = ObjectManagers.getInstance().PersonManager.getAll;
    const origGetAllAlbums = ObjectManagers.getInstance().AlbumManager.getAll;
    (ObjectManagers.getInstance().PersonManager as any).getAll = ((..._args: any[]) => {
      personCalls++;
      return Promise.resolve([]);
    }) as any;
    (ObjectManagers.getInstance().AlbumManager as any).getAll = ((..._args: any[]) => {
      albumCalls++;
      return Promise.resolve([]);
    }) as any;

    // Spy ProjectedCacheManager.setAndGetCacheForDirectory calls and arguments
    let cacheCalls = 0;
    const cacheArgs: any[] = [];
    const origSetAndGetCache = ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory;
    (ObjectManagers.getInstance().ProjectedCacheManager as any).setAndGetCacheForDirectory = (async (...args: any[]) => {
      cacheCalls++;
      cacheArgs.push(args);
      return Promise.resolve({} as any);
    }) as any;

    try {
      // Act: run the job via JobManager
      const jobName = DefaultsJobs[DefaultsJobs['Album Cover Filling']];
      await ObjectManagers.getInstance().JobManager.run(jobName, {} as any, true, false);
      await waitForJobToFinish(jobName);

      // Assert
      expect(coverCall).to.equal(2, 'CoverManager.getPartialDirsWithoutCovers should be called twice (initial + refresh)');
      expect(personCalls).to.equal(sessions.length, 'PersonManager.getAll should be called once per session');
      expect(albumCalls).to.equal(sessions.length, 'AlbumManager.getAll should be called once per session');
      expect(cacheCalls).to.equal(sessions.length * dirs.length, 'Cache should be built for each session-directory pair');

      // Check a couple of argument shapes to ensure proper call order
      for (let i = 0; i < cacheArgs.length; i++) {
        // args: (conn, session, directory)
        expect(cacheArgs[i][0]).to.equal(connection);
        expect(sessions).to.include(cacheArgs[i][1]);
        expect(dirs.map(d => d.id)).to.include(cacheArgs[i][2].id);
      }
    } finally {
      // Restore stubs
      (ObjectManagers.getInstance().SessionManager as any).getAvailableUserSessions = origGetSessions;
      (ObjectManagers.getInstance().CoverManager as any).getPartialDirsWithoutCovers = origGetDirs;
      (ObjectManagers.getInstance().PersonManager as any).getAll = origGetAllPersons;
      (ObjectManagers.getInstance().AlbumManager as any).getAll = origGetAllAlbums;
      (ObjectManagers.getInstance().ProjectedCacheManager as any).setAndGetCacheForDirectory = origSetAndGetCache;
    }
  });

  it('handles no directories gracefully (still refreshes once, no cache calls)', async () => {
    // Arrange sessions
    const s1 = new SessionContext();
    s1.user = {projectionKey: 'pk1'} as UserDTO;
    const sessions = [s1];
    const origGetSessions = ObjectManagers.getInstance().SessionManager.getAvailableUserSessions;
    (ObjectManagers.getInstance().SessionManager as any).getAvailableUserSessions = (() => Promise.resolve(sessions)) as any;

    // No directories on initial and refresh
    let coverCall = 0;
    const origGetDirs = ObjectManagers.getInstance().CoverManager.getPartialDirsWithoutCovers;
    (ObjectManagers.getInstance().CoverManager as any).getPartialDirsWithoutCovers = (async (): Promise<any> => {
      coverCall++;
      return [];
    }) as any;

    // Count person/album loads
    let personCalls = 0;
    let albumCalls = 0;
    const origGetAllPersons = ObjectManagers.getInstance().PersonManager.getAll;
    const origGetAllAlbums = ObjectManagers.getInstance().AlbumManager.getAll;
    (ObjectManagers.getInstance().PersonManager as any).getAll = ((..._args: any[]) => {
      personCalls++;
      return Promise.resolve([]);
    }) as any;
    (ObjectManagers.getInstance().AlbumManager as any).getAll = ((..._args: any[]) => {
      albumCalls++;
      return Promise.resolve([]);
    }) as any;

    // Ensure no cache calls happen
    let cacheCalls = 0;
    const origSetAndGetCache = ObjectManagers.getInstance().ProjectedCacheManager.setAndGetCacheForDirectory;
    (ObjectManagers.getInstance().ProjectedCacheManager as any).setAndGetCacheForDirectory = (async (..._args: any[]) => {
      cacheCalls++;
      return Promise.resolve({} as any);
    }) as any;

    try {
      const jobName = DefaultsJobs[DefaultsJobs['Album Cover Filling']];
      await ObjectManagers.getInstance().JobManager.run(jobName, {} as any, true, false);
      await waitForJobToFinish(jobName);

      expect(coverCall).to.equal(2, 'CoverManager.getPartialDirsWithoutCovers should be called twice (initial + refresh)');
      expect(personCalls).to.equal(sessions.length);
      expect(albumCalls).to.equal(sessions.length);
      expect(cacheCalls).to.equal(0, 'No cache calls when there are no directories');
    } finally {
      (ObjectManagers.getInstance().SessionManager as any).getAvailableUserSessions = origGetSessions;
      (ObjectManagers.getInstance().CoverManager as any).getPartialDirsWithoutCovers = origGetDirs;
      (ObjectManagers.getInstance().PersonManager as any).getAll = origGetAllPersons;
      (ObjectManagers.getInstance().AlbumManager as any).getAll = origGetAllAlbums;
      (ObjectManagers.getInstance().ProjectedCacheManager as any).setAndGetCacheForDirectory = origSetAndGetCache;
    }
  });

  it('should finish when authentication is not required', async () => {
    Config.Users.authenticationRequired = false;
    await connection.getRepository(UserEntity).deleteAll();

    const runJob = async (jobName: string) => {
      await ObjectManagers.getInstance().JobManager.run(jobName, {} as any, true, false);
      await waitForJobToFinish(jobName);
    };
    await runJob(DefaultsJobs[DefaultsJobs['Album Cover Reset']]);
    await runJob(DefaultsJobs[DefaultsJobs['Album Cover Filling']]);
  });
});
