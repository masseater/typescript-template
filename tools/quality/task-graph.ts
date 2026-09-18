interface Task<Key extends string> {
  readonly blockedBy: readonly NoInfer<Key>[];
  readonly branch?: string;
  readonly issue: number;
  readonly pullRequest?: number;
  readonly worktree?: string;
}

type Tasks<Key extends string> = Readonly<Record<Key, Task<Key>>>;

interface BlockedByChange {
  readonly add: readonly number[];
  readonly issue: number;
  readonly remove: readonly number[];
}

function defineTasks<const Key extends string>(tasks: Tasks<Key>): Tasks<Key> {
  return tasks;
}

function duplicates(values: readonly (number | string)[]): readonly (number | string)[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

function cycleFrom(tasks: Tasks<string>, path: readonly string[]): readonly string[] {
  const current = path.at(-1);
  if (current === undefined) {
    return [];
  }
  for (const blocker of tasks[current]?.blockedBy ?? []) {
    if (path.includes(blocker)) {
      return [...path.slice(path.indexOf(blocker)), blocker];
    }
    const cycle = cycleFrom(tasks, [...path, blocker]);
    if (cycle.length > 0) {
      return cycle;
    }
  }
  return [];
}

function taskGraphViolations(tasks: Tasks<string>): readonly string[] {
  const entries = Object.values(tasks);
  const branches = entries.flatMap((task) => (task.branch === undefined ? [] : [task.branch]));
  const cycles = Object.keys(tasks).flatMap((key) => {
    const cycle = cycleFrom(tasks, [key]);
    return cycle[0] === key ? [cycle.join(" -> ")] : [];
  });
  return [
    ...duplicates(entries.map((task) => task.issue)).map(
      (issue) => `Issue #${issue} が複数のタスクに割り当てられています`,
    ),
    ...duplicates(branches).map(
      (branch) => `branch ${branch} が複数のタスクに割り当てられています`,
    ),
    ...cycles.map((cycle) => `blockedBy が循環しています: ${cycle}`),
  ];
}

function blockedByChanges(
  tasks: Tasks<string>,
  current: ReadonlyMap<number, readonly number[]>,
): readonly BlockedByChange[] {
  return Object.values(tasks).flatMap((task) => {
    const desired = task.blockedBy.flatMap((key) => {
      const blocker = tasks[key];
      return blocker === undefined ? [] : [blocker.issue];
    });
    const existing = current.get(task.issue) ?? [];
    const add = desired.filter((issue) => !existing.includes(issue));
    const remove = existing.filter((issue) => !desired.includes(issue));
    return add.length > 0 || remove.length > 0 ? [{ add, issue: task.issue, remove }] : [];
  });
}

export { blockedByChanges, defineTasks, taskGraphViolations };
export type { BlockedByChange, Tasks };
