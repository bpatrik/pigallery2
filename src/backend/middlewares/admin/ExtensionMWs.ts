import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {ObjectManagers} from '../../model/ObjectManagers';

export class ExtensionMWs {
  public static async getExtensionList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Use the new wrapper function to get extensions with installed status
      req.resultPipe = await ObjectManagers.getInstance().ExtensionManager.getExtensionListWithInstallStatus();
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

  public static async installExtension(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract the extension ID from the request body
      const extensionId = req.body.id;

      if (!extensionId) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'Extension ID is required'
          )
        );
      }

      // Call the installExtension method on the ExtensionManager
      await ObjectManagers.getInstance().ExtensionManager.installExtension(extensionId);

      // Set the result to an empty object (success)
      req.resultPipe = { success: true };
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Extension installation error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Extension installation error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }

  public static async reloadExtension(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract the config key (folder name) from the request body
      // Note: The request parameter is called 'path' for backwards compatibility,
      // but it represents the config key used in Config.Extensions.extensions
      const configKey = req.body.path;

      if (!configKey) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'Extension config key is required'
          )
        );
      }

      // Call cleanUp and init on the ExtensionManager
      await ObjectManagers.getInstance().ExtensionManager.reloadExtension(configKey);

      // Set the result to an empty object (success)
      req.resultPipe = { success: true };
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Extension reload error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Extension reload error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }

  public static async deleteExtension(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Extract the config key (folder name) from the request body
      // Note: The request parameter is called 'path' for backwards compatibility,
      // but it represents the config key used in Config.Extensions.extensions
      const configKey = req.body.path;

      if (!configKey) {
        return next(
          new ErrorDTO(
            ErrorCodes.INPUT_ERROR,
            'Extension config key is required'
          )
        );
      }

      // Call deleteExtension on the ExtensionManager to cleanup and remove folder
      await ObjectManagers.getInstance().ExtensionManager.deleteExtension(configKey);

      // Set the result to an empty object (success)
      req.resultPipe = { success: true };
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(
          new ErrorDTO(
            ErrorCodes.JOB_ERROR,
            'Extension deletion error: ' + err.toString(),
            err
          )
        );
      }
      return next(
        new ErrorDTO(
          ErrorCodes.JOB_ERROR,
          'Extension deletion error: ' + JSON.stringify(err, null, '  '),
          err
        )
      );
    }
  }
}
