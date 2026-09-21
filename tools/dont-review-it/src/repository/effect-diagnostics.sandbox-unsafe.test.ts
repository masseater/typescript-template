import path from "node:path";
import { fileURLToPath } from "node:url";

import { recommended } from "@effect/tsgo/oxlint-presets";
import { appRun, effectDiagnostics } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";
import { repositoryRoot } from "./repository-root.ts";

const camelRule = (name: string): string =>
  name
    .replace(/^effecttsgo\//u, "")
    .replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());

const EFFECT_LANGUAGE_SERVICE = {
  name: "@effect/language-service",
  includeSuggestionsInTsc: true,
  ignoreEffectSuggestionsInTscExitCode: false,
  ignoreEffectWarningsInTscExitCode: false,
  ignoreEffectErrorsInTscExitCode: false,
  diagnosticSeverity: Object.fromEntries(
    Object.keys(recommended.rules ?? {}).map((name) => [camelRule(name), "error"]),
  ),
} as const;

const configs: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/vite.config.ts",
  { eager: true, import: "default" },
);
const projects: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/tsconfig.json",
  { eager: true },
);
const sharedProjects: Readonly<Record<string, unknown>> = import.meta.glob(
  ["../../../../tsconfig.base.json", "../../tsconfig/base.json"],
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

  it("typechecks with effect-tsgo before the bundle", () => {
    expect.assertions(2);
    expect(effectDiagnostics["check:effect"].command).toBe(
      '"$(effect-tsgo get-exe-path)" --pretty false --noEmit -p tsconfig.json',
    );
    expect(appRun.tasks.build.dependsOn).toEqual(expect.arrayContaining(["check:effect"]));
  });

  it("keeps Effect language-service diagnostics on and failing tsc", () => {
    expect.assertions(2);
    const declared = [...Object.values(sharedProjects), ...Object.values(projects)].flatMap(
      (project) => {
        const plugins = field(field(field(project, "default"), "compilerOptions"), "plugins");
        return Array.isArray(plugins) ? plugins : [];
      },
    );
    const languageService = declared.filter(
      (plugin) => field(plugin, "name") === "@effect/language-service",
    );
    expect(languageService).toStrictEqual(
      languageService.map(() => EFFECT_LANGUAGE_SERVICE as unknown),
    );
    expect(
      Object.values(sharedProjects).map((project) =>
        field(field(field(project, "default"), "compilerOptions"), "plugins"),
      ),
    ).toStrictEqual([[EFFECT_LANGUAGE_SERVICE], [EFFECT_LANGUAGE_SERVICE]]);
  });
});
