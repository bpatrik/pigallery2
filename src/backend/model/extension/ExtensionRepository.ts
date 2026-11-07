import {Config} from '../../../common/config/private/Config';
import {ExtensionListItem} from '../../../common/entities/extension/ExtensionListItem';

export class ExtensionRepository {

  extensionsList: ExtensionListItem[];
  lastUpdate = 0;
  private UPDATE_FREQUENCY_MS = 30 * 1000;

  public async getExtensionList(): Promise<ExtensionListItem[]> {
    if (this.lastUpdate < Date.now() - this.UPDATE_FREQUENCY_MS) {
      await this.fetchList();
    }

    return this.extensionsList;
  }

  private getUrlFromMDLink(text: string) {
    if (!text) {
      return text;
    }
    text = ('' + text).trim();
    /* Match full links and relative paths */
    // source: https://davidwells.io/snippets/regex-match-markdown-links
    const regex = /^\[.*]\(((?:\/|https?:\/\/)[\S./?=#]+)\)$/;

    const link = text.match(regex)?.[0].match(/https?:\/\/[\S./?=#]+/);
    if (link) {
      return link[0].slice(0, -1);
    }
    return text;
  }

  public repoMD(text: string): ExtensionListItem[] {
    const lines = text.split('\n');
    lines.forEach(line => line.trim());
    const tableStartLine = lines.findIndex(l => l.startsWith('|     **Name**     |'));
    const tableHeaderLines = 2;
    const table = lines.slice(tableStartLine + tableHeaderLines);
    const extensions: ExtensionListItem[] = [];
    const getUniqueID = (name: string) => {
      let id = name;
      let i = 2;
      while (extensions.findIndex(e => e.id === id) !== -1) {
        id = name + '-' + i;
        ++i;
      }
      return id;
    };
    table.forEach(l => {
      const entries = l.split('|').map((l) => l.trim()).filter(e => !!e);
      if (entries.length == 0) {
        return;
      }

      extensions.push({
        id: getUniqueID(entries[0].toLowerCase().replace(/\s+/g, '-')),
        name: entries[0],
        url: this.getUrlFromMDLink(entries[1]),
        readme: this.getUrlFromMDLink(entries[2]),
        zipUrl: this.getUrlFromMDLink(entries[3])
      });
    });
    return extensions;
  }

  public async fetchList(): Promise<ExtensionListItem[]> {
    const res = await (await fetch(Config.Extensions.repositoryUrl)).text();
    this.extensionsList = this.repoMD(res);
    this.lastUpdate = new Date().getTime();
    return this.extensionsList;
  }
}
