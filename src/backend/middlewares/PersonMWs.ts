import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {ObjectManagers} from '../model/ObjectManagers';
import {PersonDTO,} from '../../common/entities/PersonDTO';
import {Utils} from '../../common/Utils';
import {PersonEntry} from '../model/database/enitites/person/PersonEntry';
import {ProjectedPersonCacheEntity} from '../model/database/enitites/person/ProjectedPersonCacheEntity';
import {RequestParams} from './RequestParams';
import {RequestSession} from './RequestSession';

export class PersonMWs {
  public static async updatePerson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const name = RequestParams.get(req, 'name');
    if (!name) {
      return next();
    }

    try {
      await ObjectManagers.getInstance().PersonManager.updatePerson(
        name,
        (req.body ?? {}) as PersonDTO
      );
      req.resultPipe = await ObjectManagers.getInstance().PersonManager.get(RequestSession.getContext(req), name);
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.PERSON_ERROR,
          'Error during updating a person',
          err
        )
      );
    }
  }

  public static async getPerson(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const name = RequestParams.get(req, 'name');
    if (!name) {
      return next();
    }

    try {
      req.resultPipe = await ObjectManagers.getInstance().PersonManager.get(RequestSession.getContext(req), name);
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.PERSON_ERROR,
          'Error during updating a person',
          err
        )
      );
    }
  }

  public static async listPersons(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      req.resultPipe =
        await ObjectManagers.getInstance().PersonManager.getAll(RequestSession.getContext(req));

      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.PERSON_ERROR,
          'Error during listing persons',
          err
        )
      );
    }
  }

  public static cleanUpPersonResults(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.resultPipe) {
      return next();
    }
    try {
      const persons = Utils.clone(req.resultPipe as PersonEntry[]);
      for (const item of persons) {
        delete (item.cache as Partial<ProjectedPersonCacheEntity>).sampleRegion;
      }
      req.resultPipe = persons;
      return next();
    } catch (err) {
      return next(
        new ErrorDTO(
          ErrorCodes.PERSON_ERROR,
          'Error during removing sample photo from all persons',
          err
        )
      );
    }
  }
}


