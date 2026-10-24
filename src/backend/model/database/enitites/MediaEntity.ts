import {Column, Entity, Index, ManyToOne, OneToMany, PrimaryGeneratedColumn, TableInheritance, Unique,} from 'typeorm';
import {DirectoryEntity} from './DirectoryEntity';
import {LiveVideoInfo, MediaDimension, MediaDTO, MediaMetadata,} from '../../../../common/entities/MediaDTO';
import {PersonJunctionTable} from './person/PersonJunctionTable';
import {columnCharsetCS, columnCharsetCSWith} from './EntityUtils';
import {CameraMetadata, FaceRegion, GPSMetadata, PositionMetaData,} from '../../../../common/entities/PhotoDTO';
import {Utils} from '../../../../common/Utils';

export class MediaDimensionEntity implements MediaDimension {
  @Column('int')
  width: number;

  @Column('int')
  height: number;
}

export class CameraMetadataEntity implements CameraMetadata {
  @Column('int', {nullable: true, unsigned: true})
  ISO: number;

  @Column(columnCharsetCSWith({
    type: 'text',
    nullable: true,
  }))
  model: string;

  @Column(columnCharsetCSWith({
    type: 'text',
    nullable: true,
  }))
  make: string;

  @Column('float', {nullable: true})
  fStop: number;

  @Column('float', {nullable: true})
  exposure: number;

  @Column('float', {nullable: true})
  focalLength: number;

  @Column('text', {nullable: true})
  lens: string;
}

export class GPSMetadataEntity implements GPSMetadata {
  @Column('float', {nullable: true})
  latitude: number;
  @Column('float', {nullable: true})
  longitude: number;
}

export class PositionMetaDataEntity implements PositionMetaData {
  @Column(() => GPSMetadataEntity)
  GPSData: GPSMetadataEntity;

  @Column(columnCharsetCSWith({
    type: 'text',
    nullable: true,
  }))
  country: string;

  @Column(columnCharsetCSWith({
    type: 'text',
    nullable: true,
  }))
  state: string;

  @Column(columnCharsetCSWith({
    type: 'text',
    nullable: true,
  }))
  city: string;
}

export class MediaMetadataEntity implements MediaMetadata {
  @Column('text')
  caption?: string;

  @Column('text')
  title?: string;

  @Column(() => MediaDimensionEntity)
  size: MediaDimensionEntity;

  /**
   * Date in local timezone
   * Reason: If you look back your holiday photos from a different timezone,
   * you do not want to see 2AM next to a photo that was taken during lunch
   */
  @Column('bigint', {
    transformer: {
      from: (v) => parseInt(v, 10),
      to: (v) => v,
    },
  })
  @Index()
  creationDate: number;

  @Column('smallint', {
    transformer: {
      from: (v) => Utils.getOffsetString(v), //from database repr. as smallint (minutes) to string (+/-HH:MM)
      to: (v) => Utils.getOffsetMinutes(v), //from entiry repr. as string (+/-HH:MM) to smallint (minutes)
    },
  })
  creationDateOffset?: string;


  @Column('bigint', {unsigned: true, transformer: {from: (v) => v == null ? null : parseInt(v, 10), to: (v) => v}})
  fileSize: number;

  @Column(columnCharsetCSWith({
    type: 'simple-array',
  }))
  keywords: string[];

  @Column(() => CameraMetadataEntity)
  cameraData: CameraMetadataEntity;

  @Column(() => PositionMetaDataEntity)
  positionData: PositionMetaDataEntity;

  @Column('tinyint', {unsigned: true})
  @Index()
  rating: 0 | 1 | 2 | 3 | 4 | 5;

  @OneToMany(() => PersonJunctionTable, (junctionTable) => junctionTable.media)
  personJunction: PersonJunctionTable[];

  @Column(columnCharsetCSWith({
    type: 'simple-json',
    nullable: true,
  }))
  faces: FaceRegion[];

  /**
   * Caches the list of persons. Only used for searching
   */
  @Column(columnCharsetCSWith({
    type: 'simple-array',
    select: false,
    nullable: true,
  }))
  persons: string[];

  /**
   * Caches the list of persons' length. Only used for searching
   */
  @Column({
    type: 'tinyint',
    select: false,
    nullable: false,
    default: 0
  })
  personsLength: number;


  @Column('int', {unsigned: true})
  bitRate: number;

  @Column('int', {unsigned: true})
  duration: number;

  @Column({type: 'text', nullable: true})
  contentIdentifier: string;
}

// TODO: fix inheritance once its working in typeorm
@Entity()
@Unique(['name', 'directory'])
@TableInheritance({column: {type: 'varchar', name: 'type', length: 16}})
export abstract class MediaEntity implements MediaDTO {
  @Index()
  @PrimaryGeneratedColumn({unsigned: true})
  id: number;

  @Column(columnCharsetCS)
  name: string;

  @Index()
  @ManyToOne(() => DirectoryEntity, (directory) => directory.media, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  directory: DirectoryEntity;

  @Column(() => MediaMetadataEntity)
  metadata: MediaMetadataEntity;

  missingThumbnails: number;

  liveVideoPath: string;

  liveVideoInfo: LiveVideoInfo;
}
