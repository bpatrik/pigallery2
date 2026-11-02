import {Signal} from '@angular/core';

export interface ISettingsComponent {
  HasAvailableSettings: boolean;
  Name: string;
  icon: Signal<string>;
  ConfigPath: Signal<string>;
  Changed: boolean;
  nestedConfigs: Signal<{ id: string, name: string, visible: () => boolean, icon: string }[]>;
}
