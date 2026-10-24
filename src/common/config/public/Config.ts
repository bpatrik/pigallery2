import {ClientConfig} from './ClientConfig';
import {WebConfigClass} from 'typeconfig/src/decorators/class/WebConfigClass';
import {WebConfigClassBuilder} from 'typeconfig/src/decorators/builders/WebConfigClassBuilder';
import {IWebConfigClass} from 'typeconfig/common';
import {Utils} from '../../Utils';

/**
 * Returns the configured publicUrl, or if it is not set, the origin with the urlBase (sub path) appended.
 */
export function resolvePublicUrl(publicUrl: string, urlBase: string, origin: string): string {
  if (publicUrl) {
    return publicUrl;
  }
  return Utils.concatUrls(origin, urlBase);
}

/**
 * These configuration will be available at frontend and backend too
 */
@WebConfigClass()
export class ClientClass extends ClientConfig {
}

// ConfigInject is getting injected form the server side to the global scope
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace ServerInject {
  export const ConfigInject: ClientClass;
}

export const Config: IWebConfigClass & ClientClass =
    WebConfigClassBuilder.attachInterface(new ClientClass());

if (
    typeof ServerInject !== 'undefined' &&
    typeof ServerInject.ConfigInject !== 'undefined'
) {
  Config.load(ServerInject.ConfigInject);
}

Config.Server.publicUrl = resolvePublicUrl(
    Config.Server.publicUrl,
    Config.Server.urlBase,
    location.origin
);

