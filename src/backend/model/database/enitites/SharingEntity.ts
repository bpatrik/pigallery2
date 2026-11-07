import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {BaseSharingDTO} from '../../../../common/entities/SharingDTO';
import {UserEntity} from './UserEntity';
import {DirectorySearch, SearchQueryDTO} from '../../../../common/entities/SearchQueryDTO';

@Entity()
export class SharingEntity implements BaseSharingDTO {
  @PrimaryGeneratedColumn({unsigned: true})
  id!: number;

  @Column()
  sharingKey!: string;

  /*
  * This query determines what is available for the user through sharing
  * Basically it's an allow-list of photos. Optional, if directoryQuery is set.
  * */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) as unknown : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  searchQuery!: SearchQueryDTO | null;

  /*
  * This directory search determines what directories are available (can be listed) for the user through sharing.
  * Basically it's an allow-list of directories (the photos in them too). Optional, if searchQuery is set.
  * If not set, only directories with visible photos are available.
  * */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) as unknown : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  directoryQuery!: DirectorySearch | null;

  /**
   * Only of the defaults should be set at most. If none is set the defaultSearchView will be searchQuery
   */
  @Column({
    type: 'text',
    nullable: true
  })
  defaultDirectoryView!: string | null;
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      from: (val: string) => {
        return val ? JSON.parse(val) as unknown : null;
      },
      to: (val: object) => {
        return val ? JSON.stringify(val) : null;
      },
    },
  })
  defaultSearchView!: SearchQueryDTO | null;

  @Column({type: 'text', nullable: true})
  password!: string | null;

  @Column('bigint', {
    unsigned: true,
    transformer: {
      from: (v: string) => parseInt(v, 10),
      to: (v: unknown) => v,
    },
  })
  expires!: number;

  @Column('bigint', {
    unsigned: true,
    transformer: {
      from: (v: string) => parseInt(v, 10),
      to: (v: unknown) => v,
    },
  })
  timeStamp!: number;

  @ManyToOne(() => UserEntity, {onDelete: 'CASCADE', nullable: false})
  creator!: UserEntity;
}
