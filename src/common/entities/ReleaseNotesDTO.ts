/**
 * The running build. Only admins get it: the version tells which known bugs a server has.
 */
export interface BuildInfoDTO {
  appVersion: string | null;
  buildTime: string | null;
  buildCommitHash: string | null;
  // when the server started (ISO date)
  upTime: string | null;
  isDocker: boolean;
  nodeVersion: string;
  // e.g.: linux/arm64
  platform: string;
}

export interface ReleaseNotesDTO {
  build: BuildInfoDTO;
  // RELEASE_NOTES.md (markdown) of the running version; null if the release has none
  notes: string | null;
  // the version whose release notes the admin confirmed last
  seenVersion: string | null;
}
