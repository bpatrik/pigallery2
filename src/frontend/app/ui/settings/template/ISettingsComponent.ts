import {Signal} from '@angular/core';

export interface ISettingsComponent {
  HasAvailableSettings: boolean;
  Name: Signal<string | undefined>;
  icon: Signal<string | undefined>;
  ConfigPath: Signal<string | undefined>;
  Changed: boolean;
  nestedConfigs: Signal<{ id: string, name: string | undefined, visible: () => boolean, icon: string }[]>;
}
