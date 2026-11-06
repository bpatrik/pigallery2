import { Component, ElementRef, OnInit, inject, viewChild, computed, Signal } from '@angular/core';
import {FacesService} from './faces.service';
import {QueryService} from '../../model/query.service';
import {PersonDTO} from '../../../../common/entities/PersonDTO';
import {PiTitleService} from '../../model/pi-title.service';
import { FrameComponent } from '../frame/frame.component';
import { FaceComponent } from './face/face.component';
import {SortByDirectionalTypes} from '../../../../common/entities/SortingMethods';
import { FacesNavigatorComponent } from './navigator/navigator.faces.component';

@Component({
    selector: 'app-faces',
    templateUrl: './faces.component.html',
    styleUrl: './faces.component.css',
    imports: [
    FrameComponent,
    FaceComponent,
    FacesNavigatorComponent
]
})
export class FacesComponent implements OnInit {
  facesService = inject(FacesService);
  queryService = inject(QueryService);
  private piTitleService = inject(PiTitleService);

  readonly container = viewChild<ElementRef>('container');
  public size: number;
  private readonly sortedPersons: Signal<PersonDTO[]> = computed(() => {
    const sorting = this.facesService.sorting();
    // sorting a copy: the service's array must not change in place
    return [...this.facesService.persons()].sort((p1: PersonDTO, p2: PersonDTO) => {
      let res = 0;
      if (sorting.method === SortByDirectionalTypes.PersonCount) {
        res = (p1.cache?.count || 0) - (p2.cache?.count || 0);
      } else {
        res = p1.name.localeCompare(p2.name);
      }
      return res * (sorting.ascending ? 1 : -1);
    });
  });
  readonly favourites = computed(() => this.sortedPersons().filter((p) => p.isFavourite));
  readonly nonFavourites = computed(() => this.sortedPersons().filter((p) => !p.isFavourite));

  constructor() {
    this.facesService.getPersons().catch(console.error);
  }

  ngOnInit(): void {
    this.piTitleService.setTitle($localize`Faces`);
    this.updateSize();
  }

  private updateSize(): void {
    const size = 220 + 5;
    // body - container margin
    const container = this.container();
    if (!container) {
      return;
    }
    const containerWidth = container.nativeElement.clientWidth - 30;
    this.size = containerWidth / Math.round(containerWidth / size) - 5;
  }
}

