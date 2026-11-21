import {NextFunction, Request, Response} from 'express';
import {ErrorCodes, ErrorDTO} from '../../../common/entities/Error';
import {Config} from '../../../common/config/private/Config';
import {ConfigDiagnostics} from '../../model/diagnostics/ConfigDiagnostics';
import {ConfigClassBuilder} from 'typeconfig/node';
import {TAGS, ThemesConfig} from '../../../common/config/public/ClientConfig';
import {ObjectManagers} from '../../model/ObjectManagers';
import {ExtensionConfigWrapper} from '../../model/extension/ExtensionConfigWrapper';
import {UserRoles} from '../../../common/entities/UserDTO';
import {RequestSession} from '../RequestSession';



// the typeconfig state of a config property, as far as the role check needs it
interface RoleState {
  type?: unknown;
  value?: unknown;
  isConfigType?: boolean;
  isConfigArrayType?: boolean;
}

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
      SettingsMWs.checkGrantedRoles(Config, transformer, settingsPath, RequestSession.getContext(req).user.role);
      const original = await ExtensionConfigWrapper.original();
      // only updating explicitly set config (not saving config set by the diagnostics)
      sections(original)[settingsPath] = settings;
      // the built-in themes can't be deleted or changed
      ThemesConfig.applyBuiltInThemes(original.Gallery.Themes);
      await ConfigDiagnostics.testConfig(original);
      sections(Config)[settingsPath] = settings;
      ThemesConfig.applyBuiltInThemes(Config.Gallery.Themes);
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

  /**
   * Nobody can grant a role above their own (e.g. an Admin can't set anything to Developer).
   * Throws if the new settings have more role values above the role of the user than the current config.
   */
  private static checkGrantedRoles(current: object, updated: object, settingsPath: string, ownRole: UserRoles): void {
    const sections = (config: object) => config as Record<string, unknown>;
    const before = SettingsMWs.countRolesAbove(sections(current)[settingsPath], ownRole, settingsPath);
    const after = SettingsMWs.countRolesAbove(sections(updated)[settingsPath], ownRole, settingsPath);
    for (const [key, count] of after) {
      if (count > (before.get(key) ?? 0)) {
        throw new Error(`You can't set ${key.split('=')[0]} to a role above your own (${UserRoles[ownRole]}).`);
      }
    }
  }

  // Counts the role settings that are above maxRole, by their path and value (array items share their path).
  private static countRolesAbove(config: unknown, maxRole: UserRoles, path: string,
                                 out = new Map<string, number>()): Map<string, number> {
    const state = (config as { __state?: Record<string, RoleState> } | null)?.__state;
    if (!state) {
      return out;
    }
    for (const [key, st] of Object.entries(state)) {
      const p = path + '.' + key;
      if (st.type === UserRoles && typeof st.value === 'number' && st.value > Number(maxRole)) {
        const k = p + '=' + UserRoles[st.value];
        out.set(k, (out.get(k) ?? 0) + 1);
      } else if (st.isConfigType) {
        SettingsMWs.countRolesAbove(st.value, maxRole, p, out);
      } else if (st.isConfigArrayType && Array.isArray(st.value)) {
        for (const item of st.value) {
          SettingsMWs.countRolesAbove(item, maxRole, p + '[]', out);
        }
      }
    }
    return out;
  }


}
