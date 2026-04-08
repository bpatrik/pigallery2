import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {BaseSharingDTO} from '../../../../common/entities/SharingDTO';
import {UserEntity} from './UserEntity';
import {SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';

@Entity()
export class SharingEntity implements BaseSharingDTO {
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Column()
  sharingKey: string;

  @Column({
    type: 'text',
    nullable: false,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  searchQuery: SearchQueryDTO;

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

  @ManyToOne(() => UserEntity, {onDelete: 'CASCADE', nullable: false})
  creator: UserEntity;
}
