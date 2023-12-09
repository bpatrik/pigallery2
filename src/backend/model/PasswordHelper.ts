import * as bcrypt from 'bcrypt';

export class PasswordHelper {
  public static cryptPassword(password: string): string {
    const salt = bcrypt.genSaltSync(9);
    return bcrypt.hashSync(password, salt);
  }

  public static comparePassword(
      password: string,
      encryptedPassword: string
  ): boolean {
    try {
      return bcrypt.compareSync(password, encryptedPassword);
      // eslint-disable-next-line no-empty
    } catch (e) {
    }
    return false;
  }
}
