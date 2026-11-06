import {Injectable, inject, OnDestroy, signal} from '@angular/core';
import {Config} from '../../../../../common/config/public/Config';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {QueryParams} from '../../../../../common/QueryParams';
import {Subscription} from 'rxjs';
import {LightBoxTitleTexts} from '../../../../../common/config/public/ClientConfig';
import {Utils} from '../../../../../common/Utils';

/**
 * The lightbox settings that can be set through the URL (e.g. by the photo frame builder).
 * The signals follow the URL; the setters write it.
 */
@Injectable({
  providedIn: 'root'
})
export class LightboxService implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private readonly slideshowSpeedSignal = signal<number>(Config.Gallery.Lightbox.slideshowSpeed);
  public readonly slideshowSpeed = this.slideshowSpeedSignal.asReadonly();
  // the slideshow is running; follows the URL, so it is false without the parameter
  private readonly playbackSignal = signal(false);
  public readonly playback = this.playbackSignal.asReadonly();
  private readonly facesAlwaysOnSignal = signal(Config.Gallery.Lightbox.facesAlwaysOn);
  public readonly facesAlwaysOn = this.facesAlwaysOnSignal.asReadonly();
  private readonly loopVideosSignal = signal(Config.Gallery.Lightbox.loopVideos);
  public readonly loopVideos = this.loopVideosSignal.asReadonly();
  private readonly loopSlideshowSignal = signal(Config.Gallery.Lightbox.loopSlideshow);
  public readonly loopSlideshow = this.loopSlideshowSignal.asReadonly();
  private readonly captionAlwaysOnSignal = signal(Config.Gallery.Lightbox.captionAlwaysOn);
  public readonly captionAlwaysOn = this.captionAlwaysOnSignal.asReadonly();
  private readonly controllersDimmedSignal = signal(false);
  public readonly controllersDimmed = this.controllersDimmedSignal.asReadonly();
  private readonly topLeftTitleSignal = signal<LightBoxTitleTexts[]>([...Config.Gallery.Lightbox.Titles.topLeftTitle]);
  public readonly topLeftTitle = this.topLeftTitleSignal.asReadonly();
  private readonly topLeftSubtitleSignal = signal<LightBoxTitleTexts[]>([...Config.Gallery.Lightbox.Titles.topLeftSubtitle]);
  public readonly topLeftSubtitle = this.topLeftSubtitleSignal.asReadonly();
  private readonly bottomLeftTitleSignal = signal<LightBoxTitleTexts[]>([...Config.Gallery.Lightbox.Titles.bottomLeftTitle]);
  public readonly bottomLeftTitle = this.bottomLeftTitleSignal.asReadonly();
  private readonly bottomLeftSubtitleSignal = signal<LightBoxTitleTexts[]>([...Config.Gallery.Lightbox.Titles.bottomLeftSubtitle]);
  public readonly bottomLeftSubtitle = this.bottomLeftSubtitleSignal.asReadonly();

  private subscription: Subscription;

  constructor() {
    this.subscription = this.route.queryParams.subscribe(
      (params: Params): void => {
        const parseBool = (v: unknown): boolean => v === 'true' || v === true;
        const sValue = params[QueryParams.gallery.lightbox.slideshowSpeed];
        if (sValue !== undefined) {
          this.slideshowSpeedSignal.set(parseInt(sValue, 10));
        }
        const faoValue = params[QueryParams.gallery.lightbox.facesAlwaysOn];
        if (faoValue !== undefined) {
          this.facesAlwaysOnSignal.set(parseBool(faoValue));
        }
        const lvValue = params[QueryParams.gallery.lightbox.loopVideos];
        if (lvValue !== undefined) {
          this.loopVideosSignal.set(parseBool(lvValue));
        }
        const lsValue = params[QueryParams.gallery.lightbox.loopSlideshow];
        if (lsValue !== undefined) {
          this.loopSlideshowSignal.set(parseBool(lsValue));
        }
        const qpValue = params[QueryParams.gallery.lightbox.captionAlwaysOn];
        if (qpValue !== undefined) {
          this.captionAlwaysOnSignal.set(parseBool(qpValue));
        }
        this.playbackSignal.set(parseBool(params[QueryParams.gallery.lightbox.playback]));

        const cdValue = params[QueryParams.gallery.lightbox.controllersDimmed];
        if (cdValue !== undefined) {
          this.controllersDimmedSignal.set(parseBool(cdValue));
        }

        // Dynamic Lightbox Titles override via query params
        const titles = QueryParams.gallery.lightbox.titles;
        const tlt = params[titles.topLeftTitle];
        if (tlt !== undefined) {
          this.topLeftTitleSignal.set(this.parseTitles(tlt));
        }
        const tlst = params[titles.topLeftSubTitle];
        if (tlst !== undefined) {
          this.topLeftSubtitleSignal.set(this.parseTitles(tlst));
        }
        const blt = params[titles.bottomLeftTitle];
        if (blt !== undefined) {
          this.bottomLeftTitleSignal.set(this.parseTitles(blt));
        }
        const blst = params[titles.bottomLeftSubTitle];
        if (blst !== undefined) {
          this.bottomLeftSubtitleSignal.set(this.parseTitles(blst));
        }
      }
    );
  }

  setSlideshowSpeed(value: number | string): void {
    const speed = parseInt(value as string, 10);
    this.slideshowSpeedSignal.set(speed);
    this.updateQuery(QueryParams.gallery.lightbox.slideshowSpeed, Config.Gallery.Lightbox.slideshowSpeed, speed);
  }

  setPlayback(value: boolean): void {
    this.playbackSignal.set(value);
    this.updateQuery(QueryParams.gallery.lightbox.playback, false, value);
  }

  setFacesAlwaysOn(value: boolean): void {
    this.facesAlwaysOnSignal.set(value);
    this.updateQuery(QueryParams.gallery.lightbox.facesAlwaysOn, Config.Gallery.Lightbox.facesAlwaysOn, value);
  }

  setLoopVideos(value: boolean): void {
    this.loopVideosSignal.set(value);
    this.updateQuery(QueryParams.gallery.lightbox.loopVideos, Config.Gallery.Lightbox.loopVideos, value);
  }

  setLoopSlideshow(value: boolean): void {
    this.loopSlideshowSignal.set(value);
    this.updateQuery(QueryParams.gallery.lightbox.loopSlideshow, Config.Gallery.Lightbox.loopSlideshow, value);
  }

  setCaptionAlwaysOn(value: boolean): void {
    this.captionAlwaysOnSignal.set(value);
    this.updateQuery(QueryParams.gallery.lightbox.captionAlwaysOn, Config.Gallery.Lightbox.captionAlwaysOn, value);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateQuery(key: string, defValue: boolean | number | string, newValue: boolean | number | string | null): void {
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

  private parseTitles(param: string | string[]): LightBoxTitleTexts[] {
    return Utils.parseEnumArray(param, LightBoxTitleTexts as unknown as Record<string, number>) as LightBoxTitleTexts[];
  }

}
