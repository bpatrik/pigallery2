import {Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique} from 'typeorm';
import {MediaEntity} from './MediaEntity';
import {DirectoryEntity} from './DirectoryEntity';
import {DirectoryCacheDTO} from '../../../../common/entities/DirectoryDTO';

@Entity()
@Unique(['projectionKey', 'directory'])
@Index(['directory', 'projectionKey', 'valid']) // Composite index for join optimization
@Index(['projectionKey', 'valid']) // Index for projection key + valid queries
export class ProjectedDirectoryCacheEntity implements DirectoryCacheDTO {
  @PrimaryGeneratedColumn({unsigned: true})
  id!: number;

  @Index()
  @Column({type: 'varchar', length: 32, select: false}) // don't select it, we only use it to get the right cache for the given context
  projectionKey!: string; //it's a hash of the projection search query

  @Index()
  @ManyToOne(() => DirectoryEntity, {
    onDelete: 'CASCADE',
    nullable: false
  })
  directory!: DirectoryEntity;

  @Column('int', {unsigned: true, default: 0})
  mediaCount!: number;

  @Column('int', {unsigned: true, default: 0})
  recursiveMediaCount?: number;

  @Column('bigint', {nullable: true, transformer: {from: (v) => v == null ? null : parseInt(v, 10), to: (v) => v}})
  oldestMedia!: number | null;

  @Column('bigint', {nullable: true, transformer: {from: (v) => v == null ? null : parseInt(v, 10), to: (v) => v}})
  youngestMedia!: number | null;

  @ManyToOne(() => MediaEntity, {onDelete: 'SET NULL', nullable: true})
  cover!: MediaEntity;

  @Index() // Add index for valid column used in joins
  @Column({type: 'boolean', default: false})
  valid!: boolean;
}
