import {ChildEntity, Column} from 'typeorm';
import {MediaEntity, MediaMetadataEntity} from './MediaEntity';
import {VideoDTO, VideoMetadata,} from '../../../../common/entities/VideoDTO';

export class VideoMetadataEntity
    extends MediaMetadataEntity
    implements VideoMetadata {
  @Column('int')
  bitRate: number;

  @Column('bigint', {
    unsigned: true,
    nullable: true,
    transformer: {
      from: (v) => parseInt(v, 10) || null,
      to: (v) => v,
    },
  })
  duration: number;

  @Column('int')
  fps: number;
}

@ChildEntity()
export class VideoEntity extends MediaEntity implements VideoDTO {
  @Column(() => VideoMetadataEntity)
  metadata: VideoMetadataEntity;
}
