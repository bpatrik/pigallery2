import {ExtensionConfigWrapper} from '../../../backend/model/extension/ExtensionConfigWrapper';
import {PrivateConfigClass} from './PrivateConfigClass';
import {ConfigClassBuilder} from 'typeconfig/node';
import {ProjectPath} from '../../../backend/ProjectPath';
import {SupportedFormats} from '../../SupportedFormats';

// we need to know the location of the extensions to load the full config (including the extensions)
const pre = ConfigClassBuilder.attachPrivateInterface(new PrivateConfigClass());
try {
  pre.loadSync({preventSaving: true});
} catch (e) { /* empty */
  console.error(e);
}
// load extension paths before full config load
ProjectPath.init(pre);

export const Config = ExtensionConfigWrapper.originalSync(true);
// set actual config
ProjectPath.init(Config);
SupportedFormats.init(Config);
