import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import AdmZip from 'adm-zip';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {UserDTO, UserRoles} from '../../../../src/common/entities/UserDTO';
import {
  DirectorySearch,
  ORSearchQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  TextSearch,
  TextSearchQueryMatchTypes
} from '../../../../src/common/entities/SearchQueryDTO';
import {AlbumBaseDTO} from '../../../../src/common/entities/album/AlbumBaseDTO';
import {Utils} from '../../../../src/common/Utils';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Hidden media never leaks (#1316): the same restricted user against every endpoint that returns media or data about it.
 *
 * The gallery has one visible photo and three kinds of hidden content:
 *  - secret.jpg: hidden by the user's media block list (its keyword); the only photo of the person 'Bambi'
 *  - 'private folder/': hidden by the user's directory block list, with a photo of 'Joe', a video and a gpx track
 * Every check first asks as an admin (no lists) and expects to see the hidden content, so a check can't pass by not
 * finding anything at all. Then it asks as the restricted user and expects to see none of it.
 * The admin asks first, so the checks also cover the projected caches (one cache entry per projection).
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Projection leak', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const assets = path.join(__dirname, '../../assets');
  const HIDDEN_DIR = 'private folder';
  const HIDDEN_KEYWORD = 'USA Road trip';
  const HIDDEN_ALBUM = 'album of Bambi';
  // what should never reach the restricted user
  const HIDDEN_FILES = ['secret.jpg', 'Portrait.jpg', 'video.mp4', 'track.gpx'];
  const HIDDEN = [...HIDDEN_FILES, HIDDEN_DIR, HIDDEN_KEYWORD, 'Bambi', 'Joe'];

  type TestUser = Omit<UserDTO, 'id'>;
  const admin: TestUser = {name: 'test-admin', password: 'test-admin', role: UserRoles.Admin};
  const restricted: TestUser = {
    name: 'restricted',
    password: 'restricted',
    role: UserRoles.User,
    overrideAllowBlockList: true,
    blockQuery: {type: SearchQueryTypes.keyword, value: HIDDEN_KEYWORD, matchType: TextSearchQueryMatchTypes.exact_match} as TextSearch,
    blockDirectoryList: [{type: SearchQueryTypes.directory, value: HIDDEN_DIR, matchType: TextSearchQueryMatchTypes.exact_match} as DirectorySearch]
  };

  // a query that matches every hidden media
  const hiddenQuery: ORSearchQuery = {
    type: SearchQueryTypes.OR,
    list: [
      {type: SearchQueryTypes.person, value: 'Bambi'} as TextSearch,
      {type: SearchQueryTypes.person, value: 'Joe'} as TextSearch,
      {type: SearchQueryTypes.directory, value: HIDDEN_DIR} as TextSearch,
    ]
  };
  const q = (query: SearchQueryDTO): string => encodeURIComponent(JSON.stringify(query));
  const hiddenDir = encodeURIComponent(HIDDEN_DIR);

  const createGallery = (folder: string): void => {
    fs.mkdirSync(path.join(folder, HIDDEN_DIR), {recursive: true});
    fs.copyFileSync(path.join(assets, 'exiftool.jpg'), path.join(folder, 'visible.jpg'));
    fs.copyFileSync(path.join(assets, 'edge_case_exif_data/before_epoch.jpg'), path.join(folder, 'secret.jpg'));
    fs.copyFileSync(path.join(assets, 'orientation/Portrait_1.jpg'), path.join(folder, HIDDEN_DIR, 'Portrait.jpg'));
    fs.copyFileSync(path.join(assets, 'video.mp4'), path.join(folder, HIDDEN_DIR, 'video.mp4'));
    fs.writeFileSync(path.join(folder, HIDDEN_DIR, 'track.gpx'),
      '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test"><trk><trkseg>' +
      '<trkpt lat="37.7" lon="-122.4"></trkpt><trkpt lat="34.0" lon="-118.2"></trkpt></trkseg></trk></gpx>');
  };

  let server: Server;
  const agents: Record<string, ReturnType<typeof request.agent>> = {};

  before(async () => {
    await sqlHelper.initDB();
    // initDB removes the tmp folder, so the gallery is created after it
    const folder = path.join(TestHelper.TMP_DIR, 'projection-gallery');
    createGallery(folder);
    Config.Users.authenticationRequired = true;
    Config.Media.Video.enabled = true;
    Config.Media.folder = folder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'projection-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();

    const om = ObjectManagers.getInstance();
    await om.IndexingManager.indexDirectory('.', true);
    await om.IndexingManager.indexDirectory(HIDDEN_DIR, true);
    await om.AlbumManager.addSavedSearch(HIDDEN_ALBUM, {type: SearchQueryTypes.person, value: 'Bambi'} as TextSearch);
    for (const user of [admin, restricted]) {
      await om.UserManager.createUser(Utils.clone(user) as UserDTO);
      const agent = request.agent(server.Server);
      const res = await agent.post(Config.Server.apiPath + '/user/login')
        .send({loginCredential: {username: user.name, password: user.password, rememberMe: false}});
      res.should.have.status(200);
      agents[user.name] = agent;
    }
  });

  after(async () => {
    Object.values(agents).forEach(a => a.close());
    await sqlHelper.clearDB();
  });

  interface Response {
    status: number;
    headers: Record<string, string>;
    body: Buffer;
  }

  const get = (user: TestUser, url: string): Promise<Response> =>
    agents[user.name].get(Config.Server.apiPath + url)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }) as unknown as Promise<Response>;

  const json = (res: Response): { error: unknown, result: any } => {
    expect(res.headers['content-type'], 'JSON response').to.contain('application/json');
    return JSON.parse(res.body.toString('utf8'));
  };

  /**
   * Returns the hidden names that the JSON result contains.
   * The echoed search query (e.g.: result.searchResult.searchQuery) is left out: it naturally contains what was searched for.
   */
  const hiddenInResult = (res: Response, hidden = HIDDEN): string[] => {
    const text = JSON.stringify(json(res).result ?? null, (key, value) => key === 'searchQuery' ? undefined : value);
    return hidden.filter(h => text.includes(h));
  };

  /**
   * A served file is a leak (the media itself); any error is fine, as long as it is not the file.
   */
  const servedFile = (res: Response): string[] =>
    res.status === 200 && !(res.headers['content-type'] || '').includes('application/json') ? ['the file'] : [];

  /**
   * Every check returns the hidden content it found in the response (empty: nothing leaked).
   */
  const checks: { name: string, leaks: (user: TestUser) => Promise<string[]> }[] = [
    {
      name: 'folder listing (root)',
      leaks: async (u) => hiddenInResult(await get(u, '/gallery/content/'))
    },
    {
      name: 'folder listing (blocked folder)',
      leaks: async (u) => hiddenInResult(await get(u, '/gallery/content/' + hiddenDir), ['Portrait.jpg', 'video.mp4', 'track.gpx', 'Joe'])
    },
    {
      name: 'search',
      leaks: async (u) => hiddenInResult(await get(u, '/search/' + q(hiddenQuery)))
    },
    ...['Bam', 'Jo', 'secr', 'Portr', 'USA R', 'priv'].map(text => ({
      name: 'autocomplete of "' + text + '"',
      leaks: async (u: TestUser) => hiddenInResult(await get(u, '/autocomplete/' + encodeURIComponent(text)))
    })),
    {
      name: 'faces',
      leaks: async (u) => hiddenInResult(await get(u, '/person'), ['Bambi', 'Joe'])
    },
    ...['Bambi', 'Joe'].map(name => ({
      name: 'face thumbnail of ' + name,
      leaks: async (u: TestUser) => servedFile(await get(u, '/person/' + name + '/thumbnail'))
    })),
    {
      name: 'albums (count and cover)',
      leaks: async (u) => {
        const album = (json(await get(u, '/albums')).result as AlbumBaseDTO[]).find(a => a.name === HIDDEN_ALBUM);
        expect(album, 'the album itself is listed').to.not.be.undefined;
        return [
          ...(album!.cache?.itemCount ? ['item count: ' + album!.cache.itemCount] : []),
          ...(album!.cache?.cover ? ['cover: ' + album!.cache.cover.name] : []),
        ];
      }
    },
    {
      name: 'zip',
      leaks: async (u) => {
        const res = await get(u, '/gallery/zip/' + q(hiddenQuery));
        if (!(res.headers['content-type'] || '').includes('application/zip')) {
          return [];
        }
        return new AdmZip(res.body).getEntries().map(e => e.entryName);
      }
    },
    {
      name: 'random photo',
      leaks: async (u) => servedFile(await get(u, '/gallery/random/' + q(hiddenQuery)))
    },
    ...[
      'secret.jpg', 'secret.jpg/320', 'secret.jpg/icon',
      `${hiddenDir}/Portrait.jpg`, `${hiddenDir}/Portrait.jpg/320`, `${hiddenDir}/Portrait.jpg/icon`,
      `${hiddenDir}/video.mp4`, `${hiddenDir}/video.mp4/bestFit`, `${hiddenDir}/video.mp4/320`, `${hiddenDir}/video.mp4/icon`,
      `${hiddenDir}/track.gpx`, `${hiddenDir}/track.gpx/bestFit`,
    ].map(file => ({
      name: 'file ' + decodeURIComponent(file),
      leaks: async (u: TestUser) => servedFile(await get(u, '/gallery/content/' + file))
    })),
  ];

  for (const check of checks) {
    it(check.name + ': should hide the hidden media from the restricted user', async () => {
      expect(await check.leaks(admin), 'the admin sees the hidden media (the check works)').to.not.be.empty;
      expect(await check.leaks(restricted), 'what the restricted user sees').to.be.empty;
    });
  }
});
