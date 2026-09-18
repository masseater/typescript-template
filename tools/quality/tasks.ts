import type { ConfigEnv, UserConfig, UserConfigFnObject } from "vite-plus";

import type { Tasks } from "@repo/config/vite";

import { field, workspaceManifests } from "./dependencies.ts";

const configModules: Readonly<Record<string, UserConfig | UserConfigFnObject>> = import.meta.glob(
  ["../../vite.config.ts", "../../{apps,libs,infra,tools}/*/vite.config.ts"],
  { eager: true, import: "default" },
);

const rootManifests: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const serveEnv: ConfigEnv = { command: "serve", mode: "development" };
const repository = "file:///repository/";

function directoryOf(file: string): string {
  const resolved = new URL(file, `${repository}tools/quality/`).href.slice(repository.length);
  return resolved.replace(/\/?[^/]+$/u, "") || ".";
}

function scriptsOf(manifest: unknown): Readonly<Record<string, unknown>> {
  const scripts = field(manifest, "scripts");
  return typeof scripts === "object" && scripts !== null ? { ...scripts } : {};
}

const workspaceScripts: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  ".": scriptsOf(rootManifests["../../package.json"]),
  ...Object.fromEntries(
    workspaceManifests.map(({ file, manifest }) => [
      file.replace(/\/package\.json$/u, ""),
      scriptsOf(manifest),
    ]),
  ),
};

const workspaceTasks: Readonly<Record<string, Tasks>> = Object.fromEntries(
  Object.entries(configModules).map(([file, config]) => {
    const resolved = typeof config === "function" ? config(serveEnv) : config;
    return [directoryOf(file), resolved.run?.tasks ?? {}];
  }),
);

const workspaceDirectories: readonly string[] = Object.keys(workspaceScripts).toSorted();
const configuredDirectories: readonly string[] = Object.keys(workspaceTasks).toSorted();

function taskNames(directory: string): string[] {
  return Object.keys(workspaceTasks[directory] ?? {});
}

function scriptNames(directory: string): string[] {
  return Object.keys(workspaceScripts[directory] ?? {});
}

function dependencies(directory: string, name: string): string[] {
  const task = workspaceTasks[directory]?.[name];
  if (typeof task !== "object" || Array.isArray(task)) {
    return [];
  }
  return (task.dependsOn ?? []).map((entry) =>
    typeof entry === "string" ? entry : `*#${entry.task}`,
  );
}

function commands(directory: string, name: string): string[] {
  const task = workspaceTasks[directory]?.[name];
  if (task !== undefined) {
    return [typeof task === "object" && !Array.isArray(task) ? task.command : task].flat();
  }
  const script = workspaceScripts[directory]?.[name];
  if (typeof script !== "string") {
    throw new TypeError(`${directory}: ${name} is neither a task nor a script`);
  }
  return [script];
}

function reachable(directory: string, names: readonly string[]): string[] {
  const next = names
    .filter((name) => !name.includes("#"))
    .flatMap((name) => dependencies(directory, name))
    .filter((name) => !names.includes(name));
  return next.length === 0 ? [...names] : reachable(directory, [...names, ...new Set(next)]);
}

export {
  commands,
  configuredDirectories,
  dependencies,
  reachable,
  scriptNames,
  taskNames,
  workspaceDirectories,
  workspaceTasks,
};
