import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recommended } from "@effect/tsgo/oxlint-presets";
import { appRun, effectDiagnostics, effectTsgoNoEmit } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";
import { repositoryRoot } from "./repository-root.ts";
import { commands, configuredDirectories, reachable } from "./tasks.ts";
import { typecheckProjects } from "./typecheck-projects.ts";

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
  ["../../../../vite.config.ts", "../../../../{apps,libs,infra,tools}/*/vite.config.ts"],
  { eager: true, import: "default" },
);
const projects: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/tsconfig.json",
  { eager: true },
);
const nestedProjects: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/**/tsconfig.json",
  { eager: true },
);
const projectTexts: Readonly<Record<string, string>> = import.meta.glob(
  [
    "../../../../tsconfig.base.json",
    "../../tsconfig/base.json",
    "../../../../{apps,libs,infra,tools}/*/tsconfig.json",
  ],
  { eager: true, import: "default", query: "?raw" },
);

type Tsconfig = {
  readonly compilerOptions?: {
    readonly plugins?: readonly unknown[];
  };
};

const parsedProjects = Object.entries(projectTexts)
  .map(([file, text]) => ({
    file,
    project: JSON.parse(text) as Tsconfig,
    text,
  }))
  .toSorted((left, right) => left.file.localeCompare(right.file));

const sharedProjects = parsedProjects.filter(
  ({ file }) => file.endsWith("tsconfig.base.json") || file.endsWith("tsconfig/base.json"),
);

const environment = { command: "serve", mode: "development" };

const workspace = (file: string): string => {
  const absolute = path.isAbsolute(file) ? file : fileURLToPath(new URL(file, import.meta.url));
  const directory = path.relative(repositoryRoot, path.dirname(absolute)).split(path.sep).join("/");
  return directory === "" ? "." : directory;
};

const namedTask = (config: unknown, name: string): unknown => {
  const resolved: unknown =
    typeof config === "function" ? Reflect.apply(config, undefined, [environment]) : config;
  return field(field(field(resolved, "run"), "tasks"), name);
};

const diagnosticsTask = (config: unknown): unknown => namedTask(config, "check:effect");

const commandLines = (task: unknown): readonly string[] => {
  const command = field(task, "command");
  if (typeof command === "string") {
    return [command];
  }
  return Array.isArray(command)
    ? command.filter((entry): entry is string => typeof entry === "string")
    : [];
};

const projectFlag = (command: string): string | undefined => {
  const match = / -p (?<project>\S+)$/u.exec(command);
  return match?.groups?.["project"];
};

const toRepositoryPath = (file: string): string => {
  const absolute = path.isAbsolute(file) ? file : fileURLToPath(new URL(file, import.meta.url));
  return path.relative(repositoryRoot, absolute).split(path.sep).join("/");
};

const diagnosed = Object.entries(configs)
  .filter(([, config]: readonly [string, unknown]) => diagnosticsTask(config) !== undefined)
  .map(([file]: readonly [string, unknown]) => workspace(file))
  .filter((directory) => directory !== ".")
  .toSorted();
const projectWorkspaces = Object.keys(projects)
  .map((file) => workspace(file))
  .toSorted();
const declarations = Object.values(configs)
  .map((config) => diagnosticsTask(config))
  .filter((task) => task !== undefined);

const effectCheckedProjects = [
  ...new Set(
    Object.entries(configs).flatMap(([file, config]) => {
      const packageDirectory = workspace(file);
      return commandLines(diagnosticsTask(config)).flatMap((command) => {
        const project = projectFlag(command);
        if (project === undefined) {
          return [];
        }
        return [
          packageDirectory === "."
            ? project
            : path.posix.normalize(path.posix.join(packageDirectory, project)),
        ];
      });
    }),
  ),
].toSorted();

describe("effect diagnostics coverage", () => {
  it("every workspace with a TypeScript project runs the Effect diagnostics", () => {
    expect.assertions(1);
    expect(diagnosed).toStrictEqual(projectWorkspaces);
  });

  it("every workspace typechecks only through effect-tsgo", () => {
    expect.assertions(3);
    expect(
      declarations.flatMap((task) =>
        commandLines(task).filter((command) => !command.includes("effect-tsgo get-exe-path")),
      ),
    ).toStrictEqual([]);
    expect(declarations.map((task) => field(task, "input"))).toStrictEqual(
      declarations.map(() => effectDiagnostics["check:effect"].input as unknown),
    );
    expect(
      declarations.flatMap((task) => {
        const dependsOn = field(task, "dependsOn");
        if (dependsOn === undefined) {
          return [];
        }
        return Array.isArray(dependsOn) &&
          dependsOn.length === 1 &&
          dependsOn[0] === "compile:paraglide"
          ? []
          : [dependsOn];
      }),
    ).toStrictEqual([]);
  });

  it("every TypeScript project is covered by an effect-tsgo check", () => {
    expect.assertions(2);
    expect(typecheckProjects(repositoryRoot)).toStrictEqual(
      [
        "tsconfig.json",
        ...[...Object.keys(projects), ...Object.keys(nestedProjects)].map(toRepositoryPath),
      ]
        .filter((project, index, all) => all.indexOf(project) === index)
        .toSorted(),
    );
    expect(
      typecheckProjects(repositoryRoot).filter(
        (project) => !effectCheckedProjects.includes(project),
      ),
    ).toStrictEqual([]);
  });

  it("typechecks with effect-tsgo before the bundle and before every push", () => {
    expect.assertions(3);
    expect(effectDiagnostics["check:effect"].command).toBe(effectTsgoNoEmit("tsconfig.json"));
    expect(appRun("service-member").tasks.build.dependsOn).toEqual(
      expect.arrayContaining(["check:effect"]),
    );
    expect(
      configuredDirectories.filter(
        (directory) => !reachable(directory, ["prepush"]).includes("check:effect"),
      ),
    ).toStrictEqual([]);
  });

  it("repository typecheck uses effect-tsgo instead of stock tsc", () => {
    expect.assertions(4);
    expect(commands(".", "check:types")).toStrictEqual(["dont-review-it-typecheck"]);
    const source = readFileSync(new URL("./typecheck-workspaces.ts", import.meta.url), "utf8");
    expect(source).toContain("@effect/tsgo/package.json");
    expect(source).toContain("get-exe-path");
    expect(source).not.toContain("typescript/package.json");
  });

  it("keeps Effect language-service diagnostics on and failing tsc", () => {
    expect.assertions(4);
    const declared = parsedProjects.flatMap(
      ({ project }) => project.compilerOptions?.plugins ?? [],
    );
    const languageService = declared.filter(
      (plugin) => field(plugin, "name") === "@effect/language-service",
    );
    expect(languageService).toStrictEqual(
      languageService.map(() => EFFECT_LANGUAGE_SERVICE as unknown),
    );
    expect(languageService.map((plugin) => field(plugin, "diagnostics"))).not.toContain(false);
    expect(
      parsedProjects.filter(({ text }) => text.includes('"diagnostics": false')),
    ).toStrictEqual([]);
    expect(sharedProjects.map(({ project }) => project.compilerOptions?.plugins)).toStrictEqual([
      [EFFECT_LANGUAGE_SERVICE],
      [EFFECT_LANGUAGE_SERVICE],
    ]);
  });
});
