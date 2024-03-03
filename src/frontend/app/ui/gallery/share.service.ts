import {Injectable} from '@angular/core';
import {NetworkService} from '../../model/network/network.service';
import {CreateSharingDTO, SharingDTO, SharingDTOKey,} from '../../../../common/entities/SharingDTO';
import {Router, RoutesRecognized} from '@angular/router';
import {BehaviorSubject} from 'rxjs';
import {distinctUntilChanged, filter} from 'rxjs/operators';
import {QueryParams} from '../../../../common/QueryParams';
import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {Utils} from '../../../../common/Utils';
import {Config} from '../../../../common/config/public/Config';


@Injectable()
export class ShareService {
  public readonly UnknownSharingKey = {
    sharingKey: 'UnknownSharingKey'
  } as SharingDTO;
  param: string = null;
  queryParam: string = null;
  sharingKey: string = null;
  inited = false;
  public ReadyPR: Promise<void>;
  public sharingSubject: BehaviorSubject<SharingDTO> = new BehaviorSubject(
    null
  );
  public sharingIsValid: BehaviorSubject<boolean> = new BehaviorSubject(
    null
  );
  public currentSharing = this.sharingSubject
    .asObservable()
    .pipe(filter((s) => s !== null))
    .pipe(distinctUntilChanged());

  private resolve: () => void;

  constructor(private networkService: NetworkService, private router: Router) {
    this.ReadyPR = new Promise((resolve: () => void) => {
      if (this.inited === true) {
        return resolve();
      }
      this.resolve = resolve;
    });

    this.router.events.subscribe(async (val) => {
      if (val instanceof RoutesRecognized) {
        this.param =
          val.state.root.firstChild.params[
            QueryParams.gallery.sharingKey_params
            ] || null;
        this.queryParam =
          val.state.root.firstChild.queryParams[
            QueryParams.gallery.sharingKey_query
            ] || null;

        const changed = this.sharingKey !== (this.param || this.queryParam);
        if (changed) {
          this.sharingKey = this.param || this.queryParam || this.sharingKey;
          await this.checkSharing();
        }
        if (this.resolve) {
          this.resolve();
          this.resolve = null;
          this.inited = true;
        }
      }
    });
  }

  public getUrl(share: SharingDTO): string {
    return Utils.concatUrls(Config.Server.publicUrl, '/share/', share.sharingKey);
  }


  onNewUser = async (user: UserDTO) => {
    // if this is a sharing user or a logged-in user, get sharing key
    if (user?.usedSharingKey || user?.role > UserRoles.LimitedGuest) {
      if (
        (user?.usedSharingKey &&
          user?.usedSharingKey !== this.sharingKey) ||
        this.sharingSubject.value == null
      ) {
        this.sharingKey = user.usedSharingKey || this.getSharingKey();
        if(!this.sharingKey){ //no key to fetch
          return
        }
        await this.getSharing();
      }
      if (this.resolve) {
        this.resolve();
        this.resolve = null;
        this.inited = true;
      }
    }
  };

  public wait(): Promise<void> {
    if (this.inited) {
      return Promise.resolve();
    }
    return this.ReadyPR;
  }

  public createSharing(
    dir: string,
    includeSubFolders: boolean,
    password: string,
    valid: number
  ): Promise<SharingDTO> {
    return this.networkService.postJson('/share/' + dir, {
      createSharing: {
        includeSubfolders: includeSubFolders,
        valid,
        ...(!!password && {password: password}) // only add password if present
      } as CreateSharingDTO,
    });
  }

  public updateSharing(
    dir: string,
    sharingId: number,
    includeSubFolders: boolean,
    password: string,
    valid: number
  ): Promise<SharingDTO> {
    return this.networkService.putJson('/share/' + dir, {
      updateSharing: {
        id: sharingId,
        includeSubfolders: includeSubFolders,
        valid,
        password,
      } as CreateSharingDTO,
    });
  }

  public getSharingKey(): string {
    return this.sharingKey;
  }

  public isSharing(): boolean {
    return this.sharingKey != null;
  }

  private async getSharing(): Promise<void> {
    try {
      this.sharingSubject.next(null);
      const sharing = await this.networkService.getJson<SharingDTO>(
        '/share/' + this.getSharingKey()
      );
      this.sharingSubject.next(sharing);
    } catch (e) {
      this.sharingSubject.next(this.UnknownSharingKey);
      console.error(e);
    }
  }

  private async checkSharing(): Promise<void> {
    try {
      this.sharingIsValid.next(null);
      const sharing = await this.networkService.getJson<SharingDTOKey>(
        '/share/' + this.getSharingKey() + '/key'
      );
      this.sharingIsValid.next(sharing.sharingKey === this.getSharingKey());
    } catch (e) {
      this.sharingIsValid.next(false);
      console.error(e);
    }
  }

  public async getSharingListForDir(
    dir: string
  ): Promise<SharingDTO[]> {
    return this.networkService.getJson('/share/list/' + dir);
  }


  public getSharingList(): Promise<SharingDTO[]> {
    if (!Config.Sharing.enabled) {
      return Promise.resolve([]);
    }
    return this.networkService.getJson('/share/listAll');
  }

  public deleteSharing(sharing: SharingDTO): Promise<void> {
    return this.networkService.deleteJson('/share/' + sharing.sharingKey);
  }
}
