type MainDateTag = string;                         //The main date tag, where the date is to be found. Typically has both date, time and offset. Except (see SecondaryDateTag and -Type)
type SecondaryDateTag = string | undefined;        //The secondary date tag, which is sometimes needed to get a full date (sometimes contains offset, sometimes the time part of a timestamp)
type SecondaryDateTagType = 'O' | 'T' | undefined; //The secondary date tag type: 'O' for offset, 'T' for time undefined, if there is no secondary tag for the main tag

//Interesting exiftool forums posts about some of these tags:
//https://exiftool.org/forum/index.php?topic=13170.msg71174#msg71174 - about the meaning of exif.DateTimeOriginal, exif.CreateDate/exif.DateTimeDigitized and exif.ModifyDate
//https://exiftool.org/forum/index.php?topic=15555.msg83536#msg83536

//This is the PRIORITIZED LIST of tags which Pigallery2 uses to determine the date of creation of pictures.
//The list is used for embedded picture metadata and xmp-sidecar files for both pictures and vidoes.

export const DateTags: [MainDateTag, SecondaryDateTag, SecondaryDateTagType][] = [
  // Date tag                 Offset or time tag          Type  //Description
  ["exif.DateTimeOriginal",   "exif.OffsetTimeOriginal",  'O'], //Date and time when the original image was taken - shutter close time
  ["exif.CreateDate",         "exif.OffsetTimeDigitized", 'O'], //Date and time when the image was created
  ["exif.DateTimeDigitized",  "exif.OffsetTimeDigitized", 'O'], //Same as exif.CreateDate but older and newer spec name
  ["ifd0.ModifyDate",         undefined, undefined],            //The date and time of image creation. In Exif standard, it is the date and time the file was changed.
  ["ihdr.Creation Time",      undefined, undefined],            //Time of original image creation for PNG files
  ["photoshop.DateCreated",   undefined, undefined],            //The date the intellectual content of the document was created. Used and set by LightRoom among others
  ["xmp.CreateDate",          undefined, undefined],            //Date and time when the image was created (XMP standard)
  ["iptc.DateCreated",        "iptc.TimeCreated",         'T'], //Designates the date and optionally the time the content of the image was created rather than the date of the creation of the digital representation
  ["quicktime.CreationDate",  undefined, undefined],            //Date and time when the QuickTime movie was created"],
  ["quicktime.CreateDate",    undefined, undefined],            //Date and time when the QuickTime movie was created in UTC"],
  ["heic.ContentCreateDate",  undefined, undefined],            //Date and time when the HEIC image content was created"],
  ["heic.CreationDate",       undefined, undefined],            //Date and time when the HEIC image was created"],
  ["tiff.DateTime",           undefined, undefined],            //Date and time of image creation.
  ["exif.ModifyDate",         "exif.OffsetTime",          'O'], //Modification date
  ["xmp.ModifyDate",          undefined, undefined],            //Date and time when the image was last modified (XMP standard)"]
  ["xmp.MetadataDate",        undefined, undefined],            //The date and time that any metadata for this resource was last changed. It should be the same as or more recent than xmp:ModifyDate.
];
