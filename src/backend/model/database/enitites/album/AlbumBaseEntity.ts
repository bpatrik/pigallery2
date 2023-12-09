import {Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, TableInheritance,} from 'typeorm';
import {MediaEntity} from '../MediaEntity';
import {columnCharsetCS} from '../EntityUtils';
import {AlbumBaseDTO} from '../../../../../common/entities/album/AlbumBaseDTO';

@Entity()
@TableInheritance({column: {type: 'varchar', name: 'type', length: 24}})
export class AlbumBaseEntity implements AlbumBaseDTO {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Index()
  @Column(columnCharsetCS)
  name: string;

  /**
   * Locked albums are not possible to remove
   */
  @Column({default: false})
  locked: boolean;

  @Column('int', {unsigned: true, default: 0})
  count: number;

  @ManyToOne(() => MediaEntity, {onDelete: 'SET NULL', nullable: true})
  public cover: MediaEntity;
}
