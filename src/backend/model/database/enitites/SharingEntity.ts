import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {SharingDTO} from '../../../../common/entities/SharingDTO';
import {UserEntity} from './UserEntity';
import {UserDTO} from '../../../../common/entities/UserDTO';

@Entity()
export class SharingEntity implements SharingDTO {
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Column()
  sharingKey: string;

  @Column()
  path: string;

  @Column({type: 'text', nullable: true})
  password: string;

  @Column('bigint', {
    unsigned: true,
    transformer: {
      from: (v) => parseInt(v, 10),
      to: (v) => v,
    },
  })
  expires: number;

  @Column('bigint', {
    unsigned: true,
    transformer: {
      from: (v) => parseInt(v, 10),
      to: (v) => v,
    },
  })
  timeStamp: number;

  @Column()
  includeSubfolders: boolean;

  @ManyToOne(() => UserEntity, {onDelete: 'CASCADE', nullable: false})
  creator: UserDTO;
}
