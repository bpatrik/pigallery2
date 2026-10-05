import {Injectable} from '@angular/core';
import {Config} from '../../../../../common/config/public/Config';
import {ActivatedRoute, type Params, Router} from '@angular/router';
import {QueryParams} from '../../../../../common/QueryParams';
import {Subscription} from 'rxjs';
import {LightBoxTitleTexts} from '../../../../../common/config/public/ClientConfig';
import {Utils} from '../../../../../common/Utils';

@Injectable({
  providedIn: 'root'
})
export class LightboxService {
  private subscription: Subscription;

  constructor(private route: ActivatedRoute,
              private router: Router) {


    this.subscription = this.route.queryParams.subscribe(
      (params: Params) => {
        const sValue = params[QueryParams.gallery.lightbox.slideshowSpeed];
        if (sValue !== undefined) {
          this.slideshowSpeed = parseInt(sValue, 10) as number;
        }
        const faoValue = params[QueryParams.gallery.lightbox.facesAlwaysOn];
        if (faoValue !== undefined) {
          this.facesAlwaysOn = faoValue === 'true' || faoValue === true;
        }
        const lvValue = params[QueryParams.gallery.lightbox.loopVideos];
        if (lvValue !== undefined) {
          this.loopVideos = lvValue === 'true' || lvValue === true;
        }
        const lsValue = params[QueryParams.gallery.lightbox.loopSlideshow];
        if (lsValue !== undefined) {
          this.loopSlideshow = lsValue === 'true' || lsValue === true;
        }
        const qpValue = params[QueryParams.gallery.lightbox.captionAlwaysOn];
        if (qpValue !== undefined) {
          this.captionAlwaysOn = qpValue === 'true' || qpValue === true;
        }
        const pbValue = params[QueryParams.gallery.lightbox.playback];
        if (pbValue !== undefined) {
          this.playback = pbValue === 'true' || pbValue === true;
        }

        const cdValue = params[QueryParams.gallery.lightbox.controllersDimmed];
        if (cdValue !== undefined) {
          this.controllersDimmed = cdValue === 'true' || cdValue === true;
        }

        // Dynamic Lightbox Titles override via query params
        const titles = QueryParams.gallery.lightbox.titles;
        const tlt = params[titles.topLeftTitle];
        if (tlt !== undefined) {
          this.topLeftTitle = this.parseTitles(tlt);
        }
        const tlst = params[titles.topLeftSubTitle];
        if (tlst !== undefined) {
          this.topLeftSubtitle = this.parseTitles(tlst);
        }
        const blt = params[titles.bottomLeftTitle];
        if (blt !== undefined) {
          this.bottomLeftTitle = this.parseTitles(blt);
        }
        const blst = params[titles.bottomLeftSubTitle];
        if (blst !== undefined) {
          this.bottomLeftSubtitle = this.parseTitles(blst);
        }
      }
    );
  }

  private _slideshowSpeed: number = Config.Gallery.Lightbox.slideshowSpeed;

  get slideshowSpeed(): number {
    return this._slideshowSpeed;
  }

  set slideshowSpeed(value: number) {
    this._slideshowSpeed = parseInt(value as unknown as any) as number;
    this.updateQuery(QueryParams.gallery.lightbox.slideshowSpeed, Config.Gallery.Lightbox.slideshowSpeed, value);
  }

  private _playback = false;

  get playback(): boolean {
    return this._playback;
  }

  set playback(value: boolean) {
    this._playback = value;
    this.updateQuery(QueryParams.gallery.lightbox.playback, false, value);
  }

  private _facesAlwaysOn = Config.Gallery.Lightbox.facesAlwaysOn;

  get facesAlwaysOn(): boolean {
    return this._facesAlwaysOn;
  }

  set facesAlwaysOn(value: boolean) {
    this._facesAlwaysOn = value;
    this.updateQuery(QueryParams.gallery.lightbox.facesAlwaysOn, Config.Gallery.Lightbox.facesAlwaysOn, value);
  }

  private _loopVideos = Config.Gallery.Lightbox.loopVideos;

  get loopVideos(): boolean {
    return this._loopVideos;
  }

  set loopVideos(value: boolean) {
    this._loopVideos = value;
    this.updateQuery(QueryParams.gallery.lightbox.loopVideos, Config.Gallery.Lightbox.loopVideos, value);
  }

  private _loopSlideshow = Config.Gallery.Lightbox.loopSlideshow;

  get loopSlideshow(): boolean {
    return this._loopSlideshow;
  }

