import * as fs from 'node:fs';
import * as path from 'node:path';
import * as child_process from 'node:child_process';
import {Config} from '../../common/config/private/Config';
import {ProjectPath} from '../ProjectPath';
import {BuildInfoDTO} from '../../common/entities/ReleaseNotesDTO';

export class BuildInfo {
  public static readonly ReleaseNotesFile = 'RELEASE_NOTES.md';
  // undefined: not looked up yet
  private static gitCommit: string | null | undefined;

  /**
   * Only for admins (see BuildInfoDTO).
   */
  public static get(): BuildInfoDTO {
    return {
      appVersion: Config.Environment.appVersion ?? null,
      buildTime: Config.Environment.buildTime ?? null,
      buildCommitHash: Config.Environment.buildCommitHash || BuildInfo.getGitCommit(),
      upTime: Config.Environment.upTime ?? null,
      isDocker: !!Config.Environment.isDocker,
      nodeVersion: process.version,
      platform: process.platform + '/' + process.arch,
    };
  }

  /**
   * The release package has the commit in its package.json (see gulpfile.ts);
   * a git checkout (development, installs from source) asks git, once.
   */
  private static getGitCommit(): string | null {
    if (BuildInfo.gitCommit !== undefined) {
      return BuildInfo.gitCommit;
    }
    BuildInfo.gitCommit = null;
    // only the app's own checkout, not a repository that happens to contain the app folder
    if (fs.existsSync(path.join(ProjectPath.Root, '.git'))) {
      try {
        BuildInfo.gitCommit = child_process.execFileSync('git', ['rev-parse', 'HEAD'],
          {cwd: ProjectPath.Root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000})
          .toString().trim() || null;
      } catch {
        // no git installed
      }
    }
    return BuildInfo.gitCommit;
  }

  /**
   * The release notes of the running version, null if there are none.
   * Read on every call: only admins ask for it, about once per page load.
   */
  public static async loadReleaseNotes(): Promise<string | null> {
    try {
      const notes = await fs.promises.readFile(path.join(ProjectPath.Root, BuildInfo.ReleaseNotesFile), 'utf-8');
      return notes.trim() ? notes : null;
    } catch {
      return null;
    }
  }
}
