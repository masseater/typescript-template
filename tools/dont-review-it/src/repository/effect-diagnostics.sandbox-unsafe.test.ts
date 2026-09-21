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

const diagnosticsTask = (config: unknown): unknown => {
  const resolved: unknown =
    typeof config === "function" ? Reflect.apply(config, undefined, [environment]) : config;
  return field(field(field(resolved, "run"), "tasks"), "check:effect");
};

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

  it("fails the gate on a missing named export before the bundle", () => {
    expect.assertions(2);
    expect(effectDiagnostics["check:effect"].command).toBe(
      'sh -c \'out=$("$(effect-tsgo get-exe-path)" --noEmit -p tsconfig.json 2>&1 || :); printf "%s\\n" "$out"; printf "%s\\n" "$out" | grep -q "error TS2305" && exit 1; :\' && effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning',
    );
    expect(appRun.tasks.build.dependsOn).toEqual(expect.arrayContaining(["check:effect"]));
  });
});
