import {backendText} from '../BackendTexts';


export type fieldType = 'string' | 'string-array' | 'number' | 'boolean' | 'number-array' | 'MediaPickDTO-array' | 'messenger';


/**
 * Dynamic configs are not part of the typeconfig maintained config.
 * Pigallery uses them to dynamically define configuration
 * on the serverside so the client can parse and render it.
 * It is mostly used for configuring jobs
 */
export interface DynamicConfig {
  id: string;
  // Use a predefined and localized backend text id or explicitly define the text
  name: backendText | string;
  description: backendText | string;
  type: fieldType;
  defaultValue: unknown;
  validIf?: { configFiled: string, equalsValue: string }; // only shows this config if this predicate is true
}
