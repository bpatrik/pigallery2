import {Pipe, PipeTransform} from '@angular/core';
import {UserRoles} from '../../../common/entities/UserDTO';

@Pipe({name: 'stringifyRole'})
export class StringifyRole implements PipeTransform {
  transform(role: number): string {
    return UserRoles[role];
  }
}

