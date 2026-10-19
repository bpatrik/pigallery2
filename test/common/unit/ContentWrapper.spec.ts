import {expect} from 'chai';
import {ContentWrapper, ContentWrapperUtils} from '../../../src/common/entities/ContentWrapper';
import {TestHelper} from '../../TestHelper';
import {DirectoryPathDTO, ParentDirectoryDTO} from '../../../src/common/entities/DirectoryDTO';
import {SearchResultDTO} from '../../../src/common/entities/SearchResultDTO';
import {SearchQueryTypes, TextSearch} from '../../../src/common/entities/SearchQueryDTO';
import {Utils} from '../../../src/common/Utils';
import {MediaDTOUtils} from '../../../src/common/entities/MediaDTO';
import {VideoDTO} from '../../../src/common/entities/VideoDTO';
import {PhotoDTO} from '../../../src/common/entities/PhotoDTO';


describe('ContentWrapper', () => {

  const cleanUpCW = (cw: ContentWrapper): ContentWrapper => {
    if (typeof cw.notModified === 'undefined') {
      delete cw.notModified;
    }

    const content = (cw?.directory ? cw.directory : cw?.searchResult);
    for (let i = 0; i < content.media.length; ++i) {
      const m = content.media[i];
      if (MediaDTOUtils.isPhoto(m)) {
        delete (m as VideoDTO).metadata.bitRate;
        delete (m as VideoDTO).metadata.duration;
        if (!(m as PhotoDTO).metadata.caption) {
          delete (m as PhotoDTO).metadata.caption;
        }
      } else if (MediaDTOUtils.isVideo(m)) {
        delete (m as PhotoDTO).metadata.rating;
        delete (m as PhotoDTO).metadata.caption;
        delete (m as PhotoDTO).metadata.cameraData;
        delete (m as PhotoDTO).metadata.keywords;
        delete (m as PhotoDTO).metadata.faces;
        delete (m as PhotoDTO).metadata.positionData;
      }
      if (m.missingThumbnails === 0) {
        delete m.missingThumbnails;
      }
    }
    if (!(content.directories?.length > 0)) {
      delete content.directories;
    }
    for (let i = 0; i < content.metaFile.length; ++i) {
      delete content.metaFile[i].id;
    }
    return cw;
  };

  it('pack and unpack directory', () => {
    const parent = TestHelper.getDirectoryEntry();
    TestHelper.getPhotoEntry(parent);
    TestHelper.getPhotoEntry1(parent);
    TestHelper.getPhotoEntry2(parent);
    TestHelper.getVideoEntry(parent);
    TestHelper.getGPXEntry(parent);
    const parentOrig = TestHelper.getDirectoryEntry();
    TestHelper.getPhotoEntry(parentOrig);
    TestHelper.getPhotoEntry1(parentOrig);
    TestHelper.getPhotoEntry2(parentOrig);
    TestHelper.getVideoEntry(parentOrig);
    TestHelper.getGPXEntry(parentOrig);
    const cwOrig = ContentWrapperUtils.build(parentOrig as ParentDirectoryDTO, null);
    const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);
    expect(ContentWrapperUtils.unpack(ContentWrapperUtils.pack(cw))).to.deep.equals(cleanUpCW(cwOrig));
  });


  it('pack and unpack search result', () => {

    const parent: DirectoryPathDTO = {
      name: 'parent',
      path: ''
    };

    const subDir: DirectoryPathDTO = {
      name: 'subDir',
      path: 'parent/'
    };

    const sr: SearchResultDTO = {
      directories: [subDir as any],
      media: [TestHelper.getPhotoEntry(parent),
        TestHelper.getPhotoEntry1(parent),
        TestHelper.getPhotoEntry2(subDir),
        TestHelper.getVideoEntry(parent)
      ],
      metaFile: [
        TestHelper.getGPXEntry(parent)],
      resultOverflow: false,
      searchQuery: {type: SearchQueryTypes.any_text, value: ''} as TextSearch
    };

    const cw = ContentWrapperUtils.build(null, sr);
    expect(ContentWrapperUtils.unpack(ContentWrapperUtils.pack(Utils.clone(cw)))).to.deep.equals(cleanUpCW(cw));
  });

  describe('equals', () => {

    it('should directory equal', () => {
      const parent = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parent);
      TestHelper.getPhotoEntry1(parent);
      TestHelper.getPhotoEntry2(parent);
      TestHelper.getVideoEntry(parent);
      TestHelper.getGPXEntry(parent);
      const parentOrig = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parentOrig);
      TestHelper.getPhotoEntry1(parentOrig);
      TestHelper.getPhotoEntry2(parentOrig);
      TestHelper.getVideoEntry(parentOrig);
      TestHelper.getGPXEntry(parentOrig);
      const cwOrig = ContentWrapperUtils.build(parentOrig as ParentDirectoryDTO, null);
      const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);
      expect(ContentWrapperUtils.equals(cwOrig, cw)).to.equal(true);
      expect(ContentWrapperUtils.equals(cw, cwOrig)).to.equal(true);
    });


    it('should directory NOT equal when metafile is missing', () => {
      const parent = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parent);
      TestHelper.getPhotoEntry1(parent);
      TestHelper.getPhotoEntry2(parent);
      TestHelper.getVideoEntry(parent);
      const parentOrig = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parentOrig);
      TestHelper.getPhotoEntry1(parentOrig);
      TestHelper.getPhotoEntry2(parentOrig);
      TestHelper.getVideoEntry(parentOrig);
      TestHelper.getGPXEntry(parentOrig);
      const cwOrig = ContentWrapperUtils.build(parentOrig as ParentDirectoryDTO, null);
      const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);

      expect(cwOrig).to.not.deep.equals(cw);
      expect(ContentWrapperUtils.equals(cwOrig, cw)).to.equals(false);
      expect(ContentWrapperUtils.equals(cw, cwOrig)).to.equals(false);
    });

    it('should directory NOT equal when metafile is missing', () => {
      const parent = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parent);
      TestHelper.getPhotoEntry1(parent);
      TestHelper.getPhotoEntry2(parent);
      TestHelper.getVideoEntry(parent);
      TestHelper.getGPXEntry(parent);
      parent.metaFile[0].name = 'new name';
      const parentOrig = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parentOrig);
      TestHelper.getPhotoEntry1(parentOrig);
      TestHelper.getPhotoEntry2(parentOrig);
      TestHelper.getVideoEntry(parentOrig);
      TestHelper.getGPXEntry(parentOrig);
      const cwOrig = ContentWrapperUtils.build(parentOrig as ParentDirectoryDTO, null);
      const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);

      expect(cwOrig).to.not.deep.equals(cw);
      expect(ContentWrapperUtils.equals(cwOrig, cw)).to.equals(false);
      expect(ContentWrapperUtils.equals(cw, cwOrig)).to.equals(false);
    });
    it('should directory NOT equal when media is different', () => {
      const parent = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parent);
      TestHelper.getPhotoEntry1(parent);
      TestHelper.getPhotoEntry2(parent);
      TestHelper.getVideoEntry(parent);
      TestHelper.getGPXEntry(parent);
      const parentOrig = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parentOrig);
      TestHelper.getPhotoEntry1(parentOrig);
      TestHelper.getPhotoEntry2(parentOrig);
      TestHelper.getVideoEntry(parentOrig);
      TestHelper.getGPXEntry(parentOrig);
      const cwOrig = ContentWrapperUtils.build(parentOrig as ParentDirectoryDTO, null);
      const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);

      const test = (outcome: boolean, reason?: string) => {

        expect(ContentWrapperUtils.equals(cwOrig, cw)).to.equals(outcome, reason);
        expect(ContentWrapperUtils.equals(cw, cwOrig)).to.equals(outcome, reason);
      };

      test(true, 'no diff');
      let tmp: any = parent.media[0].name;
      parent.media[0].name = 'new name';
      test(false, 'new name');
      parent.media[0].name = tmp;
      test(true);

      tmp = parent.media[0].metadata.size.height;
      parent.media[0].metadata.size.height = -1;
      test(false);
      parent.media[0].metadata.size.height = tmp;
      test(true);
      tmp = parent.media.pop();
      test(false);
      parent.media.push(tmp);
      test(true);
      tmp = parent.media.shift();
      test(false);
      parent.media.push(tmp); // order should not matter
      test(true, 'different order, but same elements');
      tmp = parent.media;
      parent.media = null;
      test(false);
      parent.media = tmp;
      test(true);

    });

    it('should NOT equal when notModified flag differs', () => {
      const parent = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(parent);
      const cw1 = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null, true);
      const cw2 = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null, false);
      const cw3 = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null, true);

      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);

      expect(ContentWrapperUtils.equals(cw1, cw3)).to.equal(true);
    });

    it('should handle null and undefined inputs safely', () => {
      const parent = TestHelper.getDirectoryEntry();
      const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);

      // both null
      expect(ContentWrapperUtils.equals(null as any, null as any)).to.equal(true);
      // one null
      expect(ContentWrapperUtils.equals(cw, null as any)).to.equal(false);
      expect(ContentWrapperUtils.equals(null as any, cw)).to.equal(false);
    });

    it('should NOT equal when directory properties differ', () => {
      const parent1 = TestHelper.getDirectoryEntry();
      const parent2 = TestHelper.getDirectoryEntry();

      parent2.name = 'different name';
      const cw1 = ContentWrapperUtils.build(parent1 as ParentDirectoryDTO, null);
      const cw2 = ContentWrapperUtils.build(parent2 as ParentDirectoryDTO, null);

      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });
    it('should NOT equal when subdirectories differ', () => {
      const parent1 = TestHelper.getDirectoryEntry();
      const parent2 = TestHelper.getDirectoryEntry();

      parent1.directories.push(TestHelper.getDirectoryEntry(parent1, 'sub'));
      // parent2 has no subdirectories

      const cw1 = ContentWrapperUtils.build(parent1 as ParentDirectoryDTO, null);
      const cw2 = ContentWrapperUtils.build(parent2 as ParentDirectoryDTO, null);

      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });
    it('should equal when comparing the same object reference', () => {
      const parent = TestHelper.getDirectoryEntry();
      const cw = ContentWrapperUtils.build(parent as ParentDirectoryDTO, null);
      expect(ContentWrapperUtils.equals(cw, cw)).to.equal(true);
    });

    it('should still equal when subdirectories are in different order', () => {
      const parent1 = TestHelper.getDirectoryEntry();
      const sub1 = TestHelper.getDirectoryEntry(parent1, 'a');
      const sub2 = TestHelper.getDirectoryEntry(parent1, 'b');
      parent1.directories = [sub1, sub2];

      const parent2 = TestHelper.getDirectoryEntry();
      const sub3 = TestHelper.getDirectoryEntry(parent2, 'b');
      const sub4 = TestHelper.getDirectoryEntry(parent2, 'a');
      parent2.directories = [sub3, sub4];

      const cw1 = ContentWrapperUtils.build(parent1 as ParentDirectoryDTO, null);
      const cw2 = ContentWrapperUtils.build(parent2 as ParentDirectoryDTO, null);

      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(true);
    });

    it('should equal when both directories have no media or metafiles', () => {
      const parent1 = TestHelper.getDirectoryEntry();
      const parent2 = TestHelper.getDirectoryEntry();
      parent1.media = [];
      parent2.media = [];
      parent1.metaFile = [];
      parent2.metaFile = [];

      const cw1 = ContentWrapperUtils.build(parent1 as ParentDirectoryDTO, null);
      const cw2 = ContentWrapperUtils.build(parent2 as ParentDirectoryDTO, null);

      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(true);
    });

    it('should equal when search results are identical', () => {
      const dir1 = TestHelper.getDirectoryEntry();
      const dir2 = TestHelper.getDirectoryEntry();
      const p1 = TestHelper.getPhotoEntry(dir1);
      const p2 = TestHelper.getPhotoEntry(dir2);

      const sr1 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir1],
        media: [p1],
        metaFile: [],
        resultOverflow: true
      } as SearchResultDTO;

      const sr2 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir2],
        media: [p2],
        metaFile: [],
        resultOverflow: true
      } as SearchResultDTO;

      const cw1 = ContentWrapperUtils.build(null, sr1);
      const cw2 = ContentWrapperUtils.build(null, sr2);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(true);
    });

    it('should NOT equal when search result directories differ', () => {
      const dir1 = TestHelper.getDirectoryEntry();
      const dir2 = TestHelper.getDirectoryEntry();
      dir2.name = 'different';
      const p1 = TestHelper.getPhotoEntry(dir1);
      const p2 = TestHelper.getPhotoEntry(dir2);

      const sr1 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir1],
        media: [p1],
        metaFile: [],
        resultOverflow: true
      } as SearchResultDTO;

      const sr2 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir2],
        media: [p2],
        metaFile: [],
        resultOverflow: true
      } as SearchResultDTO;

      const cw1 = ContentWrapperUtils.build(null, sr1);
      const cw2 = ContentWrapperUtils.build(null, sr2);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });

    it('should NOT equal when search result media differ', () => {
      const dir1 = TestHelper.getDirectoryEntry();
      const dir2 = TestHelper.getDirectoryEntry();
      const p1 = TestHelper.getPhotoEntry(dir1);
      const p2 = TestHelper.getPhotoEntry(dir2);
      p2.name = 'renamed.jpg';

      const sr1 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir1],
        media: [p1],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO;

      const sr2 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir2],
        media: [p2],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO;

      const cw1 = ContentWrapperUtils.build(null, sr1);
      const cw2 = ContentWrapperUtils.build(null, sr2);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });

    it('should NOT equal when metaFile differs', () => {
      const dir1 = TestHelper.getDirectoryEntry();
      const dir2 = TestHelper.getDirectoryEntry();
      const p1 = TestHelper.getPhotoEntry(dir1);
      const p2 = TestHelper.getPhotoEntry(dir2);
      const gpx1 = TestHelper.getGPXEntry(dir1);
      const gpx2 = TestHelper.getGPXEntry(dir2);
      gpx2.name = 'renamed.gpx';

      const sr1 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir1],
        media: [p1],
        metaFile: [gpx1],
        resultOverflow: false
      } as SearchResultDTO;

      const sr2 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir2],
        media: [p2],
        metaFile: [gpx2],
        resultOverflow: false
      } as SearchResultDTO;

      const cw1 = ContentWrapperUtils.build(null, sr1);
      const cw2 = ContentWrapperUtils.build(null, sr2);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });

    it('should NOT equal when notModified flag differs', () => {
      const dir1 = TestHelper.getDirectoryEntry();
      const p1 = TestHelper.getPhotoEntry(dir1);

      const sr = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir1],
        media: [p1],
        metaFile: [],
        resultOverflow: true
      } as SearchResultDTO;

      const cw1 = ContentWrapperUtils.build(null, sr, true);
      const cw2 = ContentWrapperUtils.build(null, sr, false);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });

    it('should NOT equal when one is directory-based and other is search-based', () => {
      const dir = TestHelper.getDirectoryEntry();
      TestHelper.getPhotoEntry(dir);
      const cw1 = ContentWrapperUtils.build(dir as ParentDirectoryDTO, null);

      const sr = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir],
        media: dir.media,
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO;

      const cw2 = ContentWrapperUtils.build(null, sr);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });

    it('should NOT equal when one searchResult has missing media', () => {
      const dir1 = TestHelper.getDirectoryEntry();
      const dir2 = TestHelper.getDirectoryEntry();
      const p1 = TestHelper.getPhotoEntry(dir1);
      const p2 = TestHelper.getPhotoEntry(dir2);

      const sr1 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir1],
        media: [p1],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO;

      const sr2 = {
        searchQuery: { type: SearchQueryTypes.any_text, value: '' } as TextSearch,
        directories: [dir2],
        media: [],
        metaFile: [],
        resultOverflow: false
      } as SearchResultDTO;

      const cw1 = ContentWrapperUtils.build(null, sr1);
      const cw2 = ContentWrapperUtils.build(null, sr2);
      expect(ContentWrapperUtils.equals(cw1, cw2)).to.equal(false);
    });

    it('should NOT equal media when a metadata property is removed', () => {
      const dir = TestHelper.getDirectoryEntry();
      const p1 = TestHelper.getPhotoEntry(dir);
      p1.metadata.keywords = ['favorite'];
      // the directory references its media: clone without it
      const copy = () => {
        const {directory, ...rest} = p1;
        return {...Utils.clone(rest), directory} as PhotoDTO;
      };
      const p2 = copy();
      delete p2.metadata.keywords;

      expect(ContentWrapperUtils.equalsMedia(p1, copy())).to.equal(true);
      expect(ContentWrapperUtils.equalsMedia(p1, p2)).to.equal(false);
      expect(ContentWrapperUtils.equalsMedia(p2, p1)).to.equal(false);
    });
  });

});
