import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  removeDependenciesFromPackageJson,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { assertNotUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { nxVersion } from '../../utils/versions';
import { Schema } from './schema';

function updateDependencies(tree: Tree, options: Schema) {
  const tasks: GeneratorCallback[] = [];
  tasks.push(removeDependenciesFromPackageJson(tree, ['@nx/node'], []));
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { '@nx/node': nxVersion },
      undefined,
      options.keepExistingVersions
    )
  );

  return runTasksInSerial(...tasks);
}

export async function initGenerator(tree: Tree, options: Schema) {
  assertNotUsingTsSolutionSetup(tree, 'node', 'init');

  let installTask: GeneratorCallback = () => {};
  if (!options.skipPackageJson) {
    installTask = updateDependencies(tree, options);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

export default initGenerator;
