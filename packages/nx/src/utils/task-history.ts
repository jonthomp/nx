import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { workspaceDataDirectory } from './cache-directory';
import { NxTaskHistory, TaskRun } from '../native';

export class TaskHistory {
  taskHistory = new NxTaskHistory(workspaceDataDirectory);

  async getFlakyTasks(hashes: string[]) {
    if (isOnDaemon() || !daemonClient.enabled()) {
      return this.taskHistory.getFlakyTasks(hashes);
    }
    return await daemonClient.getFlakyTasks(hashes);
  }

  async recordTaskRuns(taskRuns: TaskRun[]) {
    if (isOnDaemon() || !daemonClient.enabled()) {
      return this.taskHistory.recordTaskRuns(taskRuns);
    }
    return daemonClient.recordTaskRuns(taskRuns);
  }
}
