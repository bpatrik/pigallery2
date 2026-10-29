import {
  Routes,
  UrlMatchResult,
  UrlSegment,
} from '@angular/router';
import { LoginComponent } from './ui/login/login.component';
import { GalleryComponent } from './ui/gallery/gallery.component';
import { AdminComponent } from './ui/admin/admin.component';
import { ShareLoginComponent } from './ui/sharelogin/share-login.component';
import { QueryParams } from '../../common/QueryParams';
import { DuplicateComponent } from './ui/duplicates/duplicates.component';
import { FacesComponent } from './ui/faces/faces.component';
import { authGuard } from './model/network/helper/auth.guard';
import { AlbumsComponent } from './ui/albums/albums.component';
import { ErrorComponent } from './ui/error/error.component';

export function galleryMatcherFunction(
  segments: UrlSegment[]
): UrlMatchResult | null {
  if (segments.length === 0) {
    return null;
  }
  const path = segments[0].path;

  const posParams: { [key: string]: UrlSegment } = {};
  if (path === 'gallery') {
    if (segments.length > 1) {
      posParams[QueryParams.gallery.directory] = segments[1];
    }
    return {
      consumed: segments.slice(0, Math.min(segments.length, 2)),
      posParams,
    };
  }
  if (path === 'search') {
    if (segments.length > 1) {
      posParams[QueryParams.gallery.search.query] = segments[1];
    }
    return {
      consumed: segments.slice(0, Math.min(segments.length, 2)),
      posParams,
    };
  }
  if (path === 'share') {
    if (segments.length > 1) {
      posParams[QueryParams.gallery.sharingKey_params] = segments[1];
    }
    return {
      consumed: segments.slice(0, Math.min(segments.length, 2)),
      posParams,
    };
  }
  return null;
}

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'shareLogin',
    component: ShareLoginComponent,
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard],
  },
  {
    path: 'duplicates',
    component: DuplicateComponent,
    canActivate: [authGuard],
  },
  {
    path: 'albums',
    component: AlbumsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'faces',
    component: FacesComponent,
    canActivate: [authGuard],
  },
  {
    path: 'error',
    component: ErrorComponent,
  },
  {
    matcher: galleryMatcherFunction,
    component: GalleryComponent,
    canActivate: [authGuard],
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/error', pathMatch: 'full' },
];
