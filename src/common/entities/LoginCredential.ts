export class LoginCredential {
  constructor(
      public username: string = '',
      public password: string = '',
      public rememberMe: boolean = true
  ) {
  }
}
