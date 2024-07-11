import {
  findCycle,
  makeAcyclic,
  validateAtomizedTasks,
} from './task-graph-utils';

describe('task graph utils', () => {
  describe('findCycles', () => {
    it('should return a cycle if it is there', () => {
      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q', 'a'],
            q: [],
          },
        } as any)
      ).toEqual(['a', 'c', 'e', 'a']);
    });

    it('should return null when no cycle', () => {
      expect(
        findCycle({
          dependencies: {
            a: ['b', 'c'],
            b: ['d'],
            c: ['e'],
            d: [],
            e: ['q'],
            q: [],
          },
        } as any)
      ).toEqual(null);
    });
  });

  describe('makeAcyclic', () => {
    it('should remove cycles when they are there', () => {
      const graph = {
        roots: ['d'],
        dependencies: {
          a: ['b', 'c'],
          b: ['d'],
          c: ['e'],
          d: [],
          e: ['a'],
        },
      } as any;
      makeAcyclic(graph);

      expect(graph.dependencies).toEqual({
        a: ['b', 'c'],
        b: ['d'],
        c: ['e'],
        d: [],
        e: [],
      });
      expect(graph.roots).toEqual(['d', 'e']);
    });
  });

  describe('validateAtomizedTasks', () => {
    let mockProcessExit: jest.SpyInstance;
    let env: NodeJS.ProcessEnv;

    beforeEach(() => {
      env = process.env;
      process.env = {};

      mockProcessExit = jest
        .spyOn(process, 'exit')
        .mockImplementation((code: number) => {
          return undefined as any as never;
        });
    });

    afterEach(() => {
      process.env = env;

      mockProcessExit.mockRestore();
    });

    it('should do nothing if no tasks are atomized', () => {
      const taskGraph = {
        tasks: {
          'e2e:e2e': {
            target: {
              project: 'e2e',
              target: 'e2e',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                e2e: {},
              },
            },
          },
        },
      };
      validateAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).not.toHaveBeenCalled();
    });
    it('should exit if atomized task is present but no DTE', () => {
      const taskGraph = {
        tasks: {
          'e2e:e2e-ci': {
            target: {
              project: 'e2e',
              target: 'e2e-ci',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                'e2e-ci': {
                  metadata: {
                    nonAtomizedTarget: 'e2e',
                  },
                },
              },
            },
          },
        },
      };
      validateAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
    it('should do nothing if atomized task is present in DTE', () => {
      process.env['NX_CLOUD_DISTRIBUTED_EXECUTION_ID'] = '123';
      const taskGraph = {
        tasks: {
          'e2e:e2e-ci': {
            target: {
              project: 'e2e',
              target: 'e2e-ci',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                'e2e-ci': {
                  metadata: {
                    nonAtomizedTarget: 'e2e',
                  },
                },
              },
            },
          },
        },
      };
      validateAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).not.toHaveBeenCalled();
    });
    it('should do nothing if atomized task is present but escape hatch env var is set', () => {
      process.env['NX_SKIP_ATOMIZER_VALIDATION'] = 'true';
      const taskGraph = {
        tasks: {
          'e2e:e2e-ci': {
            target: {
              project: 'e2e',
              target: 'e2e-ci',
            },
          },
        },
      };
      const projectGraph = {
        nodes: {
          e2e: {
            data: {
              targets: {
                'e2e-ci': {
                  metadata: {
                    nonAtomizedTarget: 'e2e',
                  },
                },
              },
            },
          },
        },
      };
      validateAtomizedTasks(taskGraph as any, projectGraph as any);
      expect(mockProcessExit).not.toHaveBeenCalled();
    });
  });
});
