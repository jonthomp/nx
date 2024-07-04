import { basename, dirname, join, relative } from 'path';
import { cloneFromUpstream, GitRepository } from '../../utils/git-utils';
import { copyFile, mkdir, rm } from 'fs';
import { promisify } from 'util';
import { tmpdir } from 'tmp';
import { prompt } from 'enquirer';
import { output } from '../../utils/output';
import * as createSpinner from 'ora';
import { detectPlugins, installPlugins } from '../init/init-v2';
import { readNxJson } from '../../config/nx-json';
import { workspaceRoot } from '../../utils/workspace-root';
import { getPackageManagerCommand } from '../../utils/package-manager';

const rmAsync = promisify(rm);
const copyFileAsync = promisify(copyFile);
const mkdirAsync = promisify(mkdir);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ImportOptions {
  /**
   * The remote URL of the repository to import
   */
  sourceRemoteUrl: string;
  /**
   * The branch or reference to import
   */
  ref: string;
  /**
   * The directory in the source repo to import
   */
  source: string;
  /**
   * The directory in the destination repo to import into
   */
  destination: string;

  verbose: boolean;
  interactive: boolean;
}

const importRemoteName = '__tmp_nx_import__';
const tempImportBranch = '__tmp_import_stage__';
const tempFileDir = '__tmp_import_stage__';

async function prepareSourceRepo(
  gitClient: GitRepository,
  ref: string,
  source: string,
  destination: string
) {
  const spinner = createSpinner(
    `Checking out a temporary branch, ${tempImportBranch} based on ${ref}`
  ).start();
  await gitClient.checkout(tempImportBranch, {
    new: true,
    base: `origin/${ref}`,
  });
  spinner.succeed(`Created a ${tempImportBranch} branch based on ${ref}`);
  const relativeSourceDir = relative(
    gitClient.root,
    join(gitClient.root, source)
  );

  const destinationInSource = join(gitClient.root, destination);
  spinner.start(`Moving files and git history to ${destinationInSource}`);
  if (relativeSourceDir === '') {
    const files = await gitClient.getGitFiles('.');
    try {
      await rmAsync(destinationInSource, {
        recursive: true,
      });
    } catch {}
    await mkdirAsync(destinationInSource, { recursive: true });
    const gitignores = new Set<string>();
    for (const file of files) {
      if (basename(file) === '.gitignore') {
        gitignores.add(file);
        continue;
      }

      const newPath = join(destinationInSource, file);

      await mkdirAsync(dirname(newPath), { recursive: true });
      try {
        await gitClient.move(file, newPath);
      } catch {
        await wait(100);
        await gitClient.move(file, newPath);
      }
    }

    await gitClient.commit('chore(repo): prepare for import');

    for (const gitignore of gitignores) {
      await gitClient.move(gitignore, join(destinationInSource, gitignore));
    }
    await gitClient.amendCommit();
    for (const gitignore of gitignores) {
      await copyFileAsync(
        join(destinationInSource, gitignore),
        join(gitClient.root, gitignore)
      );
    }
  } else {
    let needsSquash = false;
    try {
      await rmAsync(destinationInSource, {
        recursive: true,
      });
      await gitClient.commit('chore(repo): prepare for import');
      needsSquash = true;
    } catch {}

    await mkdirAsync(destinationInSource, { recursive: true });

    const files = await gitClient.getGitFiles('.');
    for (const file of files) {
      if (file === '.gitignore') {
        continue;
      }

      if (!relative(source, file).startsWith('..')) {
        const newPath = join(destinationInSource, file);

        await mkdirAsync(dirname(newPath), { recursive: true });
        try {
          await gitClient.move(file, newPath);
        } catch {
          await wait(100);
          await gitClient.move(file, newPath);
        }
      }

      await rmAsync(join(gitClient.root, file), {
        recursive: true,
      });
    }
    await gitClient.commit('chore(repo): prepare for import 2');
    if (needsSquash) {
      await gitClient.squashLastTwoCommits();
    }
  }
  spinner.succeed(`Prepared for import`);
}

async function confirmOrExitWithAnError(message: string) {
  const { confirm } = await prompt<{ confirm: boolean }>([
    {
      type: 'select',
      name: 'confirm',
      choices: ['Yes', 'No'],
      message,
    },
  ]);

  if (confirm === false) {
    throw new Error('Cancelled');
  }
}

async function mergeRemoteSource(
  destinationGitClient: GitRepository,
  sourceRemoteUrl: string,
  branch: string,
  destination: string
) {
  const spinner = createSpinner();
  spinner.start(`Merged ${branch} from ${sourceRemoteUrl} into ${destination}`);

  spinner.start(`Adding ${sourceRemoteUrl} as a remote`);
  await createTemporarySourceRemote(
    destinationGitClient,
    sourceRemoteUrl,
    importRemoteName
  );
  spinner.succeed(`Added ${sourceRemoteUrl} as a remote`);

  spinner.start(
    `Merging files and git history from ${branch} from ${sourceRemoteUrl} into ${destination}`
  );
  await destinationGitClient.mergeUnrelatedHistories(
    `${importRemoteName}/${branch}`,
    `feat(repo): merge ${sourceRemoteUrl}`
  );

  spinner.succeed(
    `Merged files and git history from ${branch} from ${sourceRemoteUrl} into ${destination}`
  );
}

