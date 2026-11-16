import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ObjectManagers} from '../../model/ObjectManagers';
import {MessengerRepository} from '../../model/messenger/MessengerRepository';
import {JobStartDTO} from '../../../common/entities/job/JobDTO';
import {RequestParams} from '../RequestParams';
import {BuildInfo} from '../../model/BuildInfo';
import {ReleaseNotesDTO} from '../../../common/entities/ReleaseNotesDTO';
import {Config} from '../../../common/config/private/Config';

export class AdminMWs {
  public static async loadStatistic(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {

    const galleryManager = ObjectManagers.getInstance()
      .GalleryManager;
    const personManager = ObjectManagers.getInstance()
      .PersonManager;
    try {
      req.resultPipe = {
        directories: await galleryManager.countDirectories(),
        photos: await galleryManager.countPhotos(),
        videos: await galleryManager.countVideos(),
        diskUsage: await galleryManager.countMediaSize(),
        persons: await personManager.countFaces(),
      };
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.GENERAL_ERROR,
            'Error while getting statistic: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error while getting statistic',
          err
        )
      );
    }
  }

  public static async getDuplicates(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {

    try {
      req.resultPipe = await ObjectManagers.getInstance()
        .GalleryManager.getPossibleDuplicates();
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.GENERAL_ERROR,
            'Error while getting duplicates: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.GENERAL_ERROR,
          'Error while getting duplicates',
          err
        )
      );
    }
  }

  public static async startJob(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = RequestParams.getRequired(req, 'id');
      // Express 5 leaves req.body undefined without a JSON body; the job then runs with its defaults
      const jobStart = (req.body ?? {}) as JobStartDTO;
      const JobConfig: Record<string, unknown> = jobStart.config ?? {};
      const soloRun: boolean = jobStart.soloRun;
      const allowParallelRun: boolean = jobStart.allowParallelRun;
      await ObjectManagers.getInstance().JobManager.run(
        id,
        JobConfig,
        soloRun,
        allowParallelRun
      );
      req.resultPipe = 'ok';
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Job error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Job error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }

  public static stopJob(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = RequestParams.getRequired(req, 'id');
      ObjectManagers.getInstance().JobManager.stop(id);
      req.resultPipe = 'ok';
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Job error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Job error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }


  public static getAvailableMessengers(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      req.resultPipe = MessengerRepository.Instance.getAll().map(msgr => msgr.Name);
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Messenger error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Messenger error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }

  public static getAvailableJobs(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      req.resultPipe =
        ObjectManagers.getInstance().JobManager.getAvailableJobs();
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Job error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Job error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }

  public static getJobProgresses(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    try {
      req.resultPipe = ObjectManagers.getInstance().JobManager.getProgresses();
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Job error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Job error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }

  public static async loadReleaseNotes(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.session.context?.user?.id;
      // a user without id (no authentication) never confirmed anything
      const user = typeof id === 'number' ? await ObjectManagers.getInstance().UserManager.findOne({id}) : null;
      const releaseNotes: ReleaseNotesDTO = {
        build: BuildInfo.get(),
        notes: await BuildInfo.loadReleaseNotes(),
        seenVersion: user?.releaseNotesSeenVersion ?? null
      };
      req.resultPipe = releaseNotes;
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error while loading the release notes', err));
    }
  }

  /**
   * Saves the running version (not one the client sends) as the one whose release notes the admin confirmed.
   */
  public static async setReleaseNotesSeen(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.session.context?.user?.id;
      if (typeof id === 'number') {
        await ObjectManagers.getInstance().UserManager.setReleaseNotesSeenVersion(id, Config.Environment.appVersion ?? null);
      }
      return next();
    } catch (err) {
      return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error while saving the release notes as seen', err));
    }
  }
}
