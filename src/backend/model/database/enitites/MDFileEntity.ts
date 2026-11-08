import {ChildEntity, Column,} from 'typeorm';
import {MDFileDTO} from '../../../../common/entities/MDFileDTO';
import {FileEntity} from './FileEntity';

@ChildEntity()
export class MDFileEntity extends FileEntity implements MDFileDTO {

  @Column('bigint', {
    transformer: {
      from: (v: string) => parseInt(v, 10),
      to: (v: unknown) => v,
    },
  })
  date!: number; // same date as the youngest photo in a folder

}
