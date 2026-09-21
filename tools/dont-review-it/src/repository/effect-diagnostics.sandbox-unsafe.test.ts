import path from "node:path";
import { fileURLToPath } from "node:url";

import { appRun, effectDiagnostics } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";
import { repositoryRoot } from "./repository-root.ts";

const configs: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/vite.config.ts",
  { eager: true, import: "default" },
);
const projects: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/tsconfig.json",
  { eager: true },
);

const environment = { command: "serve", mode: "development" };

const workspace = (file: string): string => {
  const absolute = path.isAbsolute(file) ? file : fileURLToPath(new URL(file, import.meta.url));
  return path.relative(repositoryRoot, path.dirname(absolute)).split(path.sep).join("/");
};

const namedTask = (config: unknown, name: string): unknown => {
  const resolved: unknown =
    typeof config === "function" ? Reflect.apply(config, undefined, [environment]) : config;
  return field(field(field(resolved, "run"), "tasks"), name);
};

const diagnosticsTask = (config: unknown): unknown => namedTask(config, "check:effect");

const diagnosed = Object.entries(configs)
  .filter(([, config]: readonly [string, unknown]) => diagnosticsTask(config) !== undefined)
  .map(([file]: readonly [string, unknown]) => workspace(file))
  .toSorted();
const projectWorkspaces = Object.keys(projects)
  .map((file) => workspace(file))
  .toSorted();
const declarations = Object.values(configs)
  .map((config) => diagnosticsTask(config))
  .filter((task) => task !== undefined);

describe("effect diagnostics coverage", () => {
  it("every workspace with a TypeScript project runs the Effect diagnostics", () => {
    expect.assertions(1);
    expect(diagnosed).toStrictEqual(projectWorkspaces);
  });

  it("every workspace runs the same diagnostics command", () => {
    expect.assertions(1);
    expect(declarations).toStrictEqual(
      declarations.map(() => effectDiagnostics["check:effect"] as unknown),
    );
  });

  it("fails the gate before effect diagnostics and before the bundle", () => {
    expect.assertions(4);
    const gates = Object.values(configs)
      .map((config) => namedTask(config, "check:effect:gate"))
      .filter((task) => task !== undefined);
    expect(gates).toStrictEqual(gates.map(() => effectDiagnostics["check:effect:gate"]));
    expect(gates).toHaveLength(declarations.length);
    expect(effectDiagnostics["check:effect"]).toEqual(
      expect.objectContaining({
        command:
          "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
        dependsOn: ["check:effect:gate"],
      }),
    );
    expect(appRun.tasks.build.dependsOn).toEqual(expect.arrayContaining(["check:effect"]));
  });
});
