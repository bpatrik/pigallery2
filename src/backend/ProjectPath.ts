import * as path from 'path';
import * as fs from 'fs';
import {PrivateConfigClass} from '../common/config/private/PrivateConfigClass';

export class ProjectPathClass {
  public Root: string;
  public ImageFolder: string;
  public TempFolder: string;
  public TranscodedFolder: string;
  public FacesFolder: string;
  public FrontendFolder: string;
  public ExtensionFolder: string;
  public DBFolder: string;
  private cfg: PrivateConfigClass;

  init(cfg: PrivateConfigClass) {
    this.cfg = cfg;
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

  /**
   * Checks if pathStr (absolute or relative to ImageFolder) stays inside ImageFolder.
   * Pure string check, no disk access.
   */
  public isInsideImageFolder(pathStr: string): boolean {
    const rel = path.relative(this.ImageFolder, path.resolve(this.ImageFolder, pathStr));
    return !(rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel));
  }

  /**
   * Resolves a path from a request (relative to ImageFolder, even with a leading '/') to an absolute path.
   * Returns null if it would point outside of ImageFolder. Pure string check, no disk access.
   * Use it wherever a request path reaches the disk: the check sits next to the use,
   * so it also holds for callers that skip AuthenticationMWs.normalizePathParam (and CodeQL can see it).
   */
  public resolveInImageFolder(relativePath: string): string | null {
    const root = path.resolve(this.ImageFolder);
    const absolute = path.resolve(path.join(root, relativePath || ''));
    if (absolute === root) {
      return root;
    }
    if (!absolute.startsWith(root.endsWith(path.sep) ? root : root + path.sep)) {
      return null;
    }
    return absolute;
  }

  reset(): void {
    this.Root = path.join(__dirname, '/../../');
    this.FrontendFolder = path.join(this.Root, 'dist');
    this.ImageFolder = this.getAbsolutePath(this.cfg.Media.folder);
    this.TempFolder = this.getAbsolutePath(this.cfg.Media.tempFolder);
    this.TranscodedFolder = path.join(this.TempFolder, 'tc');
    this.FacesFolder = path.join(this.TempFolder, 'f');
    this.DBFolder = this.getAbsolutePath(this.cfg.Database.dbFolder);
    this.ExtensionFolder = this.getAbsolutePath(this.cfg.Extensions.folder);

    // create the thumbnail folder if it does not exist
    if (!fs.existsSync(this.TempFolder)) {
      fs.mkdirSync(this.TempFolder);
    }
  }
}

export const ProjectPath = new ProjectPathClass();
