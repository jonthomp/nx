import { join } from 'path';
import { ProjectGraph } from '../config/project-graph';
import { TaskGraph } from '../config/task-graph';
import { output } from '../utils/output';
import { existsSync } from 'fs';
import { readFileSync } from 'fs-extra';
import { workspaceRoot } from '../utils/workspace-root';

function _findCycle(
  graph: { dependencies: Record<string, string[]> },
  id: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[id]) return null;
  visited[id] = true;

  for (const d of graph.dependencies[id]) {
    if (path.includes(d)) return [...path, d];
    const cycle = _findCycle(graph, d, visited, [...path, d]);
    if (cycle) return cycle;
  }
  return null;
}

export function findCycle(graph: {
  dependencies: Record<string, string[]>;
}): string[] | null {
  const visited = {};
  for (const t of Object.keys(graph.dependencies)) {
    visited[t] = false;
  }

  for (const t of Object.keys(graph.dependencies)) {
    const cycle = _findCycle(graph, t, visited, [t]);
    if (cycle) return cycle;
  }

  return null;
}

function _makeAcyclic(
  graph: { dependencies: Record<string, string[]> },
  id: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[id]) return;
  visited[id] = true;

  const deps = graph.dependencies[id];
  for (const d of [...deps]) {
    if (path.includes(d)) {
      deps.splice(deps.indexOf(d), 1);
    } else {
      _makeAcyclic(graph, d, visited, [...path, d]);
    }
  }
  return null;
}

export function makeAcyclic(graph: {
  roots: string[];
  dependencies: Record<string, string[]>;
}): void {
  const visited = {};
  for (const t of Object.keys(graph.dependencies)) {
    visited[t] = false;
  }
  for (const t of Object.keys(graph.dependencies)) {
    _makeAcyclic(graph, t, visited, [t]);
  }
  graph.roots = Object.keys(graph.dependencies).filter(
    (t) => graph.dependencies[t].length === 0
  );
}

export function validateAtomizedTasks(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph
): void {
  if (process.env['NX_SKIP_ATOMIZER_VALIDATION']) {
    return;
  }
  const tasksWithAtomizer = Object.values(taskGraph.tasks).filter(
    (task) =>
      projectGraph.nodes[task.target.project]?.data?.targets?.[
        task.target.target
      ]?.metadata?.nonAtomizedTarget !== undefined
  );

  if (tasksWithAtomizer.length > 0 && !isInDTE()) {
    const linkLine =
      'Learn more at https://nx.dev/ci/features/split-e2e-tasks#use-atomizer-only-with-nx-cloud-distribution';
    if (tasksWithAtomizer.length === 1) {
      output.error({
        title: `The ${tasksWithAtomizer[0].id} task uses the atomizer and should only be run with Nx Cloud distribution.`,
        bodyLines: [linkLine],
      });
    } else {
      output.error({
        title: `The following tasks use the atomizer and should only be run with Nx Cloud distribution:`,
        bodyLines: [
          `${tasksWithAtomizer.map((task) => task.id).join(', ')}`,
          linkLine,
        ],
      });
    }
    process.exit(1);
  }
}

function isInDTE(): boolean {
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
