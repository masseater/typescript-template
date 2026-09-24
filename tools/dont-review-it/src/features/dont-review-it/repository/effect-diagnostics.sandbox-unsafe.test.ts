import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { recommended } from "@effect/tsgo/oxlint-presets";
import {
  appRun,
  awaitingEffectDiagnostics,
  effectDiagnostics,
  effectTsgoNoEmit,
} from "@repo/vite-config";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { path } from "../platform/path.ts";
import { posixPath } from "../platform/path.ts";
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
  [
    "../../../../../../vite.config.ts",
    "../../../../../../{apps,libs,infra,tools}/*/vite.config.ts",
  ],
  { eager: true, import: "default" },
);
const projects: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../../../{apps,libs,infra,tools}/*/tsconfig.json",
  { eager: true },
);
const nestedProjects: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../../../{apps,libs,infra,tools}/*/**/tsconfig.json",
  { eager: true },
);
const projectTexts: Readonly<Record<string, string>> = import.meta.glob(
  [
    "../../../../../../tsconfig.base.json",
    "../../../../tsconfig/base.json",
    "../../../../../../{apps,libs,infra,tools}/*/tsconfig.json",
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

const baselinedCommand = awaitingEffectDiagnostics(repositoryRoot)["check:effect"].command;

const compilerCommand = (command: string): string =>
  command === baselinedCommand ? effectTsgoNoEmit("tsconfig.json") : command;

const commandLines = (task: unknown): readonly string[] => {
  const command = field(task, "command");
  if (typeof command === "string") {
    return [compilerCommand(command)];
  }
  return Array.isArray(command)
    ? command
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => compilerCommand(entry))
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
const declarations = Object.entries(configs)
  .map(([file, config]) => ({ directory: workspace(file), task: diagnosticsTask(config) }))
  .filter((declaration) => declaration.task !== undefined);

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
            : posixPath.normalize(posixPath.join(packageDirectory, project)),
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
      declarations.flatMap(({ task }) =>
        commandLines(task).filter((command) => !command.includes("effect-tsgo get-exe-path")),
      ),
    ).toStrictEqual([]);
    expect(declarations.map(({ task }) => field(task, "input"))).toStrictEqual(
      declarations.map(({ directory, task }) => {
        const packageRoot = path.join(repositoryRoot, directory);
        return field(task, "command") === baselinedCommand
          ? (awaitingEffectDiagnostics(packageRoot)["check:effect"].input as unknown)
          : (effectDiagnostics(packageRoot)["check:effect"].input as unknown);
      }),
    );
    expect(
      declarations.flatMap(({ task }) => {
        const dependsOn = field(task, "dependsOn");
        if (dependsOn === undefined) {
          return [];
        }
        return Array.isArray(dependsOn) &&
          dependsOn.length === 1 &&
          ["compile:paraglide", "typescript-template#compile:paraglide"].includes(dependsOn[0])
          ? []
          : [dependsOn];
      }),
    ).toStrictEqual([]);
  });

  it("every TypeScript project is covered by an effect-tsgo check", () =>
    Effect.runPromise(
      Effect.gen(function* everyProjectCovered() {
        expect.assertions(2);
        const typechecked = yield* typecheckProjects(repositoryRoot);
        expect(typechecked).toStrictEqual(
          [
            "tsconfig.json",
            ...[...Object.keys(projects), ...Object.keys(nestedProjects)].map(toRepositoryPath),
          ]
            .filter((project, index, all) => all.indexOf(project) === index)
            .toSorted(),
        );
        expect(
          typechecked.filter((project) => !effectCheckedProjects.includes(project)),
        ).toStrictEqual([]);
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("typechecks with effect-tsgo before the bundle and before every push", () => {
    expect.assertions(3);
    expect(effectDiagnostics(repositoryRoot)["check:effect"].command).toBe(
      effectTsgoNoEmit("tsconfig.json"),
    );
    expect(
      appRun(path.join(repositoryRoot, "apps", "service-member")).tasks.build.dependsOn,
    ).toStrictEqual(expect.arrayContaining(["check:effect"]));
    expect(
      configuredDirectories.filter(
        (directory) => !reachable(directory, ["prepush"]).includes("check:effect"),
      ),
    ).toStrictEqual([]);
  });

  it("repository typecheck uses effect-tsgo instead of stock tsc", () =>
    Effect.runPromise(
      Effect.gen(function* typecheckThroughEffectTsgo() {
        expect.assertions(4);
        expect(commands(".", "check:types")).toStrictEqual(["dont-review-it-typecheck"]);
        const filesystem = yield* FileSystem.FileSystem;
        const source = yield* filesystem.readFileString(
          fileURLToPath(new URL("./typecheck-workspaces.ts", import.meta.url)),
        );
        expect(source).toContain("@effect/tsgo/package.json");
        expect(source).toContain("get-exe-path");
        expect(source).not.toContain("typescript/package.json");
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

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
