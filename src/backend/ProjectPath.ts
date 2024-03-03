import * as path from 'path';
import * as fs from 'fs';
import {Config} from '../common/config/private/Config';

export class ProjectPathClass {
  public Root: string;
  public ImageFolder: string;
  public TempFolder: string;
  public TranscodedFolder: string;
  public FacesFolder: string;
  public FrontendFolder: string;
  public ExtensionFolder: string;
  public DBFolder: string;

  constructor() {
    this.reset();
  }

  public normalizeRelative(pathStr: string): string {
    return path.join(pathStr, path.sep);
  }

  public getAbsolutePath(pathStr: string): string {
    return path.isAbsolute(pathStr) ? pathStr : path.join(this.Root, pathStr);
  }

  public getRelativePathToImages(pathStr: string): string {
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
    this.ExtensionFolder = this.getAbsolutePath(Config.Extensions.folder);

    // create thumbnail folder if not exist
    if (!fs.existsSync(this.TempFolder)) {
      fs.mkdirSync(this.TempFolder);
    }
  }
}

export const ProjectPath = new ProjectPathClass();
