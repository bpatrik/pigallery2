import {
  Routes,
  UrlMatchResult,
  UrlSegment,
} from '@angular/router';
import { GalleryComponent } from './ui/gallery/gallery.component';
import { QueryParams } from '../../common/QueryParams';
import { authGuard } from './model/network/helper/auth.guard';
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
    loadComponent: () => import('./ui/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'shareLogin',
    loadComponent: () => import('./ui/sharelogin/share-login.component').then(m => m.ShareLoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./ui/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard],
  },
  {
    path: 'duplicates',
    loadComponent: () => import('./ui/duplicates/duplicates.component').then(m => m.DuplicateComponent),
    canActivate: [authGuard],
  },
  {
    path: 'albums',
    loadComponent: () => import('./ui/albums/albums.component').then(m => m.AlbumsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'faces',
    loadComponent: () => import('./ui/faces/faces.component').then(m => m.FacesComponent),
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
