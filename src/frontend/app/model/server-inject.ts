import type {UserDTO} from '../../../common/entities/UserDTO';
import type {ClientConfig} from '../../../common/config/public/ClientConfig';
import type {UIExtensionDTO} from '../../../common/entities/extension/IClientUIConfig';

/**
 * Injected config / user from the server side into the global scope (see index.html).
 * Not defined when the app runs without the server (e.g.: unit tests).
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace ServerInject {
  const user: UserDTO | undefined;
  const ConfigInject: ClientConfig | undefined;
  const UIExtensionConfigs: UIExtensionDTO[] | undefined;
}

const isInjected = (): boolean => typeof ServerInject !== 'undefined';

export const getInjectedUser = (): UserDTO | undefined =>
  isInjected() ? ServerInject.user : undefined;

export const getInjectedConfig = (): ClientConfig | undefined =>
  isInjected() ? ServerInject.ConfigInject : undefined;

export const getInjectedUIExtensionConfigs = (): UIExtensionDTO[] | undefined =>
  isInjected() ? ServerInject.UIExtensionConfigs : undefined;