async function createTemporarySourceRemote(
  destinationGitClient: GitRepository,
  sourceRemoteUrl: string,
  remoteName: string
) {
  try {
    await destinationGitClient.deleteGitRemote(remoteName);
  } catch {}
  await destinationGitClient.addGitRemote(remoteName, sourceRemoteUrl);
  await destinationGitClient.fetch(remoteName);
}

export async function importHandler(options: ImportOptions) {
  let { sourceRemoteUrl, ref, source, destination } = options;

  output.log({
    title:
      'Nx will walk you through the process of importing another repository into the workspace:',
    bodyLines: [
      `1. Nx will clone another repository into a temporary directory`,
      `2. Code to be imported will be moved to the same directory it will be imported into`,
      `3. A temporary branch will be pushed to the remote repository`,
      `4. The code will be merged into this workspace`,
      `5. Nx will recommend plugins to integrate tools used in the import code with Nx`,
      '',
      `Git history will be preserved`,
    ],
  });

  const tempRepoPath = join(tmpdir, 'nx-import');

  if (!sourceRemoteUrl) {
    sourceRemoteUrl = (
      await prompt<{ sourceRemoteUrl: string }>([
        {
          type: 'input',
          name: 'sourceRemoteUrl',
          message:
            'What is the Remote URL of the repository you want to import?',
          required: true,
        },
      ])
    ).sourceRemoteUrl;
  }

  const spinner = createSpinner(
    `Cloning ${sourceRemoteUrl} into ${tempRepoPath}`
  ).start();
  try {
    await rmAsync(tempRepoPath, { recursive: true });
  } catch {}
  await mkdirAsync(tempRepoPath, { recursive: true });

  const sourceGitClient = await cloneFromUpstream(
    sourceRemoteUrl,
    join(tempRepoPath, 'repo')
  );
  spinner.succeed(`Cloned into ${tempRepoPath}`);

  if (!ref) {
    const branchChoices = await sourceGitClient.listBranches();
    ref = (
      await prompt<{ ref: string }>([
        {
          type: 'autocomplete',
          name: 'ref',
          message: `Which branch do you want to import?`,
          choices: branchChoices,
          required: true,
        },
      ])
    ).ref;
  }

  await wait(100);

  if (!source) {
    source = (
      await prompt<{ source: string }>([
        {
          type: 'input',
          name: 'source',
          message: `Which directory do you want to import into this workspace? (leave blank to import the entire repository)`,
        },
      ])
    ).source;
  }

  if (!destination) {
    destination = (
      await prompt<{ destination: string }>([
        {
          type: 'input',
          name: 'destination',
          message: 'Where in this workspace should the code be imported into?',
          required: true,
        },
      ])
    ).destination;
  }

  await prepareSourceRepo(sourceGitClient, ref, source, destination);

  console.log(await sourceGitClient.showStat());

  output.log({
    title: `${sourceRemoteUrl} has been prepared to be imported into this repo on a temporary branch: ${tempImportBranch}`,
  });

  await confirmOrExitWithAnError(
    `Push ${tempImportBranch} to ${sourceRemoteUrl} (git push -u -f origin ${tempImportBranch})\nAnd then import it from there into ${destination} in this workspace?`
  );
  await sourceGitClient.push(tempImportBranch);

  // Ready to import
  const destinationGitClient = new GitRepository(process.cwd());
  const mergeSpinner = createSpinner().start(`Importing `);
  await mergeRemoteSource(
    destinationGitClient,
    sourceRemoteUrl,
    tempImportBranch,
    destination
  );
  mergeSpinner.succeed(
    `Imported ${source} from ${sourceRemoteUrl} into ${destination}!`
  );

  const pmc = getPackageManagerCommand();
  const nxJson = readNxJson(workspaceRoot);
  const { plugins, updatePackageScripts } = await detectPlugins(nxJson);

  if (plugins.length > 0) {
    output.log({ title: 'Installing Plugins' });
    installPlugins(workspaceRoot, plugins, pmc, updatePackageScripts);

    await destinationGitClient.amendCommit();
  }

  console.log(await destinationGitClient.showStat());

  output.log({
    title: `Merging these changes`,
    bodyLines: [
      `MERGE these changes when merging`,
      `Do NOT squash and do NOT rebase these changes when merging these changes.`,
      `If you would like to UNDO these changes, run "git reset HEAD~1 --hard"`,
    ],
  });
}
