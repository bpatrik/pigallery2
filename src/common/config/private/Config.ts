import {ExtensionConfigWrapper} from '../../../backend/model/extension/ExtensionConfigWrapper';
import {PrivateConfigClass} from './PrivateConfigClass';
import {ConfigClassBuilder} from 'typeconfig/node';
import {ExtensionConfigTemplateLoader} from '../../../backend/model/extension/ExtensionConfigTemplateLoader';
import * as path from 'path';

const pre = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
try {
  pre.loadSync();
} catch (e) { /* empty */ }
ExtensionConfigTemplateLoader.Instance.init(path.join(__dirname, '/../../../../', pre.Extensions.folder));

export const Config = ExtensionConfigWrapper.originalSync(true);
