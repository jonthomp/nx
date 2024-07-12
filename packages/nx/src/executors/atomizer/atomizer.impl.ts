import { join } from 'path';
import { ExecutorContext } from '../../config/misc-interfaces';
import { existsSync, readFileSync } from 'fs';
import { output } from '../../utils/output';
import { serializeTarget } from '../../utils/serialize-target';

export default async function (_: any, context: ExecutorContext) {
  if (isInDTE(context.root)) {
    return { success: true };
  } else {
    output.error({
      title: `The ${serializeTarget(
        context.projectName,
        context.targetName,
        context.configurationName
      )} task uses the atomizer and should only be run with Nx Cloud distribution.`,
      bodyLines: [
        'Learn more at https://nx.dev/ci/features/split-e2e-tasks#use-atomizer-only-with-nx-cloud-distribution',
      ],
    });
    return { success: false };
  }
}

function isInDTE(workspaceRoot: string): boolean {
  if (
    process.env['NX_CLOUD_DISTRIBUTED_EXECUTION_ID'] ||
    process.env['NX_AGENT_NAME']
  ) {
    return true;
  }

  // checks for DTE marker file - needed so we can check for DTE on the main nx job
  const nxCacheDirectory = process.env.NX_CACHE_DIRECTORY
    ? [process.env['NX_CACHE_DIRECTORY']]
    : ['node_modules', '.cache', 'nx'];
  const dir = join(workspaceRoot, ...nxCacheDirectory);
  const dteMarker = join(dir, 'NX_CLOUD_DISTRIBUTED_EXECUTION');

  if (existsSync(dteMarker) && readFileSync(dteMarker, 'utf-8') === 'true') {
    return true;
  }

  return false;
}
