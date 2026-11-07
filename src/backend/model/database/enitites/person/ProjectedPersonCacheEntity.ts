import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { PersonEntry } from './PersonEntry';
import { PersonJunctionTable } from './PersonJunctionTable';
import {PersonCacheDTO} from '../../../../../common/entities/PersonDTO';

// Projection-aware cache for persons, analogous to ProjectedDirectoryCacheEntity
// Stores per-projection aggregates for a given person
@Entity()
@Unique(['projectionKey', 'person'])
export class ProjectedPersonCacheEntity implements PersonCacheDTO{
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  // hash key of the projection (built by SessionManager)
  @Index()
  @Column({type: 'varchar', length: 32, select: false}) // not needed in payloads; used to select the right cache per session
  projectionKey!: string;

  // the person this cache row is about
  @Index()
  @ManyToOne(() => PersonEntry, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  person!: PersonEntry;

  // number of visible face regions for this person under the projection
  @Column('int', { unsigned: true, default: 0 })
  count!: number;

  // a PersonJunctionTable row id under the projection chosen by ranking
  @ManyToOne(() => PersonJunctionTable, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  sampleRegion!: PersonJunctionTable | null;

  // if false, sample (or other aggregates) need recomputation
  @Column({ type: 'boolean', default: true })
  valid!: boolean;
}
