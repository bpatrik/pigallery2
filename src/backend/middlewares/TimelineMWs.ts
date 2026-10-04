import {NextFunction, Request, Response} from 'express';
import {Config} from '../../common/config/private/Config';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {TimelinePageDTO} from '../../common/entities/TimelineDTO';
import {TimelineSummaryDTO} from '../../common/entities/TimelineDTO';
import {UserRoles} from '../../common/entities/UserDTO';
import {ThumbnailGeneratorMWs} from './thumbnail/ThumbnailGeneratorMWs';
import {ObjectManagers} from '../model/ObjectManagers';
import {TimelinePageOptions} from '../model/timeline/TimelineManager';

const MAX_DATE_MS = 8.64e15;

function parseInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseDate(value: unknown): number | null {
  const parsed = parseInteger(value);
  return parsed !== null && Math.abs(parsed) <= MAX_DATE_MS ? parsed : null;
}

function parsePageOptions(req: Request): TimelinePageOptions | null {
  const limitParam = req.query.limit;
  const limit = limitParam === undefined ? 100 : parseInteger(limitParam);
  if (limit === null || limit < 1 || limit > 200) {
    return null;
  }

  const fromParam = req.query.from;
  const afterParam = req.query.after;
  const beforeParam = req.query.before;
  const hasFrom = fromParam !== undefined;
  const hasAfter = afterParam !== undefined;
  const hasBefore = beforeParam !== undefined;
  if (hasFrom !== hasAfter || (hasBefore && (hasFrom || hasAfter))) {
    return null;
  }

  const options: TimelinePageOptions = {limit};
  if (hasBefore) {
    const before = parseDate(beforeParam);
    if (before === null) {
      return null;
    }
    options.before = before;
  } else if (hasFrom && hasAfter) {
    const from = parseDate(fromParam);
    const after = parseInteger(afterParam);
    if (from === null || after === null || after < 0) {
      return null;
    }
    options.cursor = {from, after};
  }
  return options;
}

export class TimelineMWs {
  public static checkAvailable(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const user = req.session?.context?.user;
    if (
      Config.Timeline.enabled !== true ||
      !user ||
      user.role < Config.Timeline.readAccessMinRole ||
      !!user.usedSharingKey
    ) {
      res.status(403);
      return next(
        new ErrorDTO(ErrorCodes.PERMISSION_DENIED, 'Timeline is not available')
      );
    }
    return next();
  }

  public static async listMedia(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const options = parsePageOptions(req);
    if (!options) {
      res.status(400);
      return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'Invalid Timeline page parameters'));
    }
    try {
      const page = await ObjectManagers.getInstance().TimelineManager.getMediaPage(
        req.session.context!,
        options
      );
      ThumbnailGeneratorMWs.addThumbnailInfoToMedia(page.media);
      req.resultPipe = page as TimelinePageDTO;
      return next();
    } catch (error) {
      return next(
        new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error listing Timeline media', error)
      );
    }
  }

  public static async getSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      req.resultPipe = await ObjectManagers.getInstance().TimelineManager.getSummary(
        req.session.context!
      ) as TimelineSummaryDTO;
      return next();
    } catch (error) {
      return next(
        new ErrorDTO(ErrorCodes.GENERAL_ERROR, 'Error building Timeline summary', error)
      );
    }
  }
}