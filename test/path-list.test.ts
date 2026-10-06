import { describe, expect, it } from 'vitest';
import { addToPathList, pathListHas, removeFromPathList } from '../src/core/utils/path-list';

const WIN = { separator: ';', caseInsensitive: true };
const UNIX = { separator: ':', caseInsensitive: false };

describe('PATH list editing', () => {
  it('appends once, matching case-insensitively with trailing slashes on Windows', () => {
    const list = '%USERPROFILE%\\bin;C:\\Tools\\';
    const added = addToPathList(list, 'C:\\Users\\me\\AppData\\Local\\Lanyard\\bin', WIN);
    expect(added).toBe('%USERPROFILE%\\bin;C:\\Tools\\;C:\\Users\\me\\AppData\\Local\\Lanyard\\bin');
    expect(addToPathList(added, 'c:\\users\\ME\\appdata\\local\\lanyard\\bin\\', WIN)).toBe(added);
    expect(pathListHas(added, '"C:\\Users\\me\\AppData\\Local\\Lanyard\\bin"', WIN)).toBe(true);
  });

  it('removes only the target entry and keeps the rest verbatim', () => {
    const list = 'C:\\A;C:\\Lanyard\\bin;%SystemRoot%;c:\\lanyard\\BIN\\';
    expect(removeFromPathList(list, 'C:\\Lanyard\\bin', WIN)).toBe('C:\\A;%SystemRoot%');
  });

  it('is case-sensitive with ":" elsewhere and tolerates empty lists', () => {
    expect(addToPathList('', '/home/me/.local/bin', UNIX)).toBe('/home/me/.local/bin');
    expect(pathListHas('/usr/bin:/HOME/me/.local/bin', '/home/me/.local/bin', UNIX)).toBe(false);
    expect(removeFromPathList('/usr/bin::/home/me/.local/bin/', '/home/me/.local/bin', UNIX)).toBe('/usr/bin');
  });
});
