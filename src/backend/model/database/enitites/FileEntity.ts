import {Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, TableInheritance,} from 'typeorm';
import {DirectoryEntity} from './DirectoryEntity';
import {FileDTO} from '../../../../common/entities/FileDTO';
import {columnCharsetCS} from './EntityUtils';

@Entity()
@TableInheritance({column: {type: 'varchar', name: 'type', length: 16}})
export class FileEntity implements FileDTO {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Column(columnCharsetCS)
  name: string;

  @Index()
  @ManyToOne(() => DirectoryEntity, (directory) => directory.metaFile, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  directory: DirectoryEntity;
}
