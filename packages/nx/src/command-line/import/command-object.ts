import { Arguments, CommandModule, MiddlewareFunction } from 'yargs';
import { linkToNxDevAndExamples } from '../yargs-utils/documentation';
import { withVerbose } from '../yargs-utils/shared-options';
import { handleErrors } from '../../utils/params';
import type { ImportOptions } from './import';

export const yargsImportCommand: CommandModule = {
  command: 'import [sourceRemoteUrl] [destination]',
  describe: false,
  builder: (yargs) =>
    linkToNxDevAndExamples(
      withVerbose(
        yargs
          .positional('sourceRemoteUrl', {
            type: 'string',
            description: 'The remote URL of the source to import',
          })
          .positional('destination', {
            type: 'string',
            description: 'The destination in the current workspace',
          })
          .option('ref', {
            type: 'string',
            description: 'The branch to import',
          })
      ),
      'import'
    ),
  handler: async (args) => {
    const exitCode = await handleErrors(
      (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
      async () => {
        return (await import('./import')).importHandler(args as any);
      }
    );
    process.exit(exitCode);
  },
};
