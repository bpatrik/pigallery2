import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class VersionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  version: number;
}
