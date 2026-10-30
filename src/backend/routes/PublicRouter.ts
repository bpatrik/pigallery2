import {Express, NextFunction, Request, Response} from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import {Config} from '../../common/config/private/Config';
import {ProjectPath} from '../ProjectPath';
import {AuthenticationMWs} from '../middlewares/user/AuthenticationMWs';
import {CookieNames} from '../../common/CookieNames';
import {ErrorCodes, ErrorDTO} from '../../common/entities/Error';
import {UserDTO} from '../../common/entities/UserDTO';
import {ServerTimeEntry} from '../middlewares/ServerTimingMWs';
import {QueryParams} from '../../common/QueryParams';
import {PhotoProcessing} from '../model/fileaccess/fileprocessing/PhotoProcessing';
import {ObjectManagers} from '../model/ObjectManagers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      locale?: string;
      localePath?: string;
      tpl?: Record<string, any>;
      timing?: { [key: string]: ServerTimeEntry };
    }

    interface Response {
      tpl?: Record<string, any>;
    }
  }
}

export class PublicRouter {
  public static route(app: Express): void {
    const setLocale = (req: Request, res: Response, next: NextFunction) => {
      let selectedLocale = req.locale;
      if (req.cookies && req.cookies[CookieNames.lang]) {
        if (
          Config.Server.languages.indexOf(req.cookies[CookieNames.lang]) !== -1
        ) {
          selectedLocale = req.cookies[CookieNames.lang];
        }
      }
      res.cookie(CookieNames.lang, selectedLocale);
      req.localePath = selectedLocale;
      next();
    };

    // index.html should not be cached as it contains template that can change
    const renderIndex = (req: Request, res: Response, next: NextFunction) => {
      ejs.renderFile(
        path.join(ProjectPath.FrontendFolder, req.localePath, 'index.html'),
        res.tpl,
        (err, str) => {
          if (err) {
            return next(new ErrorDTO(ErrorCodes.GENERAL_ERROR, err.message));
          }
          res.send(str);
        }
      );
    };

    // /<locale>/<page> links (e.g. from the language menu) set the language, then open the same page
    const redirectToLocalePage = (req: Request, res: Response, next: NextFunction) => {
      const locale = req.params['locale'];
      if (Config.Server.languages.indexOf(locale) === -1) {
        return next();
      }
      res.cookie(CookieNames.lang, locale);
      // req.path is still url encoded, so the page is passed on as it is
      const page = req.path.substring(locale.length + 1);
      // keep the query, but drop the ln of an earlier language switch
      const queryStart = req.originalUrl.indexOf('?');
      const query = queryStart === -1 ? [] : req.originalUrl.substring(queryStart + 1)
        .split('&').filter((p) => p !== '' && !p.startsWith('ln='));
      query.push('ln=' + locale);
      res.redirect(Config.Server.getAppUrl(page) + '?' + query.join('&'));
    };

    const addTPl = (req: Request, res: Response, next: NextFunction) => {

      res.tpl = {};

      res.tpl.user = null;
      if (req.session.context?.user) {
        res.tpl.user = {
          id: req.session.context.user.id,
          name: req.session.context.user.name,
          role: req.session.context.user.role,
          usedSharingKey: req.session.context.user.usedSharingKey,
          projectionKey: req.session.context.user.projectionKey,
        } as UserDTO;

      }
      const confCopy = Config.getClientConfig();
      // Escaping html tags, like <script></script>
      confCopy.Server.customHTMLHead =
        confCopy.Server.customHTMLHead
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      res.tpl.Config = confCopy;
      res.tpl.baseHref = Config.Server.getAppUrl();
      res.tpl.customHTMLHead = Config.Server.customHTMLHead;
      const selectedTheme = Config.Gallery.Themes.availableThemes.find(th => th.name === Config.Gallery.Themes.selectedTheme)?.theme || '';
      res.tpl.usedTheme = selectedTheme;

      res.tpl.UIExtensionConfigs = ObjectManagers.getInstance().ExtensionManager.getUIExtensionConfigs();

      return next();
    };

    app.use(addTPl);

    app.get('/heartbeat', (req: Request, res: Response) => {
      res.sendStatus(200);
    });

    app.get('/manifest.json', (req: Request, res: Response) => {
      res.send({
        name: Config.Server.applicationTitle,
        icons: [
          {
            src: 'icon_auto.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon_padding_auto.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          },
          {
            src: 'icon_white.png',
            sizes: '48x48 72x72 96x96 128x128 256x256',
          },
        ],
        display: 'standalone',
        categories: [
          'photo'
        ],
        start_url:
          Config.Server.getPublicUrl(),
        background_color: '#000000',
        theme_color: '#000000',
      });
    });

    const getIcon = (theme: 'auto' | string | null = null, paddingPercent = 0): string => {
      const vBs = (Config.Server.svgIcon.viewBox || '').split(' ').slice(0, 4).map(s => parseFloat(s));
      vBs[0] = vBs[0] || 0;
      vBs[1] = vBs[1] || 0;
      vBs[2] = vBs[2] || 512;
      vBs[3] = vBs[3] || 512;

      // make icon rectangle
      //add padding to all sides equally. ie: center icon
      const icon_size = Math.max(vBs[2], vBs[3]);
      const pw = icon_size - vBs[2];
      const ph = icon_size - vBs[3];
      vBs[0] -= pw / 2;
      vBs[1] -= ph / 2;
      vBs[2] = icon_size;
      vBs[3] = icon_size;

      const getCanvasSize = () => Math.max(vBs[2], vBs[3]);

      const addPadding = (p: number) => {
        if (p <= 0) {
          return;
        }
        const size = getCanvasSize();
        vBs[0] -= size * (p / 2);
        vBs[1] -= size * (p / 2);
        vBs[2] += size * (p);
        vBs[3] += size * (p);
      };

      addPadding(paddingPercent);


      const canvasSize = getCanvasSize();
      const canvasStart = {
        x: vBs[0],
        y: vBs[1]
      };
      return '<svg ' +
        ' xmlns="http://www.w3.org/2000/svg"' +
        ' viewBox="' + vBs.join(' ') + '">' +
        (theme === 'auto' ? ('<style>' +
            '    path, circle {' +
            '      fill: black;' +
            '    }' +
            '   circle.bg,rect.bg {' +
            '    fill: white;' +
            '   }' +
            '    @media (prefers-color-scheme: dark) {' +
            '      path, circle {' +
            '        fill: white;' +
            '      }' +
            '   circle.bg,rect.bg {' +
            '    fill: black;' +
            '   }' +
            '    }' +
            '  </style>') :
          (theme != null ?
            ('<style>' +
              '    path, circle {' +
              '      fill: ' + theme + ';' +
              '    }' +
              '   circle.bg {' +
              '    fill: black;' +
              '   }' +
              '  </style>')
            : '<style>' +
            '   circle.bg,rect.bg {' +
            '    fill: white;' +
            '   }' +
            '  </style>')) +
        `<rect class="bg" x="${canvasStart.x}" y="${canvasStart.y}" width="${canvasSize}" height="${canvasSize}" rx="15" />` +
        Config.Server.svgIcon.items + '</svg>';
    };

    // Icons change with Config.Server.svgIcon under the same URL, so the browser revalidates them with the ETag.
    app.get('/icon.svg', (req: Request, res: Response) => {
      res.set('Cache-Control', 'no-cache');
      res.header('Content-Type', 'image/svg+xml');
      res.send(getIcon());
    });


    app.get('/icon_padding_auto.svg', (req: Request, res: Response) => {
      res.set('Cache-Control', 'no-cache');
      res.header('Content-Type', 'image/svg+xml');
      // Use 40% padding: https://w3c.github.io/manifest/#icon-masks
      res.send(getIcon('auto', 0.7));
    });


    app.get('/icon_auto.svg', (req: Request, res: Response) => {
      res.set('Cache-Control', 'no-cache');
      res.header('Content-Type', 'image/svg+xml');
      res.send(getIcon('auto'));
    });

    app.get('/icon_white.svg', (req: Request, res: Response) => {
      res.set('Cache-Control', 'no-cache');
      res.header('Content-Type', 'image/svg+xml');
      res.send(getIcon('white'));
    });


    app.get('/icon.png', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const p = path.join(ProjectPath.TempFolder, '/icon.png');
        const outP = await PhotoProcessing.renderSVG(Config.Server.svgIcon, p);
        res.set('Cache-Control', 'no-cache');
        res.sendFile(outP, {
          cacheControl: false,
          dotfiles: 'allow',
        });
      } catch (e) {
        return next(e);
      }
    });

