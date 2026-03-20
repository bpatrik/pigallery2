export class FileAlreadyExists extends Error {
  constructor(message: string, public filename: string) {
    super(message);
  }
}
