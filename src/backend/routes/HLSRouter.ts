import {Express} from 'express';
import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {HLSMWs} from '../middlewares/HLSMWs';
import {Config} from '../../common/config/private/Config';

export class HLSRouter {
  public static route(app: Express): void {
    const base = Config.Server.apiPath + '/gallery/hls/:mediaPath(*)';

    // Playlist
    app.get(
      base + '/playlist.m3u8',
      HLSMWs.checkEnabled,
      AuthenticationMWs.authenticate,
      AuthenticationMWs.normalizePathParam('mediaPath'),
      AuthenticationMWs.authoriseMedia('mediaPath'),
      HLSMWs.servePlaylist
    );

    // Init segment + media segments — single route via :filename param
    app.get(
      base + '/:filename',
      HLSMWs.checkEnabled,
      AuthenticationMWs.authenticate,
      AuthenticationMWs.normalizePathParam('mediaPath'),
      AuthenticationMWs.authoriseMedia('mediaPath'),
      HLSMWs.serveSegmentFile
    );
  }
}
