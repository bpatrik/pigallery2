import {Config} from '../src/common/config/private/Config';
import {ObjectManagers} from '../src/backend/model/ObjectManagers';
import {DiskManager} from '../src/backend/model/fileaccess/DiskManager';
import {IndexingManager} from '../src/backend/model/database/IndexingManager';
import * as path from 'path';
import * as fs from 'fs';
import {Utils} from '../src/common/Utils';
import {DatabaseType, ReIndexingSensitivity} from '../src/common/config/private/PrivateConfig';
import {ProjectPath} from '../src/backend/ProjectPath';
import {Benchmark} from './Benchmark';
import {IndexingJob} from '../src/backend/model/jobs/jobs/IndexingJob';
import {IJob} from '../src/backend/model/jobs/jobs/IJob';
import {JobProgressStates} from '../src/common/entities/job/JobProgressDTO';
import {JobProgress} from '../src/backend/model/jobs/jobs/JobProgress';
import {ContentWrapper} from '../src/common/entities/ConentWrapper';
import {GalleryManager} from '../src/backend/model/database/GalleryManager';
import {PersonManager} from '../src/backend/model/database/PersonManager';
import {GalleryRouter} from '../src/backend/routes/GalleryRouter';
import {Express} from 'express';
import {PersonRouter} from '../src/backend/routes/PersonRouter';
import {
  ANDSearchQuery,
  ORSearchQuery,
  SearchQueryDTO,
  SearchQueryTypes,
  SomeOfSearchQuery,
  TextSearch,
  TextSearchQueryMatchTypes,
  TextSearchQueryTypes
} from '../src/common/entities/SearchQueryDTO';
import {defaultQueryKeywords, QueryKeywords, SearchQueryParser} from '../src/common/SearchQueryParser';
import {ParentDirectoryDTO} from '../src/common/entities/DirectoryDTO';


export interface BenchmarkResult {
  name: string;
  experiment?: string;
  duration: number;
  contentWrapper?: ContentWrapper;
  items?: any[];
  subBenchmarks?: BenchmarkResult[];
}

export class BMIndexingManager extends IndexingManager {

  public async saveToDB(scannedDirectory: ParentDirectoryDTO): Promise<void> {
    return super.saveToDB(scannedDirectory);
  }
}


class BMGalleryRouter extends GalleryRouter {
  public static addDirectoryList(app: Express): void {
    GalleryRouter.addDirectoryList(app);
  }

  public static addSearch(app: Express): void {
    GalleryRouter.addSearch(app);
  }

  public static addAutoComplete(app: Express): void {
    GalleryRouter.addAutoComplete(app);
  }
}

class BMPersonRouter extends PersonRouter {
  public static addGetPersons(app: Express): void {
    PersonRouter.addGetPersons(app);
  }
}

export class BenchmarkRunner {
  inited = false;
  private biggestDirPath: string = null;
  private readonly requestTemplate: any = {
    requestPipe: null,
    params: {},
    query: {},
    session: {}
  };

  constructor(public RUNS: number) {
    Config.Users.authenticationRequired = false;
  }

  async bmSaveDirectory(): Promise<BenchmarkResult[]> {
    const dir = await DiskManager.scanDirectory(this.biggestDirPath);
    const bm = new Benchmark('Saving directory to DB', null,
      (): Promise<void> => this.resetDB(), null,
      async (): Promise<void> => {
        await this.init();
        await this.setupDB();
      });
    bm.addAStep({
      name: 'Saving directory to DB',
      fn: (): Promise<void> => {
        const im = new BMIndexingManager();
        return im.saveToDB(dir as ParentDirectoryDTO);
      }
    });
    return await bm.run(this.RUNS);
  }

  async bmScanDirectory(): Promise<BenchmarkResult[]> {
    await this.init();
    const bm = new Benchmark('Scanning directory', {}, null,
      null,
      async (): Promise<void> => {
        await this.init();
      });
    bm.addAStep({
      name: 'Scanning directory',
      fn: async (): Promise<ContentWrapper> => new ContentWrapper(await DiskManager.scanDirectory(this.biggestDirPath))
    });
    return await bm.run(this.RUNS);
  }

  async bmListDirectory(): Promise<BenchmarkResult[]> {
    const req = Utils.clone(this.requestTemplate);
    req.params.directory = this.biggestDirPath;
    const bm = new Benchmark('List directory', req,
      async (): Promise<void> => {
        await ObjectManagers.reset();
        await ObjectManagers.getInstance().init();
      }, null,
      async (): Promise<void> => {
        Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
        await this.init();
        await this.setupDB();
      });
    BMGalleryRouter.addDirectoryList(bm.BmExpressApp);
    return await bm.run(this.RUNS);
  }

  async bmListPersons(): Promise<BenchmarkResult[]> {
    const bm = new Benchmark('Listing Faces', Utils.clone(this.requestTemplate), async (): Promise<void> => {
        await ObjectManagers.reset();
        await ObjectManagers.getInstance().init();
      }, null,
      async (): Promise<void> => {
        Config.Indexing.reIndexingSensitivity = ReIndexingSensitivity.low;
        await this.setupDB();
      });
    BMPersonRouter.addGetPersons(bm.BmExpressApp);
    return await bm.run(this.RUNS);
  }

