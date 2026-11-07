import {ChildEntity, Column} from 'typeorm';
import {MediaEntity, MediaMetadataEntity} from './MediaEntity';
import {VideoDTO, VideoMetadata,} from '../../../../common/entities/VideoDTO';

export class VideoMetadataEntity
    extends MediaMetadataEntity
    implements VideoMetadata {
  @Column('int')
  override bitRate!: number | null;

  @Column('bigint', {
    unsigned: true,
    nullable: true,
    transformer: {
      from: (v: string) => parseInt(v, 10) || null,
      to: (v: unknown) => v,
    },
  })
  override duration!: number;

  @Column('int')
  fps!: number | null;
}

@ChildEntity()
export class VideoEntity extends MediaEntity implements VideoDTO {
  @Column(() => VideoMetadataEntity)
  override metadata!: VideoMetadataEntity;
}
