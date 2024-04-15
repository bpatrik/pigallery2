import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {Config} from '../../../common/config/private/Config';
import {ConfigDiagnostics} from '../../model/diagnostics/ConfigDiagnostics';
import {ConfigClassBuilder} from 'typeconfig/node';
import {TAGS} from '../../../common/config/public/ClientConfig';
import {ObjectManagers} from '../../model/ObjectManagers';
import {ExtensionConfigWrapper} from '../../model/extension/ExtensionConfigWrapper';
import {Logger} from '../../Logger';

const LOG_TAG = '[SettingsMWs]';


export class SettingsMWs {

  /**
   * General settings updating servcie
   * @param req
   * @param res
   * @param next
   */
  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    if ((typeof req.body === 'undefined')
      || (typeof req.body.settings === 'undefined')
      || (typeof req.body.settingsPath !== 'string')) {
      return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'settings is needed'));
    }

    try {
      let settings = req.body.settings; // Top level settings JSON
      const settingsPath: string = req.body.settingsPath; // Name of the top level settings
      const transformer = await ExtensionConfigWrapper.original();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      transformer[settingsPath] = settings;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      settings = ConfigClassBuilder.attachPrivateInterface(transformer[settingsPath]).toJSON({
        skipTags: {secret: true} as TAGS
      });
      const original = await ExtensionConfigWrapper.original();
      // only updating explicitly set config (not saving config set by the diagnostics)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      original[settingsPath] = settings;
      await ConfigDiagnostics.testConfig(original);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      Config[settingsPath] = settings;
      await original.save();
      await ConfigDiagnostics.runDiagnostics();
      // restart all schedule timers. In case they have changed
      ObjectManagers.getInstance().JobManager.runSchedules();
    //  Logger.info(LOG_TAG, 'new config:');
    //  Logger.info(LOG_TAG, JSON.stringify(Config.toJSON({attachDescription: false}), null, '\t'));
      return next();
    } catch (err) {
      if (err instanceof Error) {
        return next(new ErrorDTO(ErrorCodes.SETTINGS_ERROR, 'Settings error: ' + err.toString(), err));
      }
      return next(new ErrorDTO(ErrorCodes.SETTINGS_ERROR, 'Settings error: ' + JSON.stringify(err, null, '  '), err));
    }
  }


}
