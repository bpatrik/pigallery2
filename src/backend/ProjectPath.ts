import * as path from 'path';
import * as fs from 'fs';
import {Config} from '../common/config/private/Config';

class ProjectPathClass {
  public Root: string;
  public ImageFolder: string;
  public TempFolder: string;
  public TranscodedFolder: string;
  public FacesFolder: string;
  public FrontendFolder: string;
  public DBFolder: string;

  constructor() {
    this.reset();
  }

  normalizeRelative(pathStr: string): string {
    return path.join(pathStr, path.sep);
  }

  getAbsolutePath(pathStr: string): string {
    return path.isAbsolute(pathStr) ? pathStr : path.join(this.Root, pathStr);
  }

  getRelativePathToImages(pathStr: string): string {
    return path.relative(this.ImageFolder, pathStr);
  }

  reset(): void {
    this.Root = path.join(__dirname, '/../../');
    this.FrontendFolder = path.join(this.Root, 'dist');
    this.ImageFolder = this.getAbsolutePath(Config.Media.folder);
    this.TempFolder = this.getAbsolutePath(Config.Media.tempFolder);
    this.TranscodedFolder = path.join(this.TempFolder, 'tc');
    this.FacesFolder = path.join(this.TempFolder, 'f');
    this.DBFolder = this.getAbsolutePath(Config.Database.dbFolder);

    // create thumbnail folder if not exist
    if (!fs.existsSync(this.TempFolder)) {
      fs.mkdirSync(this.TempFolder);
    }
  }
}

export const ProjectPath = new ProjectPathClass();
