import {Signal} from '@angular/core';

export interface ISettingsComponent {
  HasAvailableSettings: boolean;
  Name: Signal<string>;
  icon: Signal<string>;
  ConfigPath: Signal<string | undefined>;
  Changed: boolean;
  nestedConfigs: Signal<{ id: string, name: string, visible: () => boolean, icon: string }[]>;
}
