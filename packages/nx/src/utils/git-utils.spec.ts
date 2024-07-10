import { extractUserAndRepoFromGitHubUrl, updateRebaseFile } from './git-utils';

describe('git utils', () => {
  describe('extractUserAndRepoFromGitHubUrl', () => {
    describe('ssh cases', () => {
      it('should return the github user + repo info for origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	git@github.com:upstream-user/repo-name.git (fetch)
          upstream	git@github.com:upstream-user/repo-name.git (push)
          origin	git@github.com:origin-user/repo-name.git (fetch)
          origin	git@github.com:origin-user/repo-name.git (push)
        `
          )
        ).toBe('origin-user/repo-name');
      });

      it('should return the github user + repo info for the first one since no origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	git@github.com:upstream-user/repo-name.git (fetch)
          upstream	git@github.com:upstream-user/repo-name.git (push)
          other	git@github.com:other-user/repo-name.git (fetch)
          other	git@github.com:other-user/repo-name.git (push)
        `
          )
        ).toBe('upstream-user/repo-name');
      });

      it('should return null since no github', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	git@random.com:upstream-user/repo-name.git (fetch)
          upstream	git@random.com:upstream-user/repo-name.git (push)
          origin	git@random.com:other-user/repo-name.git (fetch)
          origin	git@random.com:other-user/repo-name.git (push)
        `
          )
        ).toBe(null);
      });
    });
    describe('https cases', () => {
      it('should return the github user + repo info for origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	https://github.com/upstream-user/repo-name.git (fetch)
          upstream	https://github.com/upstream-user/repo-name.git (push)
          origin	https://github.com/origin-user/repo-name.git (fetch)
          origin	https://github.com/origin-user/repo-name.git (push)
        `
          )
        ).toBe('origin-user/repo-name');
      });

      it('should return the github user + repo info for the first one since no origin', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	https://github.com/upstream-user/repo-name.git (fetch)
          upstream	https://github.com/upstream-user/repo-name.git (push)
          other	https://github.com/other-user/repo-name.git (fetch)
          other	https://github.com/other-user/repo-name.git (push)
        `
          )
        ).toBe('upstream-user/repo-name');
      });

      it('should return null since no github', () => {
        expect(
          extractUserAndRepoFromGitHubUrl(
            `
          upstream	https://other.com/upstream-user/repo-name.git (fetch)
          upstream	https://other.com/upstream-user/repo-name.git (push)
          origin	https://other.com/other-user/repo-name.git (fetch)
          origin	https://other.com/other-user/repo-name.git (push)
        `
          )
        ).toBe(null);
      });
    });
  });

  describe('updateRebaseFile', () => {
    let rebaseFileContents;

    beforeEach(() => {
      rebaseFileContents = `pick 6a642190 chore(repo): hi
pick 022528d9 chore(repo): prepare for import
pick 84ef7741 feat(repo): complete import of git@github.com:FrozenPandaz/created-vite-app.git

# Rebase 3441f39e..84ef7741 onto 3441f39e (3 commands)
#
# Commands:
# p, pick <commit> = use commit
# r, reword <commit> = use commit, but edit the commit message
# e, edit <commit> = use commit, but stop for amending
# s, squash <commit> = use commit, but meld into previous commit
# f, fixup [-C | -c] <commit> = like "squash" but keep only the previous
#                    commit's log message, unless -C is used, in which case
#                    keep only this commit's message; -c is same as -C but
#                    opens the editor
# x, exec <command> = run command (the rest of the line) using shell
# b, break = stop here (continue rebase later with 'git rebase --continue')
# d, drop <commit> = remove commit
# l, label <label> = label current HEAD with a name
# t, reset <label> = reset HEAD to a label
# m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
#         create a merge commit using the original merge commit's
#         message (or the oneline, if no original merge commit was
#         specified); use -c <commit> to reword the commit message
# u, update-ref <ref> = track a placeholder for the <ref> to be updated
#                       to this position in the new commits. The <ref> is
#                       updated at the end of the rebase
#
# These lines can be re-ordered; they are executed from top to bottom.
#
# If you remove a line here THAT COMMIT WILL BE LOST.
#
# However, if you remove everything, the rebase will be aborted.`;
    });
    it('should squash the last 2 commits', () => {
      expect(updateRebaseFile(rebaseFileContents)).toMatchSnapshot();
    });
  });
});
