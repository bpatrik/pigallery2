import {UserDTO, UserRoles} from '../../../../common/entities/UserDTO';
import {Column, Entity, PrimaryGeneratedColumn, Unique} from 'typeorm';
import {DirectorySearch, SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';
import {SessionUser} from '../../SessionContext';

@Entity()
@Unique(['name'])
export class UserEntity implements UserDTO,SessionUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column('smallint')
  role: UserRoles;

  // OIDC issuer and subject ('<iss>|<sub>'), only set in OIDC strict security mode
  @Column({type: 'text', nullable: true})
  oidcSubject?: string;

  // only if this set to true, will the per-user allow/blocklist be considered
  @Column({type: 'boolean', default: false})
  overrideAllowBlockList?: boolean;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  allowQuery?: SearchQueryDTO;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  blockQuery?: SearchQueryDTO;

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  allowDirectoryList?: DirectorySearch[];

  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  blockDirectoryList?: DirectorySearch[];
}
