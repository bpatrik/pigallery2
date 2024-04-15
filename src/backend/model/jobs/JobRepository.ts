import {IJob} from './jobs/IJob';
import {IndexingJob} from './jobs/IndexingJob';
import {GalleryRestJob} from './jobs/GalleryResetJob';
import {VideoConvertingJob} from './jobs/VideoConvertingJob';
import {PhotoConvertingJob} from './jobs/PhotoConvertingJob';
import {TempFolderCleaningJob} from './jobs/TempFolderCleaningJob';
import {AlbumCoverFillingJob} from './jobs/AlbumCoverFillingJob';
import {GPXCompressionJob} from './jobs/GPXCompressionJob';
import {AlbumRestJob} from './jobs/AlbumResetJob';
import {GPXCompressionResetJob} from './jobs/GPXCompressionResetJob';
import {TopPickSendJob} from './jobs/TopPickSendJob';
import {AlbumCoverRestJob} from './jobs/AlbumCoverResetJob';

export class JobRepository {
  private static instance: JobRepository = null;
  availableJobs: { [key: string]: IJob } = {};

  public static get Instance(): JobRepository {
    if (JobRepository.instance == null) {
      JobRepository.instance = new JobRepository();
    }
    return JobRepository.instance;
  }

  getAvailableJobs(): IJob[] {
    return Object.values(this.availableJobs).filter((t) => t.Supported);
  }

  register(job: IJob): void {
    if (typeof this.availableJobs[job.Name] !== 'undefined') {
      throw new Error('Job already exist:' + job.Name);
    }
    this.availableJobs[job.Name] = job;
  }

  exists(name: string) {
    return !!this.availableJobs[name];
  }
}

JobRepository.Instance.register(new IndexingJob());
JobRepository.Instance.register(new GalleryRestJob());
JobRepository.Instance.register(new AlbumCoverFillingJob());
JobRepository.Instance.register(new AlbumCoverRestJob());
JobRepository.Instance.register(new VideoConvertingJob());
JobRepository.Instance.register(new PhotoConvertingJob());
JobRepository.Instance.register(new GPXCompressionJob());
JobRepository.Instance.register(new TempFolderCleaningJob());
JobRepository.Instance.register(new AlbumRestJob());
JobRepository.Instance.register(new GPXCompressionResetJob());
JobRepository.Instance.register(new TopPickSendJob());