    app.get('/icon_white.png', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const p = path.join(ProjectPath.TempFolder, '/icon_inv.png');
        const outP = await PhotoProcessing.renderSVG(Config.Server.svgIcon, p, 'white');
        res.set('Cache-Control', 'no-cache');
        res.sendFile(outP, {
          cacheControl: false,
          dotfiles: 'allow',
        });
      } catch (e) {
        return next(e);
      }
    });

    app.get(
      [
        '/error'
      ],
      addTPl, // add template after authentication was successful
      setLocale,
      renderIndex
    );

    app.get(
      [
        '/',
        '/login',
        '/gallery*',
        '/share/:' + QueryParams.gallery.sharingKey_params,
        '/shareLogin',
        '/admin',
        '/duplicates',
        '/faces',
        '/albums',
        '/search*',
      ],
      AuthenticationMWs.tryAuthenticate,
      addTPl, // add template after authentication was successful
      setLocale,
      renderIndex
    );
    app.get(['/:locale', '/:locale/*'], redirectToLocalePage);

    const renderFile = (subDir = '') => {
      return (req: Request, res: Response) => {
        const file = path.join(
          ProjectPath.FrontendFolder,
          req.localePath,
          subDir,
          req.params.file
        );
        if (!fs.existsSync(file)) {
          return res.sendStatus(404);
        }
        // esbuild puts a content hash in the name of the build output (e.g. hu.main-PCUX7IQM.js, styles-GXRELOEQ.css).
        // Other files (robots.txt, copied assets, the unhashed dev build) are revalidated with the ETag.
        if (/-[A-Z0-9]{8}\.[a-z0-9]+$/.test(req.params.file)) {
          res.sendFile(file, {
            maxAge: '365d', // number would be in ms
            immutable: true,
            dotfiles: 'allow',
          });
          return;
        }
        res.set('Cache-Control', 'no-cache');
        res.sendFile(file, {
          cacheControl: false,
          dotfiles: 'allow',
        });
      };
    };

    app.get(
      '/assets/:file(*)',
      setLocale,
      AuthenticationMWs.normalizePathParam('file'),
      renderFile('assets')
    );
    app.get(
      '/:file',
      setLocale,
      AuthenticationMWs.normalizePathParam('file'),
      renderFile()
    );
  }
}
