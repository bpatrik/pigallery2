import {Pipe, type PipeTransform} from '@angular/core';
import {UserRoles} from '../../../common/entities/UserDTO';

@Pipe({
    name: 'stringifyRole',
    standalone: true
})
export class StringifyRole implements PipeTransform {
  transform(role: number): string {
    return UserRoles[role];
  }
}

