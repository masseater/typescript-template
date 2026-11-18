export interface Step {
  readonly name: string;
  readonly conclusion: string;
  readonly start: bigint;
  readonly end: bigint;
}

export interface Span {
  readonly key: string;
  readonly parent: string | undefined;
  readonly name: string;
  readonly start: bigint;
  readonly end: bigint;
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly failed: boolean;
}

interface Open {
  readonly key: string;
  readonly parent: string;
  readonly name: string;
  readonly start: bigint;
  readonly attributes: Readonly<Record<string, string | number>>;
}

interface State {
  readonly spans: readonly Span[];
  readonly actions: readonly Open[];
  readonly tasks: readonly Open[];
}

interface Line {
  readonly job: string;
  readonly time: bigint;
  readonly body: string;
  readonly parent: string;
  readonly sequence: string;
}

type Groups = (name: string) => string;

interface Transition {
  readonly pattern: RegExp;
  readonly apply: (state: State, line: Line, found: Groups) => State;
}

const STAMPED =
  /^\uFEFF?(?<seconds>\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(?<ticks>\d{7})Z (?<body>.*)$/u;
const ACTION_START = /^##\[start-action display=(?<display>.*);id=(?<id>[^;\]]+)\]$/u;
const ACTION_END =
  /^##\[end-action id=(?<id>[^;\]]+);outcome=[^;]+;conclusion=(?<conclusion>[^;]+);duration_ms=\d+\]$/u;
const TASK_START =
  /^\[(?<name>[^\]]+)\] (?:~\S*)?\$ (?<command>.*) [◉○⊘] (?<cache>(?:remote )?cache (?:hit|miss|disabled))(?:: (?<reason>.*?))?(?:, (?:replaying|executing))?$/u;
const TASK_END = /^── \[(?<name>[^\]]+)\] ──$/u;
const NANOS_PER_MILLI = 1_000_000n;
const NANOS_PER_TICK = 100n;
const STEP_START_SLACK = 1_000_000_000n;
const NOT_FOUND = -1;
const LAST = -1;
const FIRST = 0;
const ACTION_ID = "github.action.id";

const groupsOf =
  (groups: Readonly<Record<string, string>> = {}): Groups =>
  (name) =>
    groups[name] ?? "";

const stepKeyAt = (job: string, steps: readonly Step[], time: bigint): string => {
  const index = steps.findLastIndex((step) => step.start <= time + STEP_START_SLACK);
  if (index === NOT_FOUND) {
    return job;
  }
  return `${job}/step/${String(index)}`;
};

const decoded = (display: string): string => {
  try {
    return decodeURIComponent(display);
  } catch {
    return display;
  }
};

const closed = (open: Open, end: bigint, conclusion: string): Span => ({
  key: open.key,
  parent: open.parent,
  name: open.name,
  start: open.start,
  end,
  attributes: open.attributes,
  failed: conclusion === "failure",
});

const actionStarted = (state: State, line: Line, found: Groups): State => {
  const id = found("id");
  const action: Open = {
    key: `${line.job}/action/${line.sequence}/${id}`,
    parent: line.parent,
    name: decoded(found("display")),
    start: line.time,
    attributes: { [ACTION_ID]: id },
  };
  return { ...state, actions: [...state.actions, action] };
};

const actionEnded = (state: State, line: Line, found: Groups): State => {
  const id = found("id");
  const index = state.actions.findLastIndex((action) => action.attributes[ACTION_ID] === id);
  const action = state.actions[index];
  if (action === undefined) {
    return state;
  }
  const conclusion = found("conclusion");
  const attributes = { ...action.attributes, "github.action.conclusion": conclusion };
  return {
    ...state,
    spans: [...state.spans, closed({ ...action, attributes }, line.time, conclusion)],
    actions: state.actions.slice(FIRST, index),
  };
};

const taskClosed = (state: State, name: string, time: bigint): State => {
  const task = state.tasks.find((open) => open.name === name);
  if (task === undefined) {
    return state;
  }
  return {
    ...state,
    spans: [...state.spans, closed(task, time, "")],
    tasks: state.tasks.filter((open) => open !== task),
  };
};

const taskStarted = (state: State, line: Line, found: Groups): State => {
  const name = found("name");
  const task: Open = {
    key: `${line.job}/task/${line.sequence}/${name}`,
    parent: line.parent,
    name,
    start: line.time,
    attributes: {
      "vp.task.command": found("command"),
      "vp.task.cache": found("cache"),
      "vp.task.cache.reason": found("reason"),
    },
  };
  const before = taskClosed(state, name, line.time);
  return { ...before, tasks: [...before.tasks, task] };
};

const TRANSITIONS: readonly Transition[] = [
  { pattern: ACTION_START, apply: actionStarted },
  { pattern: ACTION_END, apply: actionEnded },
  { pattern: TASK_START, apply: taskStarted },
  {
    pattern: TASK_END,
    apply: (state, line, found) => taskClosed(state, found("name"), line.time),
  },
];

const parentOf = (state: State, step: string): string => {
  const enclosing = state.actions.at(LAST);
  if (enclosing === undefined) {
    return step;
  }
  return enclosing.key;
};

const timeOf = (stamped: Groups): bigint =>
  BigInt(Date.parse(`${stamped("seconds")}Z`)) * NANOS_PER_MILLI +
  BigInt(stamped("ticks")) * NANOS_PER_TICK;

const applied = (state: State, line: Line): State => {
  for (const transition of TRANSITIONS) {
    const found = transition.pattern.exec(line.body);
    if (found !== null) {
      return transition.apply(state, line, groupsOf(found.groups));
    }
  }
  return state;
};

const afterLine =
  (job: string, steps: readonly Step[]) =>
  (state: State, text: string): State => {
    const match = STAMPED.exec(text);
    if (match === null) {
      return state;
    }
    const stamped = groupsOf(match.groups);
    const time = timeOf(stamped);
    return applied(state, {
      job,
      time,
      body: stamped("body"),
      parent: parentOf(state, stepKeyAt(job, steps, time)),
      sequence: String(state.spans.length + state.actions.length + state.tasks.length),
    });
  };

export const spansOfLog = (job: string, steps: readonly Step[], log: string): readonly Span[] => {
  const advance = afterLine(job, steps);
  let state: State = { spans: [], actions: [], tasks: [] };
  for (const text of log.split("\n")) {
    state = advance(state, text);
  }
  return state.spans;
};
