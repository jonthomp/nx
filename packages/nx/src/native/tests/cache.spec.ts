import { NxCache } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';

describe('Cache', () => {
  let cache: NxCache;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('cache');

    rmSync(join(__dirname, 'temp-db'), {
      recursive: true,
      force: true,
    });

    cache = new NxCache(
      tempFs.tempDir,
      join(tempFs.tempDir, '.cache'),
      join(__dirname, 'temp-db')
    );
  });

  it('should store results into cache', async () => {
    const result = cache.get({
      hash: '123',
      project: 'proj',
      target: 'build',
      configuration: 'production',
    });

    expect(result).toBeNull();

    tempFs.createFileSync('dist/output.txt', 'output contents 123');

    cache.put('123', 'output 123', ['dist'], 0);

    tempFs.removeFileSync('dist/output.txt');

    const result2 = cache.get({
      hash: '123',
      project: 'proj',
      target: 'build',
      configuration: 'production',
    });
    cache.copyFilesFromCache(result2, ['dist']);

    expect(result2.code).toEqual(0);
    expect(result2.terminalOutput).toEqual('output 123');

    expect(await tempFs.readFile('dist/output.txt')).toEqual(
      'output contents 123'
    );
  });
});
