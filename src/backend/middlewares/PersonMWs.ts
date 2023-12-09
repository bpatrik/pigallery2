import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {ObjectManagers} from '../model/ObjectManagers';
import {PersonDTO,} from '../../common/entities/PersonDTO';
import {Utils} from '../../common/Utils';
import {PersonEntry} from '../model/database/enitites/PersonEntry';

export class PersonMWs {
  public static async updatePerson(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (!req.params['name']) {
      return next();
    }

    try {
      req.resultPipe =
          await ObjectManagers.getInstance().PersonManager.updatePerson(
              req.params['name'] as string,
              req.body as PersonDTO
          );
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
    if (!req.params['name']) {
      return next();
    }

    try {
      req.resultPipe = await ObjectManagers.getInstance().PersonManager.get(
          req.params['name'] as string
      );
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
          await ObjectManagers.getInstance().PersonManager.getAll();

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

  public static async cleanUpPersonResults(
      req: Request,
      res: Response,
      next: NextFunction
  ): Promise<void> {
    if (!req.resultPipe) {
      return next();
    }
    try {
      const persons = Utils.clone(req.resultPipe as PersonEntry[]);
      for (const item of persons) {
        delete item.sampleRegion;
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


