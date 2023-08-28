"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestHelper = void 0;
const MediaEntity_1 = require("../src/backend/model/database/enitites/MediaEntity");
const PhotoEntity_1 = require("../src/backend/model/database/enitites/PhotoEntity");
const DirectoryEntity_1 = require("../src/backend/model/database/enitites/DirectoryEntity");
const VideoEntity_1 = require("../src/backend/model/database/enitites/VideoEntity");
const DiskMangerWorker_1 = require("../src/backend/model/threading/DiskMangerWorker");
class TestHelper {
    static { this.creationCounter = 0; }
    static getDirectoryEntry(parent = null, name = 'wars dir') {
        const dir = new DirectoryEntity_1.DirectoryEntity();
        dir.name = name;
        dir.path = DiskMangerWorker_1.DiskMangerWorker.pathFromParent({ path: '', name: '.' });
        dir.mediaCount = 0;
        dir.directories = [];
        dir.metaFile = [];
        dir.media = [];
        dir.lastModified = 1656069687773;
        dir.lastScanned = 1656069687773;
        // dir.parent = null;
        if (parent !== null) {
            dir.path = DiskMangerWorker_1.DiskMangerWorker.pathFromParent(parent);
            parent.directories.push(dir);
        }
        return dir;
    }
    static getPhotoEntry(dir) {
        const sd = new MediaEntity_1.MediaDimensionEntity();
        sd.height = 400;
        sd.width = 200;
        const gps = new MediaEntity_1.GPSMetadataEntity();
        gps.latitude = 1;
        gps.longitude = 1;
        const pd = new MediaEntity_1.PositionMetaDataEntity();
        pd.city = 'New York';
        pd.country = 'Alderan';
        pd.state = 'Kamino';
        pd.GPSData = gps;
        const cd = new MediaEntity_1.CameraMetadataEntity();
        cd.ISO = 100;
        cd.model = '60D';
        cd.make = 'Canon';
        cd.fStop = 1;
        cd.exposure = 1;
        cd.focalLength = 1;
        cd.lens = 'Lens';
        const m = new PhotoEntity_1.PhotoMetadataEntity();
        m.caption = null;
        m.keywords = ['apple'];
        m.cameraData = cd;
        m.positionData = pd;
        m.size = sd;
        m.creationDate = 1656069387772;
        m.fileSize = 123456789;
        // m.rating = 0; no rating by default
        // TODO: remove when typeorm is fixed
        m.duration = null;
        m.bitRate = null;
        const d = new PhotoEntity_1.PhotoEntity();
        d.name = 'test media.jpg';
        d.directory = dir;
        if (dir.media) {
            dir.media.push(d);
            dir.mediaCount++;
        }
        d.metadata = m;
        return d;
    }
    static getVideoEntry(dir) {
        const sd = new MediaEntity_1.MediaDimensionEntity();
        sd.height = 200;
        sd.width = 300;
        const m = new VideoEntity_1.VideoMetadataEntity();
        m.caption = null;
        m.keywords = null;
        m.rating = null;
        m.size = sd;
        m.creationDate = 1656069387771;
        m.fileSize = 123456789;
        m.duration = 10000;
        m.bitRate = 4000;
        const d = new VideoEntity_1.VideoEntity();
        d.name = 'test video.mp4';
        d.directory = dir;
        if (dir.media) {
            dir.media.push(d);
            dir.mediaCount++;
        }
        d.metadata = m;
        return d;
    }
    static getGPXEntry(dir) {
        const d = {
            id: null,
            name: 'saturdayRun.gpx',
            directory: dir
        };
        if (dir.metaFile) {
            dir.metaFile.push(d);
        }
        return d;
    }
    static getVideoEntry1(dir) {
        const p = TestHelper.getVideoEntry(dir);
        p.name = 'swVideo.mp4';
        return p;
    }
    static getPhotoEntry1(dir) {
        const p = TestHelper.getPhotoEntry(dir);
        p.metadata.caption = 'Han Solo\'s dice';
        p.metadata.keywords = ['Boba Fett', 'star wars', 'Anakin', 'death star'];
        p.metadata.positionData.city = 'Mos Eisley';
        p.metadata.positionData.country = 'Tatooine';
        p.name = 'sw1.jpg';
        p.metadata.positionData.GPSData.latitude = 10;
        p.metadata.positionData.GPSData.longitude = 10;
        p.metadata.creationDate = 1656069387772 - 1000;
        p.metadata.rating = 1;
        p.metadata.size.height = 1000;
        p.metadata.size.width = 1000;
        p.metadata.faces = [{
                box: { height: 10, width: 10, left: 10, top: 10 },
                name: 'Boba Fett'
            }, {
                box: { height: 10, width: 10, left: 102, top: 102 },
                name: 'Luke Skywalker'
            }, {
                box: { height: 10, width: 10, left: 103, top: 103 },
                name: 'Han Solo'
            }, {
                box: { height: 10, width: 10, left: 104, top: 104 },
                name: 'Unkle Ben'
            }, {
                box: { height: 10, width: 10, left: 105, top: 105 },
                name: 'Arvíztűrő Tükörfúrógép'
            }, {
                box: { height: 10, width: 10, left: 201, top: 201 },
                name: 'R2-D2'
            }];
        return p;
    }
    static getPhotoEntry2(dir) {
        const p = TestHelper.getPhotoEntry(dir);
        p.metadata.caption = 'Light saber';
        p.metadata.keywords = ['Padmé Amidala', 'star wars', 'Natalie Portman', 'death star', 'wookiee'];
        p.metadata.positionData.city = 'Derem City';
        p.metadata.positionData.state = 'Research City';
        p.metadata.positionData.country = 'Kamino';
        p.name = 'sw2.jpg';
        p.metadata.positionData.GPSData.latitude = -10;
        p.metadata.positionData.GPSData.longitude = -10;
        p.metadata.creationDate = 1656069387772 - 2000;
        p.metadata.rating = 2;
        p.metadata.size.height = 2000;
        p.metadata.size.width = 1000;
        p.metadata.faces = [{
                box: { height: 10, width: 10, left: 10, top: 10 },
                name: 'Padmé Amidala'
            }, {
                box: { height: 10, width: 10, left: 101, top: 101 },
                name: 'Anakin Skywalker'
            }, {
                box: { height: 10, width: 10, left: 101, top: 101 },
                name: 'Obivan Kenobi'
            }, {
                box: { height: 10, width: 10, left: 201, top: 201 },
                name: 'R2-D2'
            }];
        return p;
    }
    static getPhotoEntry3(dir) {
        const p = TestHelper.getPhotoEntry(dir);
        p.metadata.caption = 'Amber stone';
        p.metadata.keywords = ['star wars', 'wookiees'];
        p.metadata.positionData.city = 'Castilon';
        p.metadata.positionData.state = 'Devaron';
        p.metadata.positionData.country = 'Ajan Kloss';
        p.name = 'sw3.jpg';
        p.metadata.positionData.GPSData.latitude = 10;
        p.metadata.positionData.GPSData.longitude = 15;
        p.metadata.creationDate = 1656069387772 - 3000;
        p.metadata.rating = 3;
        p.metadata.size.height = 1000;
        p.metadata.size.width = 2000;
        p.metadata.faces = [{
                box: { height: 10, width: 10, left: 10, top: 10 },
                name: 'Kylo Ren'
            }, {
                box: { height: 10, width: 10, left: 101, top: 101 },
                name: 'Leia Organa'
            }, {
                box: { height: 10, width: 10, left: 103, top: 103 },
                name: 'Han Solo'
            }];
        return p;
    }
    static getPhotoEntry4(dir) {
        const p = TestHelper.getPhotoEntry(dir);
        p.metadata.caption = 'Millennium falcon';
        p.metadata.keywords = ['star wars', 'ewoks'];
        p.metadata.positionData.city = 'Tipoca City';
        p.metadata.positionData.state = 'Exegol';
        p.metadata.positionData.country = 'Jedha';
        p.name = 'sw4.jpg';
        p.metadata.positionData.GPSData.latitude = 15;
        p.metadata.positionData.GPSData.longitude = 10;
        p.metadata.creationDate = 1656069387772 - 4000;
        p.metadata.size.height = 3000;
        p.metadata.size.width = 2000;
        p.metadata.faces = [{
                box: { height: 10, width: 10, left: 10, top: 10 },
                name: 'Kylo Ren'
            }, {
                box: { height: 10, width: 10, left: 101, top: 101 },
                name: 'Anakin Skywalker'
            }, {
                box: { height: 10, width: 10, left: 101, top: 101 },
                name: 'Obivan Kenobi'
            }, {
                box: { height: 10, width: 10, left: 201, top: 201 },
                name: 'R2-D2'
            }];
        return p;
    }
    static getRandomizedDirectoryEntry(parent = null, forceStr = null) {
        const dir = {
            id: null,
            name: DiskMangerWorker_1.DiskMangerWorker.dirName(forceStr || Math.random().toString(36).substring(7)),
            path: DiskMangerWorker_1.DiskMangerWorker.pathFromParent({ path: '', name: '.' }),
            mediaCount: 0,
            directories: [],
            metaFile: [],
            preview: null,
            validPreview: false,
            media: [],
            lastModified: Date.now(),
            lastScanned: null,
            parent
        };
        if (parent !== null) {
            dir.path = DiskMangerWorker_1.DiskMangerWorker.pathFromParent(parent);
            parent.directories.push(dir);
        }
        return dir;
    }
    static getRandomizedGPXEntry(dir, forceStr = null) {
        const d = {
            id: null,
            name: forceStr + '_' + Math.random().toString(36).substring(7) + '.gpx',
            directory: dir
        };
        dir.metaFile.push(d);
        return d;
    }
    static getRandomizedFace(media, forceStr = null) {
        const rndStr = () => {
            return forceStr + '_' + Math.random().toString(36).substring(7);
        };
        const rndInt = (max = 5000) => {
            return Math.floor(Math.random() * max);
        };
        const f = {
            name: rndStr() + '.jpg',
            box: {
                left: rndInt(),
                top: rndInt(),
                width: rndInt(),
                height: rndInt()
            }
        };
        media.metadata.faces = (media.metadata.faces || []);
        media.metadata.faces.push(f);
        return f;
    }
    static getRandomizedPhotoEntry(dir, forceStr = null, faces = 2) {
        const rndStr = () => {
            return forceStr + '_' + Math.random().toString(36).substring(7);
        };
        const rndInt = (max = 5000) => {
            return Math.floor(Math.random() * max);
        };
        const sd = {
            height: rndInt(),
            width: rndInt(),
        };
        const gps = {
            latitude: rndInt(1000),
            longitude: rndInt(1000)
        };
        const pd = {
            city: rndStr(),
            country: rndStr(),
            state: rndStr(),
            GPSData: gps
        };
        const cd = {
            ISO: rndInt(500),
            model: rndStr(),
            make: rndStr(),
            fStop: rndInt(10),
            exposure: rndInt(10),
            focalLength: rndInt(10),
            lens: rndStr()
        };
        const m = {
            keywords: [rndStr(), rndStr()],
            cameraData: cd,
            positionData: pd,
            size: sd,
            creationDate: Date.now() + ++TestHelper.creationCounter,
            fileSize: rndInt(10000),
            caption: rndStr(),
            rating: rndInt(5),
        };
        const p = {
            id: null,
            name: rndStr() + '.jpg',
            directory: dir,
            metadata: m
        };
        for (let i = 0; i < faces; i++) {
            this.getRandomizedFace(p, 'Person ' + i);
        }
        dir.media.push(p);
        TestHelper.updatePreview(dir);
        return p;
    }
    static updatePreview(dir) {
        if (dir.media.length > 0) {
            dir.preview = dir.media.sort((a, b) => b.metadata.creationDate - a.metadata.creationDate)[0];
        }
        else {
            const filtered = dir.directories.filter((d) => d.preview).map((d) => d.preview);
            if (filtered.length > 0) {
                dir.preview = filtered.sort((a, b) => b.metadata.creationDate - a.metadata.creationDate)[0];
            }
        }
        if (dir.parent) {
            TestHelper.updatePreview(dir.parent);
        }
    }
}
exports.TestHelper = TestHelper;
//# sourceMappingURL=TestHelper.js.map