import { exec, ExecOptions, execSync } from 'child_process';
import { dirname, join, posix, sep } from 'path';
import { logger } from './logger';

function execAsync(command: string, execOptions: ExecOptions) {
  return new Promise<string>((res, rej) => {
    exec(command, execOptions, (err, stdout, stderr) => {
      if (err) {
        return rej(err);
      }
      res(stdout);
    });
  });
}

export async function cloneFromUpstream(
  url: string,
  destination: string,
  { originName, depth }: { originName: string; depth?: number } = {
    originName: 'origin',
  }
) {
  await execAsync(
    `git clone ${url} ${destination} ${
      depth ? `--depth ${depth}` : ''
    } --origin ${originName}`,
    {
      cwd: dirname(destination),
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  return new GitRepository(destination);
}

export class GitRepository {
  public root = this.getGitRootPath(this.directory);
  constructor(private directory: string) {}

  getGitRootPath(cwd: string) {
    return execSync('git rev-parse --show-toplevel', {
      cwd,
      windowsHide: false,
    })
      .toString()
      .trim();
  }

  async hasUncommittedChanges() {
    const data = await this.execAsync(`git status --porcelain`);
    return data.trim() !== '';
  }

  async addFetchRemote(remoteName: string, branch: string) {
    return await this.execAsync(
      `git config --add remote.${remoteName}.fetch "+refs/heads/${branch}:refs/remotes/${remoteName}/${branch}"`
    );
  }

  async showStat() {
    return await this.execAsync(`git show --stat`);
  }

  async listBranches() {
    return (await this.execAsync(`git ls-remote --heads --quiet`))
      .trim()
      .split('\n')
      .map((s) =>
        s
          .trim()
          .substring(s.indexOf('\t') + 1)
          .replace('refs/heads/', '')
      );
  }

  async getGitFiles(path: string) {
    // Use -z to return file names exactly as they are stored in git, separated by NULL (\x00) character.
    // This avoids problems with special characters in file names.
    return (await this.execAsync(`git ls-files -z ${path}`))
      .trim()
      .split('\x00')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async reset(ref: string) {
    return await this.execAsync(`git reset ${ref} --hard`);
  }

  async mergeUnrelatedHistories(ref: string, message: string) {
    return await this.execAsync(
      `git merge ${ref} -X ours --allow-unrelated-histories -m "${message}"`
    );
  }
  async fetch(remote: string, ref?: string) {
    return await this.execAsync(`git fetch ${remote}${ref ? ` ${ref}` : ''}`);
  }

  async checkout(
    branch: string,
    opts: {
      new: boolean;
      base: string;
    }
  ) {
    return await this.execAsync(
      `git checkout ${opts.new ? '-b ' : ' '}${branch}${
        opts.base ? ' ' + opts.base : ''
      }`
    );
  }

  async move(path: string, destination: string) {
    return await this.execAsync(
      `git mv ${this.quotePath(path)} ${this.quotePath(destination)}`
    );
  }

  async push(ref: string, remoteName: string) {
    return await this.execAsync(`git push -u -f ${remoteName} ${ref}`);
  }

  async commit(message: string) {
    return await this.execAsync(`git commit -am "${message}"`);
  }
  async amendCommit() {
    return await this.execAsync(`git commit --amend -a --no-edit`);
  }

  async deleteGitRemote(name: string) {
    return await this.execAsync(`git remote rm ${name}`);
  }

  async addGitRemote(name: string, url: string) {
    return await this.execAsync(`git remote add ${name} ${url}`);
  }

  async hasFilterRepoInstalled() {
    try {
      await this.execAsync(`git filter-repo --help`);
      return true;
    } catch {
      return false;
    }
  }

  // git-filter-repo is much faster than filter-branch, but needs to be installed by user
  // Use `hasFilterRepoInstalled` to check if it's installed
  async filterRepo(source: string, destination: string) {
    // NOTE: filter-repo requires POSIX path to work
    const sourcePosixPath = source.split(sep).join(posix.sep);
    const destinationPosixPath = destination.split(sep).join(posix.sep);
    await this.execAsync(
      `git filter-repo -f ${
        source !== '' ? `--path ${this.quotePath(sourcePosixPath)}` : ''
      } ${
        source !== destination
          ? `--path-rename ${this.quotePath(
              sourcePosixPath,
              true
            )}:${this.quotePath(destinationPosixPath, true)}`
          : ''
      }`
    );
  }

  async filterBranch(source: string, destination: string, branchName: string) {
    // We need non-ASCII file names to not be quoted, or else filter-branch will exclude them.
    await this.execAsync(`git config core.quotepath false`);
    // NOTE: filter-repo requires POSIX path to work
    const sourcePosixPath = source.split(sep).join(posix.sep);
    const destinationPosixPath = destination.split(sep).join(posix.sep);
    // First, if the source is not a root project, then only include commits relevant to the subdirectory.
    if (source !== '') {
      const indexFilterCommand = this.quoteArg(
        `node ${join(__dirname, 'git-utils.index-filter.js')}`
      );
      await this.execAsync(
        `git filter-branch -f --index-filter ${indexFilterCommand} --prune-empty -- ${branchName}`,
        {
          NX_IMPORT_SOURCE: sourcePosixPath,
          NX_IMPORT_DESTINATION: destinationPosixPath,
        }
      );
    }
    // Then, move files to their new location if necessary.
    if (source === '' || source !== destination) {
      const treeFilterCommand = this.quoteArg(
        `node ${join(__dirname, 'git-utils.tree-filter.js')}`
      );
      await this.execAsync(
        `git filter-branch -f --tree-filter ${treeFilterCommand} -- ${branchName}`,
        {
          NX_IMPORT_SOURCE: sourcePosixPath,
          NX_IMPORT_DESTINATION: destinationPosixPath,
        }
      );
    }
  }

  private execAsync(command: string, env?: Record<string, string>) {
    return execAsync(command, {
      cwd: this.root,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        ...env,
      },
    });
  }

  private quotePath(path: string, ensureTrailingSlash?: true) {
    return this.quoteArg(
      ensureTrailingSlash && path !== '' && !path.endsWith('/')
        ? `${path}/`
        : path
    );
  }

  private quoteArg(arg: string) {
    return process.platform === 'win32'
      ? // Windows/CMD only understands double-quotes, single-quotes are treated as part of the file name
        // Bash and other shells will substitute `$` in file names with a variable value.
        `"${arg
          // Need to keep two slashes for Windows or else the path will be invalid.
          // e.g. 'C:\Users\bob\projects\repo' is invalid, but 'C:\\Users\\bob\\projects\\repo' is valid
          .replaceAll('\\', '\\\\')}"`
      : // e.g. `git mv "$$file.txt" "libs/a/$$file.txt"` will not work since `$$` is swapped with the PID of the last process.
        // Using single-quotes prevents this substitution.
        `'${arg}'`;
  }
}

export interface VcsRemoteInfo {
  domain: string;
  slug: string;
}

export function parseVcsRemoteUrl(url: string): VcsRemoteInfo | null {
  // Remove whitespace and handle common URL formats
  const cleanUrl = url.trim();

  // SSH format: git@domain:owner/repo.git
  const sshMatch = cleanUrl.match(/^git@([^:]+):([^\/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    const [, domain, owner, repo] = sshMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  // HTTPS with authentication: https://user@domain/owner/repo.git
  const httpsAuthMatch = cleanUrl.match(
    /^https?:\/\/[^@]+@([^\/]+)\/([^\/]+)\/(.+?)(\.git)?$/
  );
  if (httpsAuthMatch) {
    const [, domain, owner, repo] = httpsAuthMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  // HTTPS format: https://domain/owner/repo.git (without authentication)
  const httpsMatch = cleanUrl.match(
    /^https?:\/\/([^@\/]+)\/([^\/]+)\/(.+?)(\.git)?$/
  );
  if (httpsMatch) {
    const [, domain, owner, repo] = httpsMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  // SSH alternative format: ssh://git@domain/owner/repo.git or ssh://git@domain:port/owner/repo.git
  const sshAltMatch = cleanUrl.match(
    /^ssh:\/\/[^@]+@([^:\/]+)(:[0-9]+)?\/([^\/]+)\/(.+?)(\.git)?$/
  );
  if (sshAltMatch) {
    const [, domain, , owner, repo] = sshAltMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  return null;
}

export function getVcsRemoteInfo(): VcsRemoteInfo | null {
  try {
    const gitRemote = execSync('git remote -v', {
      stdio: 'pipe',
      windowsHide: false,
    })
      .toString()
      .trim();

    if (!gitRemote || gitRemote.length === 0) {
      return null;
    }

    const lines = gitRemote.split('\n').filter((line) => line.trim());
    const remotesPriority = ['origin', 'upstream', 'base'];
    const foundRemotes: { [key: string]: VcsRemoteInfo } = {};
    let firstRemote: VcsRemoteInfo | null = null;

    for (const line of lines) {
      const match = line.trim().match(/^(\w+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (match) {
        const [, remoteName, url] = match;
        const remoteInfo = parseVcsRemoteUrl(url);

        if (remoteInfo && !foundRemotes[remoteName]) {
          foundRemotes[remoteName] = remoteInfo;

          if (!firstRemote) {
            firstRemote = remoteInfo;
          }
        }
      }
    }

    // Return high-priority remote if found
    for (const remote of remotesPriority) {
      if (foundRemotes[remote]) {
        return foundRemotes[remote];
      }
    }

    // Return first found remote
    return firstRemote;
  } catch (e) {
    return null;
  }
}

export function commitChanges(
  commitMessage: string,
  directory?: string
): string | null {
  try {
    execSync('git add -A', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: directory,
    });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
      cwd: directory,
      windowsHide: false,
    });
  } catch (err) {
    if (directory) {
      // We don't want to throw during create-nx-workspace
      // because maybe there was an error when setting up git
      // initially.
      logger.verbose(`Git may not be set up correctly for this new workspace.
        ${err}`);
    } else {
      throw new Error(`Error committing changes:\n${err.stderr}`);
    }
  }

  return getLatestCommitSha(directory);
}

export function getLatestCommitSha(directory?: string): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: false,
      cwd: directory,
    }).trim();
  } catch {
    return null;
  }
}
