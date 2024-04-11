import {ExtensionConfigWrapper} from '../../../backend/model/extension/ExtensionConfigWrapper';
import {PrivateConfigClass} from './PrivateConfigClass';
import {ConfigClassBuilder} from 'typeconfig/node';
import {ExtensionConfigTemplateLoader} from '../../../backend/model/extension/ExtensionConfigTemplateLoader';
import * as path from 'path';

const pre = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
try {
  //NOTE: can possibly remove this saveIfNotExist hack if typeconfig issue #27 is fixed
  const origSaveIfNotExist = (pre.__options as any).saveIfNotExist;
  (pre.__options as any).saveIfNotExist = false;
  pre.loadSync();
  (pre.__options as any).saveIfNotExist = origSaveIfNotExist;
} catch (e) { /* empty */ }
ExtensionConfigTemplateLoader.Instance.init(pre.Extensions.folder);

export const Config = ExtensionConfigWrapper.originalSync(true);
