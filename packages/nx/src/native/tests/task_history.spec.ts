import { NxCache, NxTaskHistory } from '../index';
import { join } from 'path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { rmSync } from 'fs';

describe('NxTaskHistory', () => {
  let taskHistory: NxTaskHistory;
  let tempFs: TempFs;
  let cache: NxCache;

  beforeEach(() => {
    tempFs = new TempFs('task-history');

    rmSync(join(__dirname, 'temp-db'), {
      recursive: true,
      force: true,
    });

    taskHistory = new NxTaskHistory(join(__dirname, 'temp-db'));
    cache = new NxCache(
      tempFs.tempDir,
      join(tempFs.tempDir, '.cache'),
      join(__dirname, 'temp-db')
    );

    // Cache sets up the task details
    cache.get({
      hash: '123',
      project: 'proj',
      target: 'build',
      configuration: 'production',
    });
    cache.get({
      hash: '234',
      project: 'proj',
      target: 'build',
      configuration: 'production',
    });
  });

  it('should record task history', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
    ]);
  });

  it('should query flaky tasks', () => {
    taskHistory.recordTaskRuns([
      {
        hash: '123',
        code: 1,
        status: 'failure',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
      {
        hash: '123',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 30,
        end: Date.now(),
      },
      {
        hash: '234',
        code: 0,
        status: 'success',
        start: Date.now() - 1000 * 60 * 60,
        end: Date.now(),
      },
    ]);
    const r = taskHistory.getFlakyTasks(['123', '234']);
    expect(r).toContain('123');
    expect(r).not.toContain('234');

    const r2 = taskHistory.getFlakyTasks([]);
    expect(r2).not.toContain('123');
    expect(r2).not.toContain('234');
  });
});
