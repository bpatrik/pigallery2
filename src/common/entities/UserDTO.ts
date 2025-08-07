import {SearchQueryDTO} from './SearchQueryDTO';

export enum UserRoles {
  LimitedGuest = 1,
  Guest = 2,
  User = 3,
  Admin = 4,
  Developer = 5,
}

export interface UserDTO {
  id: number;
  name: string;
  password: string;
  role: UserRoles;
  usedSharingKey?: string;
  allowList: SearchQueryDTO;
}
