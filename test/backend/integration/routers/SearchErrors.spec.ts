import {Config} from '../../../../src/common/config/private/Config';
import {Server} from '../../../../src/backend/server';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as chai from 'chai';
import {expect} from 'chai';
import {default as chaiHttp, request} from 'chai-http';
import {SuperAgentStatic} from 'superagent';
import {DBTestHelper} from '../../DBTestHelper';
import {TestHelper} from '../../../TestHelper';
import {ProjectPath} from '../../../../src/backend/ProjectPath';
import {ObjectManagers} from '../../../../src/backend/model/ObjectManagers';
import {ErrorCodes} from '../../../../src/common/entities/Error';
import {
  ANDSearchQuery,
  DistanceSearch,
  SearchQueryDTO,
  SearchQueryTypes,
  TextSearch
} from '../../../../src/common/entities/SearchQueryDTO';
import {SearchQueryUtils} from '../../../../src/common/SearchQueryUtils';
import {ContentWrapperUtils, PackedContentWrapper} from '../../../../src/common/entities/ContentWrapper';

process.env['NODE_ENV'] = 'test';
chai.should();
chai.use(chaiHttp);

// to help WebStorm to handle the test cases
declare let describe: any;
declare const it: any;

/**
 * Searches that can't be answered: a location that can't be looked up (#1309) and a random photo link that matches nothing (#1313).
 * The geocoder is stubbed, the tests never go to the network.
 */
const tmpDescribe = describe;
describe = DBTestHelper.describe();

describe('Search errors', (sqlHelper: DBTestHelper) => {
  before(TestHelper.resetConfig);
  describe = tmpDescribe;

  const PHOTO = 'abbey.jpg';
  let server: Server;
  let geocode: (text: string) => Promise<unknown[]>;

  before(async () => {
    await sqlHelper.initDB();
    const folder = path.join(TestHelper.TMP_DIR, 'search-errors-gallery');
    fs.mkdirSync(folder, {recursive: true});
    // has GPS coordinates
    fs.copyFileSync(path.join(__dirname, '../../assets/exiftool.jpg'), path.join(folder, PHOTO));
    Config.Users.authenticationRequired = false;
    Config.Media.folder = folder;
    Config.Media.tempFolder = path.join(TestHelper.TMP_DIR, 'search-errors-temp');
    ProjectPath.reset();
    server = new Server(false);
    await server.onStarted.wait();
    await ObjectManagers.getInstance().IndexingManager.indexDirectory('.', true);

    const geocoder = ObjectManagers.getInstance().LocationManager.geocoder as unknown as { geocode: (text: string) => Promise<unknown[]> };
    geocoder.geocode = (text: string) => geocode(text);
  });

  after(async () => {
    await sqlHelper.clearDB();
  });

  const get = (url: string): Promise<any> =>
    (request.execute(server.Server) as SuperAgentStatic).get(Config.Server.apiPath + url);
  const q = (query: SearchQueryDTO): string => encodeURIComponent(JSON.stringify(query));

  const distance = (place: string): DistanceSearch => ({
    type: SearchQueryTypes.distance,
    distance: 10,
    from: {value: place}
  } as DistanceSearch);

  const shouldStillSearch = async (): Promise<void> => {
    const res = await get('/search/' + q({type: SearchQueryTypes.file_name, value: 'abbey'} as TextSearch));
    res.should.have.status(200);
    expect(res.body.error).to.equal(null);
    const cw = ContentWrapperUtils.unpack(res.body.result as PackedContentWrapper);
    expect(cw.searchResult!.media.map(m => m.name)).to.deep.equal([PHOTO]);
  };

  describe('location that can not be looked up (#1309)', () => {

    it('should answer LocationLookUp_ERROR naming the place when it is not found', async () => {
      geocode = async () => [];
      const place = 'Árvíztűrő tükörfúrógép ' + Date.now(); // accents must reach the message; the location lookups are cached by text
      const res = await get('/search/' + q(distance(place)));

      expect(res.headers['content-type']).to.contain('application/json');
      expect(res.body.error.code).to.equal(ErrorCodes.LocationLookUp_ERROR);
      expect(res.body.error.message).to.contain(place);
      expect(res.body.result).to.equal(null);
      await shouldStillSearch();
    });

    it('should answer LocationLookUp_ERROR for a place inside an AND query', async () => {
      geocode = async () => [];
      const res = await get('/search/' + q({
        type: SearchQueryTypes.AND,
        list: [{type: SearchQueryTypes.file_name, value: 'abbey'} as TextSearch, distance('No such place ' + Date.now())]
      } as ANDSearchQuery));

      expect(res.body.error.code).to.equal(ErrorCodes.LocationLookUp_ERROR);
      await shouldStillSearch();
    });

    it('should search by the place once it is found', async () => {
      // the GPS position of exiftool.jpg
      geocode = async () => [{latitude: 37.8, longitude: -122.4}];
      const res = await get('/search/' + q({...distance('San Francisco ' + Date.now()), distance: 100} as DistanceSearch));
      res.should.have.status(200);
      expect(res.body.error).to.equal(null);
    });

    // e.g. no network, or the geocoding service is down: the same "Cannot find location" message as a not found place
    it('should answer LocationLookUp_ERROR when the geocoding service fails', async () => {
      geocode = async () => {
        throw new Error('getaddrinfo ENOTFOUND nominatim.openstreetmap.org');
      };
      const res = await get('/search/' + q(distance('Balaton ' + Date.now())));

      expect(res.headers['content-type']).to.contain('application/json');
      expect(res.body.error.code).to.equal(ErrorCodes.LocationLookUp_ERROR);
      expect(res.body.error.message).to.contain('Balaton');
      await shouldStillSearch();
    });
  });

  describe('random photo link that matches nothing (#1313)', () => {
    const noMatch = (): string => '/gallery/random/' + q({type: SearchQueryTypes.file_name, value: 'no such photo'} as TextSearch);

    // the link opens in a browser, a frame or an <img>: a plain text for a person, the status for the rest
    it('should answer HTTP 404 with a plain text, not an image and not a crash', async () => {
      const res = await get(noMatch());

      res.should.have.status(404);
      expect(res.headers['content-type']).to.contain('text/plain');
      expect(res.text).to.equal('No photos match this random link.');
      // the server keeps working, also for a random link that matches
      const ok = await get('/gallery/random/' + q({type: SearchQueryTypes.file_name, value: 'abbey'} as TextSearch));
      ok.should.have.status(200);
      expect(ok.headers['content-type']).to.equal('image/jpeg');
    });
  });

  describe('random photo link of the gallery', () => {
    // the "Random link" dialog builds the link from the shortened query of the search page urls
    it('should answer a photo of the shortened query', async () => {
      const res = await get('/gallery/random/' + encodeURIComponent(SearchQueryUtils.urlify({type: SearchQueryTypes.file_name, value: 'abbey'} as TextSearch)));

      res.should.have.status(200);
      expect(res.headers['content-type']).to.equal('image/jpeg');
    });
  });
});
