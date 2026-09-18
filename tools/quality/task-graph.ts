interface Task<Key extends string> {
  readonly blockedBy: readonly NoInfer<Key>[];
  readonly branch?: string;
  readonly issue: number;
}

type Tasks<Key extends string> = Readonly<Record<Key, Task<Key>>>;

interface TrackedIssue {
  readonly blockedBy: readonly number[];
  readonly closed: boolean;
}

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

function unknownBlockers(tasks: Tasks<string>): readonly string[] {
  return Object.entries(tasks).flatMap(([key, task]) =>
    task.blockedBy
      .filter((blocker) => !Object.hasOwn(tasks, blocker))
      .map((blocker) => `${key} の blockedBy にある ${blocker} は登録されていません`),
  );
}

function cycles(tasks: Tasks<string>): readonly string[] {
  const settled = new Set<string>();
  const found: string[] = [];
  function visit(key: string, path: readonly string[]): void {
    const task = tasks[key];
    if (task === undefined || settled.has(key)) {
      return;
    }
    if (path.includes(key)) {
      found.push([...path.slice(path.indexOf(key)), key].join(" -> "));
      return;
    }
    for (const blocker of task.blockedBy) {
      visit(blocker, [...path, key]);
    }
    settled.add(key);
  }
  for (const key of Object.keys(tasks)) {
    visit(key, []);
  }
  return found;
}

function taskGraphViolations(tasks: Tasks<string>): readonly string[] {
  const entries = Object.values(tasks);
  const branches = entries.flatMap((task) => (task.branch === undefined ? [] : [task.branch]));
  return [
    ...duplicates(entries.map((task) => task.issue)).map(
      (issue) => `Issue #${issue} が複数のタスクに割り当てられています`,
    ),
    ...duplicates(branches).map(
      (branch) => `branch ${branch} が複数のタスクに割り当てられています`,
    ),
    ...unknownBlockers(tasks),
    ...cycles(tasks).map((cycle) => `blockedBy が循環しています: ${cycle}`),
  ];
}

function issueViolations(
  tasks: Tasks<string>,
  issues: ReadonlyMap<number, TrackedIssue>,
): readonly string[] {
  return Object.entries(tasks).flatMap(([key, task]) => {
    const issue = issues.get(task.issue);
    if (issue === undefined) {
      return [`${key} の Issue #${task.issue} が GitHub にありません`];
    }
    return issue.closed
      ? [`${key} の Issue #${task.issue} は closed です。tasks.ts からこのタスクを消してください`]
      : [];
  });
}

function blockedByChanges(
  tasks: Tasks<string>,
  issues: ReadonlyMap<number, TrackedIssue>,
): readonly BlockedByChange[] {
  return Object.values(tasks).flatMap((task) => {
    const desired = task.blockedBy.flatMap((key) => {
      const blocker = tasks[key];
      return blocker === undefined ? [] : [blocker.issue];
    });
    const existing = issues.get(task.issue)?.blockedBy ?? [];
    const add = desired.filter((issue) => !existing.includes(issue));
    const remove = existing.filter((issue) => !desired.includes(issue));
    return add.length > 0 || remove.length > 0 ? [{ add, issue: task.issue, remove }] : [];
  });
}

export { blockedByChanges, defineTasks, issueViolations, taskGraphViolations };
export type { BlockedByChange, Tasks, TrackedIssue };
