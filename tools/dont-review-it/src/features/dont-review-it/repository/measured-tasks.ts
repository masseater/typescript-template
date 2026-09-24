import { telemetryEnv, type Tasks } from "@repo/vite-config";

const unmeasuredTasks = (tasks: Tasks): string[] =>
  Object.entries(tasks).flatMap(([name, task]) => {
    if (typeof task === "string" || Array.isArray(task)) return [name];
    if (task.cache === false || [task.command].flat().length === 0) return [];
    const passed = task.env ?? [];
    return telemetryEnv.every((variable) => passed.includes(variable)) ? [] : [name];
  });

export { unmeasuredTasks };
