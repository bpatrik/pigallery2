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
import {ClientConfig, TAGS} from '../../common/config/public/ClientConfig';
import {QueryParams} from '../../common/QueryParams';
import {PhotoProcessing} from '../model/fileaccess/fileprocessing/PhotoProcessing';
import {Utils} from '../../common/Utils';

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

    const redirectToBase = (locale: string) => {
      return (req: Request, res: Response) => {
        if (Config.Server.languages.indexOf(locale) !== -1) {
          res.cookie(CookieNames.lang, locale);
        }
        res.redirect(Utils.concatUrls('/' + Config.Server.urlBase) + '/?ln=' + locale);
      };
    };

    const addTPl = (req: Request, res: Response, next: NextFunction) => {

      res.tpl = {};

      res.tpl.user = null;
      if (req.session['user']) {
        res.tpl.user = {
          id: req.session['user'].id,
          name: req.session['user'].name,
          csrfToken: req.session['user'].csrfToken,
          role: req.session['user'].role,
          usedSharingKey: req.session['user'].usedSharingKey,
          permissions: req.session['user'].permissions,
        } as UserDTO;

        if (!res.tpl.user.csrfToken && req.csrfToken) {
          res.tpl.user.csrfToken = req.csrfToken();
        }
      }
      const confCopy = Config.toJSON({
        attachVolatile: true,
        skipTags: {secret: true} as TAGS,
        keepTags: {client: true}
      }) as unknown as ClientConfig;
      // Escaping html tags, like <script></script>
      confCopy.Server.customHTMLHead =
        confCopy.Server.customHTMLHead
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      res.tpl.Config = confCopy;
      res.tpl.customHTMLHead = Config.Server.customHTMLHead;
      const selectedTheme = Config.Gallery.Themes.availableThemes.find(th => th.name === Config.Gallery.Themes.selectedTheme)?.theme || '';
      res.tpl.usedTheme = selectedTheme;

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
          Config.Server.publicUrl === '' ? '.' : Config.Server.publicUrl,
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

    app.get('/icon.svg', (req: Request, res: Response) => {
      res.set('Cache-control', 'public, max-age=31536000');
      res.header('Content-Type', 'image/svg+xml');
      res.send(getIcon());
    });


    app.get('/icon_padding_auto.svg', (req: Request, res: Response) => {
      res.set('Cache-control', 'public, max-age=31536000');
      res.header('Content-Type', 'image/svg+xml');
      // Use 40% padding: https://w3c.github.io/manifest/#icon-masks
      res.send(getIcon('auto', 0.7));
    });


    app.get('/icon_auto.svg', (req: Request, res: Response) => {
      res.set('Cache-control', 'public, max-age=31536000');
      res.header('Content-Type', 'image/svg+xml');
      res.send(getIcon('auto'));
    });

    app.get('/icon_white.svg', (req: Request, res: Response) => {
      res.set('Cache-control', 'public, max-age=31536000');
      res.header('Content-Type', 'image/svg+xml');
      res.send(getIcon('white'));
    });


    app.get('/icon.png', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const p = path.join(ProjectPath.TempFolder, '/icon.png');
        await PhotoProcessing.renderSVG(Config.Server.svgIcon, p);
        res.sendFile(p, {
          maxAge: 31536000,
          dotfiles: 'allow',
        });
      } catch (e) {
        return next(e);
      }
    });

    app.get('/icon_white.png', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const p = path.join(ProjectPath.TempFolder, '/icon_inv.png');
        await PhotoProcessing.renderSVG(Config.Server.svgIcon, p, 'white');
        res.sendFile(p, {
          maxAge: 31536000,
          dotfiles: 'allow',
        });
      } catch (e) {
        return next(e);
      }
    });

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
    Config.Server.languages.forEach((l) => {
      app.get(
        [
          '/' + l + '/',
          '/' + l + '/login',
          '/' + l + '/gallery*',
          '/' + l + '/share*',
          '/' + l + '/admin',
          '/' + l + '/search*',
        ],
        redirectToBase(l)
      );
    });

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
        res.sendFile(file, {
          maxAge: 31536000,
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
