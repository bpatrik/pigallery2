import {Column, Entity, Index, OneToOne, PrimaryGeneratedColumn, TableInheritance,} from 'typeorm';
import {columnCharsetCS} from '../EntityUtils';
import {AlbumBaseDTO} from '../../../../../common/entities/album/AlbumBaseDTO';
import {ProjectedAlbumCacheEntity} from './ProjectedAlbumCacheEntity';

@Entity()
@TableInheritance({column: {type: 'varchar', name: 'type', length: 24}})
export class AlbumBaseEntity implements AlbumBaseDTO {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id!: number;

  @Index()
  @Column(columnCharsetCS)
  name!: string;

  /**
   * Locked albums are not possible to remove
   */
  @Column({default: false})
  locked!: boolean;

  @OneToOne(() => ProjectedAlbumCacheEntity, (c) => c.album)
  public cache!: ProjectedAlbumCacheEntity;
}
