import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {IUserManager} from '../interfaces/IUserManager';
import {ProjectPath} from '../../../ProjectPath';
import {Utils} from '../../../../common/Utils';
import * as fs from 'fs';
import * as path from 'path';
import {PasswordHelper} from '../../PasswordHelper';


export class UserManager implements IUserManager {
  private db: { users?: UserDTO[], idCounter?: number } = {};
  private readonly dbPath: string;


  constructor() {
    this.dbPath = path.join(ProjectPath.DBFolder, 'users.db');
    if (fs.existsSync(this.dbPath)) {
      this.loadDB();
    }

    if (!this.db.idCounter) {
      this.db.idCounter = 1;
    }

    if (!this.db.users) {
      this.db.users = [];
      this.createUser({
        name: PasswordHelper.getDefaultAdminUser(),
        password: PasswordHelper.getDefaultAdminPassword(),
        role: UserRoles.Admin
      } as UserDTO);
    }
    this.saveDB();

  }


  public async findOne(filter: any): Promise<UserDTO> {
    const result = await this.find(filter);

    if (result.length === 0) {
      throw new Error('UserDTO not found');
    }
    return result[0];
  }

  public async find(filter: any): Promise<UserDTO[]> {
    const pass = filter.password;
    delete filter.password;
    const users = this.db.users.slice();
    let i = users.length;
    while (i--) {
      if (pass && !(PasswordHelper.comparePassword(pass, users[i].password))) {
        users.splice(i, 1);
        continue;
      }
      if (Utils.equalsFilter(users[i], filter) === false) {
        users.splice(i, 1);
      }
    }
    return users;
  }

  public async createUser(user: UserDTO): Promise<UserDTO> {
    user.id = this.db.idCounter++;
    user.password = PasswordHelper.cryptPassword(user.password);
    this.db.users.push(user);
    this.saveDB();
    return user;
  }

  public async deleteUser(id: number): Promise<null | UserDTO> {
    const deleted = this.db.users.filter((u: UserDTO): boolean => u.id === id);
    this.db.users = this.db.users.filter((u: UserDTO): boolean => u.id !== id);
    this.saveDB();
    if (deleted.length > 0) {
      return deleted[0];
    }
    return null;
  }

  public async changeRole(id: number, newRole: UserRoles): Promise<UserDTO> {
    for (const item of this.db.users) {
      if (item.id === id) {
        item.role = newRole;
        this.saveDB();
        return item;
      }
    }
  }

  public async changePassword(request: any): Promise<void> {
    throw new Error('not implemented'); // TODO: implement
  }

  private loadDB(): void {
    const data = fs.readFileSync(this.dbPath, 'utf8');
    this.db = JSON.parse(data);
  }

  private saveDB(): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.db));
  }

}