  async bmAllSearch(): Promise<{ result: BenchmarkResult[], searchQuery: SearchQueryDTO }[]> {
    await this.setupDB();

    const queryParser = new SearchQueryParser(defaultQueryKeywords);
    const names = (await ObjectManagers.getInstance().PersonManager.getAll()).sort((a, b) => b.count - a.count);
    const queries: { query: SearchQueryDTO, description: string }[] = TextSearchQueryTypes.map(t => {
      const q = {
        type: t, text: 'a'
      };
      return {
        query: q, description: queryParser.stringify(q)
      };
    });
    // searching for everything
    queries.push({
      query: {
        type: SearchQueryTypes.any_text, text: '.'
      } as TextSearch, description: queryParser.stringify({
        type: SearchQueryTypes.any_text, text: '.'
      } as TextSearch)
    });
    if (names.length > 0) {
      queries.push({
        query: {
          type: SearchQueryTypes.person, text: names[0].name,
          matchType: TextSearchQueryMatchTypes.exact_match
        } as TextSearch, description: '<Most common name>'
      });
    }
    if (names.length > 1) {
      queries.push({
        query: {
          type: SearchQueryTypes.AND, list: [
            {
              type: SearchQueryTypes.person, text: names[0].name,
              matchType: TextSearchQueryMatchTypes.exact_match
            } as TextSearch,
            {
              type: SearchQueryTypes.person, text: names[1].name,
              matchType: TextSearchQueryMatchTypes.exact_match
            } as TextSearch
          ]
        } as ANDSearchQuery, description: '<Most AND second common names>'
      });
      queries.push({
        query: {
          type: SearchQueryTypes.OR, list: [
            {
              type: SearchQueryTypes.person, text: names[0].name,
              matchType: TextSearchQueryMatchTypes.exact_match
            } as TextSearch,
            {
              type: SearchQueryTypes.person, text: names[1].name,
              matchType: TextSearchQueryMatchTypes.exact_match
            } as TextSearch
          ]
        } as ORSearchQuery, description: '<Most OR second common names>'
      });
      queries.push({
        query: {
          type: SearchQueryTypes.SOME_OF,
          min: 2,
          list: names.map(n => ({
            type: SearchQueryTypes.person, text: n.name,
            matchType: TextSearchQueryMatchTypes.exact_match
          } as TextSearch))
        } as SomeOfSearchQuery, description: '<Contain at least 2 out of all names>'
      });
    }
    const results: { result: BenchmarkResult[], searchQuery: SearchQueryDTO }[] = [];

    for (const entry of queries) {
      const req = Utils.clone(this.requestTemplate);
      req.params.searchQueryDTO = JSON.stringify(entry.query);

      const bm = new Benchmark('Searching for `' + entry.description + '`', req, null, null,
        async (): Promise<void> => {
          await this.setupDB();
        });
      BMGalleryRouter.addSearch(bm.BmExpressApp);

      results.push({result: await bm.run(this.RUNS), searchQuery: entry.query});
    }
    return results;
  }


  async bmAutocomplete(text: string): Promise<BenchmarkResult[]> {
    const req = Utils.clone(this.requestTemplate);
    req.params.text = text;
    const bm = new Benchmark('Auto complete for `' + text + '`', req, null, null,
      async (): Promise<void> => {
        await this.setupDB();
      });
    BMGalleryRouter.addAutoComplete(bm.BmExpressApp);
    return await bm.run(this.RUNS);
  }

  async getStatistic(): Promise<string> {
    await this.setupDB();
    const gm = new GalleryManager();
    const pm = new PersonManager();


    return 'directories: ' + await gm.countDirectories() +
      ', photos: ' + await gm.countPhotos() +
      ', videos: ' + await gm.countVideos() +
      ', diskUsage : ' + Utils.renderDataSize(await gm.countMediaSize()) +
      ', persons : ' + await pm.countFaces() +
      ', unique persons (faces): ' + (await pm.getAll()).length;

  }

  private async init(): Promise<string> {
    if (this.inited === false) {
      await this.setupDB();

      const gm = new GalleryManager();
      let biggest = 0;
      let biggestPath = '/';
      const queue = ['/'];
      while (queue.length > 0) {
        const dirPath = queue.shift();
        const dir = await gm.listDirectory(dirPath);
        dir.directories.forEach((d): number => queue.push(path.join(d.path + d.name)));
        if (biggest < dir.media.length) {
          biggestPath = path.join(dir.path + dir.name);
          biggest = dir.media.length;
        }
      }
      this.biggestDirPath = biggestPath;
      console.log('updating path of biggest dir to: ' + this.biggestDirPath);
      this.inited = true;
    }
    return this.biggestDirPath;

  }


  private resetDB = async (): Promise<void> => {
    await ObjectManagers.reset();
    await fs.promises.rm(ProjectPath.DBFolder, {recursive: true, force: true});
    Config.Database.type = DatabaseType.sqlite;
    Config.Jobs.scheduled = [];
    await ObjectManagers.getInstance().init();
  };

  private async setupDB(): Promise<void> {
    await this.resetDB();
    await new Promise<void>((resolve, reject): void => {
      try {
        const indexingJob = new IndexingJob();

        indexingJob.JobListener = {
          onJobFinished: (job: IJob<any>, state: JobProgressStates, soloRun: boolean): void => {
            resolve();
          },

          onProgressUpdate: (progress: JobProgress): void => {
            // empty
          }
        };
        indexingJob.start({indexChangesOnly: false}).catch(console.error);
      } catch (e) {
        console.error(e);
        reject(e);
      }
    });
  }
}
