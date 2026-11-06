import {IExtensionDB} from './IExtension';
import {SQLConnection} from '../database/SQLConnection';
import {Connection} from 'typeorm';
import {ILogger} from '../../Logger';

export class ExtensionDB implements IExtensionDB {

  constructor(private readonly extLogger: ILogger) {
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  _getAllTables(): Function[] {
    return SQLConnection.getEntries();
  }

  getSQLConnection(): Promise<Connection> {
    return SQLConnection.getConnection();
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  async setExtensionTables(tables: Function[]): Promise<void> {
    this.extLogger.debug('Adding ' + tables?.length + ' extension tables to DB');
    await SQLConnection.addEntries(tables);
  }

}
