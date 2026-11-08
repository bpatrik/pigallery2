import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {Config} from '../../../common/config/private/Config';
import {ConfigDiagnostics} from '../../model/diagnostics/ConfigDiagnostics';
import {ConfigClassBuilder} from 'typeconfig/node';
import {TAGS} from '../../../common/config/public/ClientConfig';
import {ObjectManagers} from '../../model/ObjectManagers';
import {ExtensionConfigWrapper} from '../../model/extension/ExtensionConfigWrapper';



export class SettingsMWs {

  /**
   * General settings updating servcie
   * @param req
   * @param res
   * @param next
   */
  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    const body = req.body as { settings?: unknown, settingsPath?: unknown } | undefined;
    if ((typeof body === 'undefined')
      || (typeof body.settings === 'undefined')
      || (typeof body.settingsPath !== 'string')) {
      return next(new ErrorDTO(ErrorCodes.INPUT_ERROR, 'settings is needed'));
    }

    // the top level settings are set by their name
    const sections = (config: object) => config as Record<string, unknown>;
    try {
      const settingsPath = body.settingsPath; // Name of the top level settings
      const transformer = await ExtensionConfigWrapper.original();
      sections(transformer)[settingsPath] = body.settings; // Top level settings JSON
      const settings = ConfigClassBuilder.attachPrivateInterface<TAGS, unknown>(sections(transformer)[settingsPath]).toJSON({
        skipTags: {secret: true}
      });
      const original = await ExtensionConfigWrapper.original();
      // only updating explicitly set config (not saving config set by the diagnostics)
      sections(original)[settingsPath] = settings;
      await ConfigDiagnostics.testConfig(original);
      sections(Config)[settingsPath] = settings;
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