  set loopSlideshow(value: boolean) {
    this._loopSlideshow = value;
    this.updateQuery(QueryParams.gallery.lightbox.loopSlideshow, Config.Gallery.Lightbox.loopSlideshow, value);
  }

  private _captionAlwaysOn = Config.Gallery.Lightbox.captionAlwaysOn;

  get captionAlwaysOn(): boolean {
    return this._captionAlwaysOn;
  }

  set captionAlwaysOn(value: boolean) {
    this._captionAlwaysOn = value;
    this.updateQuery(QueryParams.gallery.lightbox.captionAlwaysOn, Config.Gallery.Lightbox.captionAlwaysOn, value);
  }

  private _controllersDimmed = false;

  get controllersDimmed(): boolean {
    return this._controllersDimmed;
  }

  set controllersDimmed(value: boolean) {
    this._controllersDimmed = value;
    this.updateQuery(QueryParams.gallery.lightbox.controllersDimmed, false, value);
  }

  // Lightbox title texts (dynamic overrides) with getter/setter pattern
  private _topLeftTitle: LightBoxTitleTexts[] = [...Config.Gallery.Lightbox.Titles.topLeftTitle];

  get topLeftTitle(): LightBoxTitleTexts[] {
    return this._topLeftTitle;
  }

  set topLeftTitle(value: LightBoxTitleTexts[]) {
    this._topLeftTitle = value;
    const key = QueryParams.gallery.lightbox.titles.topLeftTitle;
    const defStr = this.serializeTitles(Config.Gallery.Lightbox.Titles.topLeftTitle);
    const newStr = this.serializeTitles(value);
    this.updateQuery(key, defStr, newStr);
  }

  private _topLeftSubtitle: LightBoxTitleTexts[] = [...Config.Gallery.Lightbox.Titles.topLeftSubtitle];

  get topLeftSubtitle(): LightBoxTitleTexts[] {
    return this._topLeftSubtitle;
  }

  set topLeftSubtitle(value: LightBoxTitleTexts[]) {
    this._topLeftSubtitle = value;
    const key = QueryParams.gallery.lightbox.titles.topLeftSubTitle;
    const defStr = this.serializeTitles(Config.Gallery.Lightbox.Titles.topLeftSubtitle);
    const newStr = this.serializeTitles(value);
    this.updateQuery(key, defStr, newStr);
  }

  private _bottomLeftTitle: LightBoxTitleTexts[] = [...Config.Gallery.Lightbox.Titles.bottomLeftTitle];

  get bottomLeftTitle(): LightBoxTitleTexts[] {
    return this._bottomLeftTitle;
  }

  set bottomLeftTitle(value: LightBoxTitleTexts[]) {
    this._bottomLeftTitle = value;
    const key = QueryParams.gallery.lightbox.titles.bottomLeftTitle;
    const defStr = this.serializeTitles(Config.Gallery.Lightbox.Titles.bottomLeftTitle);
    const newStr = this.serializeTitles(value);
    this.updateQuery(key, defStr, newStr);
  }

  private _bottomLeftSubtitle: LightBoxTitleTexts[] = [...Config.Gallery.Lightbox.Titles.bottomLeftSubtitle];

  get bottomLeftSubtitle(): LightBoxTitleTexts[] {
    return this._bottomLeftSubtitle;
  }

  set bottomLeftSubtitle(value: LightBoxTitleTexts[]) {
    this._bottomLeftSubtitle = value;
    const key = QueryParams.gallery.lightbox.titles.bottomLeftSubTitle;
    const defStr = this.serializeTitles(Config.Gallery.Lightbox.Titles.bottomLeftSubtitle);
    const newStr = this.serializeTitles(value);
    this.updateQuery(key, defStr, newStr);
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  private updateQuery(key: string, defValue: boolean | number | string, newValue: boolean | number | string) {
    // for strings: also treat empty string as null
    if (defValue === newValue || (typeof newValue === 'string' && newValue.trim() === '')) {
      newValue = null;
    }
    // Merge this param into the current URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [key]: newValue
      },
      queryParamsHandling: 'merge', // keep existing params
      replaceUrl: true // optional: avoid pushing to the history stack
    }).catch(console.error);
  }

  private serializeTitles(values: number[]): string {
    return Utils.serializeEnumNames(values, LightBoxTitleTexts);
  }

  private parseTitles(param: string | string[]): LightBoxTitleTexts[] {
    return Utils.parseEnumArray(param, LightBoxTitleTexts as unknown as Record<string, number>) as LightBoxTitleTexts[];
  }

}
