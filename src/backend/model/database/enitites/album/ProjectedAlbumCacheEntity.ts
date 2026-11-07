import {Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique} from 'typeorm';
import {MediaEntity} from '../MediaEntity';
import {AlbumBaseEntity} from './AlbumBaseEntity';
import {AlbumCacheDTO} from '../../../../../common/entities/album/AlbumBaseDTO';

@Entity()
@Unique(['projectionKey', 'album'])
export class ProjectedAlbumCacheEntity implements AlbumCacheDTO {
  @PrimaryGeneratedColumn({unsigned: true})
  id!: number;

  @Index()
  @Column({type: 'varchar', length: 32, select: false}) // don't select it, we only use it to get the right cache for the given context
  projectionKey!: string; // it's a hash of the projection search query

  @Index()
  @ManyToOne(() => AlbumBaseEntity, {
    onDelete: 'CASCADE',
    nullable: false
  })
  album!: AlbumBaseEntity;

  @Column('int', {unsigned: true, default: 0})
  itemCount!: number; // Number of media items in album under projection

  @Column('bigint', {nullable: true, transformer: {from: (v: string | null) => v == null ? null : parseInt(v, 10), to: (v: unknown) => v}})
  oldestMedia!: number | null; // Oldest media timestamp in album under projection

  @Column('bigint', {nullable: true, transformer: {from: (v: string | null) => v == null ? null : parseInt(v, 10), to: (v: unknown) => v}})
  youngestMedia!: number | null; // Youngest media timestamp in album under projection

  @ManyToOne(() => MediaEntity, {onDelete: 'SET NULL', nullable: true})
  cover!: MediaEntity; // Album cover under projection

  @Column({type: 'boolean', default: false})
  valid!: boolean; // Cache validity flag
}
