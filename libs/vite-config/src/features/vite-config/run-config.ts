import type { UserConfig } from "vite-plus";

type RunConfig = NonNullable<UserConfig["run"]>;

type MeasuredTasks<Defined> = {
  [Name in keyof Defined]: Defined[Name] extends { readonly cache: false }
    ? Defined[Name]
    : Defined[Name] extends string | readonly string[]
      ? { command: Defined[Name]; env: string[] }
      : Defined[Name] & { env: string[] };
};

const telemetryEnv = ["MST_TELEMETRY", "OTEL_*", "TRACEPARENT", "TRACESTATE", "BAGGAGE"] as const;

type Tasks = NonNullable<RunConfig["tasks"]>;

const measured = <Defined extends Tasks>(tasks: Defined): MeasuredTasks<Defined> =>
  Object.fromEntries(
    Object.entries(tasks).map(([taskName, task]) => {
      if (typeof task === "string" || !("command" in task)) {
        return [taskName, { command: task, env: [...telemetryEnv] }];
      }
      if (task.cache === false || [task.command].flat().length === 0) return [taskName, task];
      return [taskName, { ...task, env: [...new Set([...(task.env ?? []), ...telemetryEnv])] }];
    }),
  ) as MeasuredTasks<Defined>;

export { measured, telemetryEnv };
export type { MeasuredTasks, RunConfig, Tasks };
