import '../../internal-testing-utils/mock-fs';

import { vol } from 'memfs';
import { ExecutorContext } from '../../config/misc-interfaces';
import atomize from './atomizer.impl';
import * as fs from 'fs';
import { join } from 'path';

const context = {
  root: '/root',
  projectName: 'proj',
  targetName: 'e2e-ci',
} as ExecutorContext;

describe('nx:atomizer', () => {
  let mockProcessExit: jest.SpyInstance;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    env = process.env;
    process.env = {};

    jest.mock('fs');
  });

  afterEach(() => {
    process.env = env;
    vol.reset();
  });

  it('should fail if atomized task is present but no DTE', async () => {
    const result = await atomize({}, context);
    expect(result).toEqual(expect.objectContaining({ success: false }));
  });

  it('should do nothing if atomized task is present in Nx Agents', async () => {
    process.env['NX_AGENT_NAME'] = '123';
    const result = await atomize({}, context);
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('should do nothing if atomized task is present in DTE', async () => {
    process.env['NX_CLOUD_DISTRIBUTED_EXECUTION_ID'] = '123';
    const result = await atomize({}, context);
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('should do nothing if atomized task is present and dte marker file exists', async () => {
    vol.fromJSON(
      {
        'node_modules/.cache/nx/NX_CLOUD_DISTRIBUTED_EXECUTION': 'true',
      },
      context.root
    );

    const result = await atomize({}, context);
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });

  it('should do nothing if atomized task is present and dte marker file exists in NX_CACHE_DIRECTORY', async () => {
    const cacheDirectory = join('node_modules', 'my-cache-dir');
    process.env['NX_CACHE_DIRECTORY'] = cacheDirectory;

    vol.fromJSON(
      {
        'node_modules/my-cache-dir/NX_CLOUD_DISTRIBUTED_EXECUTION': 'true',
      },
      context.root
    );

    const result = await atomize({}, context);
    expect(result).toEqual(expect.objectContaining({ success: true }));
  });
});
