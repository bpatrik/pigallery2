import {TestBed} from '@angular/core/testing';
import {signal} from '@angular/core';
import {Router} from '@angular/router';
import {GalleryMapComponent} from './map.gallery.component';
import {MapService} from './map.service';
import {NetworkService} from '../../../model/network/network.service';
import {QueryService} from '../../../model/query.service';
import {ThemeService} from '../../../model/theme.service';
import {PhotoDTO} from '../../../../../common/entities/PhotoDTO';
import {FileDTO} from '../../../../../common/entities/FileDTO';
import {Config} from '../../../../../common/config/public/Config';

const photo = (name: string, gps?: { latitude: number, longitude: number }): PhotoDTO => ({
  name,
  directory: {path: './', name: 'Vacation'},
  metadata: {
    size: {width: 400, height: 300},
    creationDate: 0,
    positionData: gps ? {GPSData: gps, city: 'Kraków'} : {city: 'Kraków'}
  }
} as unknown as PhotoDTO);

// CUJ 10: the small map of the gallery shows a marker for every photo with GPS
describe('GalleryMapComponent - markers', () => {
  let component: GalleryMapComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<GalleryMapComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {provide: NetworkService, useValue: {}},
        {provide: QueryService, useValue: {getParams: (): Record<string, string> => ({})}},
        {provide: Router, useValue: {navigate: vi.fn()}},
        {provide: ThemeService, useValue: {darkMode: signal(false)}},
      ]
    });
    // only the markers are tested here: no leaflet map (jsdom has no layout)
    TestBed.overrideComponent(GalleryMapComponent, {set: {template: '', imports: []}});
    fixture = TestBed.createComponent(GalleryMapComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('gpxFiles', []);
  });

  afterEach(() => {
    Config.Map.maxPreviewMarkers = 50;
  });

  const markers = (): { lat: number, lng: number }[] => component.markerLayer().map(m => {
    const ll = m.getLatLng();
    return {lat: ll.lat, lng: ll.lng};
  });

  it('should have a marker for each photo with GPS, none for the others', () => {
    fixture.componentRef.setInput('photos', [
      photo('Budapest.jpg', {latitude: 47.4979, longitude: 19.0402}),
      photo('no gps.jpg'),
      photo('東京.jpg', {latitude: 35.6762, longitude: 139.6503}),
    ]);
    expect(markers()).toEqual([{lat: 47.4979, lng: 19.0402}, {lat: 35.6762, lng: 139.6503}]);
  });

  it('should have no marker without GPS', () => {
    fixture.componentRef.setInput('photos', [photo('no gps.jpg'), photo('no gps either.jpg')]);
    expect(markers()).toEqual([]);
  });

  it('should show at most Map.maxPreviewMarkers markers', () => {
    Config.Map.maxPreviewMarkers = 2;
    fixture.componentRef.setInput('photos', [1, 2, 3].map(i => photo(i + '.jpg', {latitude: i, longitude: i})));
    expect(markers().length).toBe(2);
  });

  // #1254: a latitude or longitude of 0 (the equator, the prime meridian) is falsy, but a valid coordinate
  it('should have a marker for a photo on the prime meridian', () => {
    fixture.componentRef.setInput('photos', [photo('Greenwich.jpg', {latitude: 51.4779, longitude: 0})]);
    expect(markers()).toEqual([{lat: 51.4779, lng: 0}]);
  });
});

// CUJ 10: the map shows the GPX tracks of the folder
describe('MapService - GPX', () => {
  let service: MapService;
  let getXML: ReturnType<typeof vi.fn>;

  // accents in the file name and in the GPX texts on purpose: they must survive the URL and the parsing
  const gpxFile = {name: 'árvíztűrő 東京.gpx', directory: {path: './', name: 'Vacation'}} as unknown as FileDTO;
  const gpx = (body: string): Document => new DOMParser().parseFromString(
    '<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">' + body + '</gpx>',
    'application/xml');
  const trkpt = (lat: number, lon: number, time: string): string => `<trkpt lat="${lat}" lon="${lon}"><time>${time}</time></trkpt>`;

  beforeEach(() => {
    getXML = vi.fn();
    TestBed.configureTestingModule({providers: [{provide: NetworkService, useValue: {getXML}}]});
    service = TestBed.inject(MapService);
  });

  it('should read the track, the waypoints and the names of a GPX file with accents', async () => {
    getXML.mockResolvedValue(gpx(
      '<metadata><name>Blue Trail</name><desc>Árvíztűrő tükörfúrógép</desc><author><name>Chloé</name></author></metadata>' +
      '<wpt lat="48.1" lon="20.5"><name>Lookout</name></wpt>' +
      '<trk><name>trk</name><trkseg>' +
      trkpt(48.0, 20.0, '2015-06-12T14:00:00Z') + trkpt(48.01, 20.0, '2015-06-12T14:30:00Z') +
      '</trkseg><trkseg>' +
      trkpt(48.02, 20.0, '2015-06-12T15:00:00Z') + trkpt(48.03, 20.0, '2015-06-12T16:00:00Z') +
      '</trkseg></trk>'));

    const parsed = await service.getMapCoordinates(gpxFile);

    // the file is loaded from its own folder
    expect(getXML).toHaveBeenCalledWith('/gallery/content/Vacation/árvíztűrő 東京.gpx/bestFit');
    expect(parsed.name).toBe('Blue Trail');
    expect(parsed.description).toBe('Árvíztűrő tükörfúrógép');
    expect(parsed.author).toBe('Chloé');
    // one path per track segment
    expect(parsed.path.map(p => p.map(ll => [ll.lat, ll.lng]))).toEqual([[[48.0, 20.0], [48.01, 20.0]], [[48.02, 20.0], [48.03, 20.0]]]);
    expect(parsed.markers.map(ll => [ll.lat, ll.lng])).toEqual([[48.1, 20.5]]);
    // ~3.3 km in two hours
    expect(parsed.stats!.distance).toBeGreaterThan(3000);
    expect(parsed.stats!.distance).toBeLessThan(3500);
    expect(parsed.stats!.duration).toBe(2 * 60 * 60);
  });

  it('should take the name of the track without metadata', async () => {
    getXML.mockResolvedValue(gpx('<trk><name>Hiking 6/12/15</name><trkseg>' + trkpt(37.7, -119.5, '2015-06-12T14:27:25Z') + '</trkseg></trk>'));
    expect((await service.getMapCoordinates(gpxFile)).name).toBe('Hiking 6/12/15');
  });

  // #1254: a track shorter than ~17 minutes once had no duration and no speed (seconds were compared with 1000)
  it('should have the duration and the speed of a short track', async () => {
    getXML.mockResolvedValue(gpx('<trk><trkseg>' +
      trkpt(48.0, 20.0, '2015-06-12T14:00:00Z') + trkpt(48.01, 20.0, '2015-06-12T14:10:00Z') +
      '</trkseg></trk>'));
    const stats = (await service.getMapCoordinates(gpxFile)).stats!;
    expect(stats.duration).toBe(10 * 60);
    expect(stats.averageSpeed).toBeGreaterThan(6);
  });
});
