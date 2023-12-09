import {UserModificationRequest} from './UserModificationRequest';

export class PasswordChangeRequest extends UserModificationRequest {
  constructor(
      id: number,
      public oldPassword: string,
      public newPassword: string
  ) {
    super(id);
  }
}
