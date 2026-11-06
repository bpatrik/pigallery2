import {IPropertyMetadata} from 'typeconfig/common';
import {TAGS} from '../../../../../common/config/public/ClientConfig';

/**
 * A config object as the web config builder creates it: its properties plus their states.
 */
export interface StatefulConfig {
  __state: Record<string, RecursiveState>;
  __propPath?: string;

  toJSON(): Record<string, unknown>;
}

/**
 * The typeconfig state of a config property, as the settings UI edits it.
 * `value` and `default` depend on the property type:
 * a primitive, a StatefulConfig (isConfigType) or an array (type 'array', of StatefulConfigs if isConfigArrayType).
 */
export interface RecursiveState extends IPropertyMetadata<unknown, unknown, TAGS> {
  // UI helpers set by TemplateComponent.instrument(). States that it did not instrument
  // (e.g. the ones of a new array item) only have the typeconfig fields.
  shouldHide?: () => boolean;
  onChange?: () => void;
  original?: unknown;
  rootConfig?: StatefulConfig; // the config that contains this property
  keys?: string[]; // sorted keys of the sub configs
  arrayEntries?: { value: StatefulConfig, keys: string[] }[]; // per array item of an expandable config array
  isExpandableConfig?: boolean;
  isExpandableArrayConfig?: boolean;
  isExtension?: boolean;
}

/**
 * The property states of a config typed state (isConfigType).
 */
export const subStates = (st: RecursiveState): Record<string, RecursiveState> =>
  (st.value as StatefulConfig).__state;
