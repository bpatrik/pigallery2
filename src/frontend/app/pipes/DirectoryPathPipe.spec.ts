import {DirectoryPathPipe} from './DirectoryPathPipe';

describe('DirectoryPathPipe', () => {
  const pipe = new DirectoryPathPipe();

  it('should join the path and the name of the directory', () => {
    expect(pipe.transform({path: 'Nyaralás/Balaton', name: 'Őszi kirándulás'})).toBe('Nyaralás/Balaton/Őszi kirándulás');
    expect(pipe.transform({path: './', name: 'Árvíztűrő'})).toBe('Árvíztűrő');
  });
});
