import {Signal} from '@angular/core';

export interface ISettingsComponent {
  HasAvailableSettings: boolean;
  Name: string;
  icon: string;
  ConfigPath: Signal<string>;
  Changed: boolean;
  nestedConfigs: { id: string, name: string, visible: () => boolean, icon: string }[];
}
