import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {FacesService} from './faces.service';
import {QueryService} from '../../model/query.service';
import {combineLatest, Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {PiTitleService} from '../../model/pi-title.service';
import { FrameComponent } from '../frame/frame.component';
import { AsyncPipe } from '@angular/common';
import { FaceComponent } from './face/face.component';
import {SortByDirectionalTypes} from '../../../../common/entities/SortingMethods';
import { FacesNavigatorComponent } from './navigator/navigator.faces.component';

@Component({
    selector: 'app-faces',
    templateUrl: './faces.component.html',
    styleUrls: ['./faces.component.css'],
    imports: [
    FrameComponent,
    FaceComponent,
    AsyncPipe,
    FacesNavigatorComponent
]
})
export class FacesComponent implements OnInit {
  @ViewChild('container', {static: true}) container: ElementRef;
  public size: number;
  favourites: Observable<PersonDTO[]>;
  nonFavourites: Observable<PersonDTO[]>;

  constructor(
      public facesService: FacesService,
      public queryService: QueryService,
      private piTitleService: PiTitleService
  ) {
    this.facesService.getPersons().catch(console.error);

    const sortedPersons = combineLatest([this.facesService.persons, this.facesService.sorting]).pipe(
      map(([persons, sorting]) => {
        return persons.sort((p1: PersonDTO, p2: PersonDTO) => {
          let res = 0;
          if (sorting.method === SortByDirectionalTypes.PersonCount) {
            res = (p1.cache?.count || 0) - (p2.cache?.count || 0);
          } else {
            res = p1.name.localeCompare(p2.name);
          }
          return res * (sorting.ascending ? 1 : -1);
        });
      })
    );

    this.favourites = sortedPersons.pipe(
        map((value) => value.filter((p) => p.isFavourite))
    );
    this.nonFavourites = sortedPersons.pipe(
        map((value) => value.filter((p) => !p.isFavourite))
    );
  }

  ngOnInit(): void {
    this.piTitleService.setTitle($localize`Faces`);
    this.updateSize();
  }

  private updateSize(): void {
    const size = 220 + 5;
    // body - container margin
    const containerWidth = this.container.nativeElement.clientWidth - 30;
    this.size = containerWidth / Math.round(containerWidth / size) - 5;
  }
}

