import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";

import type { ReactDoctorConfig } from "react-doctor/api";

const rootManifests: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const workspaceConfigs: Readonly<Record<string, Readonly<ReactDoctorConfig>>> = import.meta.glob(
  "../../{apps,libs}/*/doctor.config.json",
  { eager: true, import: "default" },
);

const workflows: Readonly<Record<string, string>> = import.meta.glob(
  "../../.github/workflows/*.yml",
  { eager: true, import: "default" },
);

const sources: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../{apps,libs}/*/src/**/*.{ts,tsx}",
  { eager: false },
);

const scripts = field(rootManifests["../../package.json"], "scripts");
const runStep = /^\s*- run: (?<command>.+)$/gmu;

function workflowRuns(): string[] {
  return Object.values(workflows).flatMap((workflow) =>
    [...workflow.matchAll(runStep)].map((match) => match.groups?.["command"] ?? ""),
  );
}

function scriptCommands(): string[] {
  return typeof scripts === "object" && scripts !== null ? Object.values(scripts).map(String) : [];
}

function suppressedFiles(): string[] {
  const suppressed: string[] = [];
  for (const [file, config] of Object.entries(workspaceConfigs)) {
    const workspace = file.replace(/\/doctor\.config\.json$/u, "");
    for (const override of config.ignore?.overrides ?? []) {
      suppressed.push(...override.files.map((target) => `${workspace}/${target}`));
    }
  }
  return suppressed;
}

describe("react-doctor integration", () => {
  it("only the root check:react task runs react-doctor", () => {
    expect.hasAssertions();
    expect({
      scripts: scriptCommands().filter((command) => command.includes("react-doctor")),
      workflows: workflowRuns().filter((command) => command.includes("react-doctor")),
    }).toStrictEqual({ scripts: [], workflows: [] });
  });

  it("workspace configs only add file-scoped suppressions", () => {
    expect.hasAssertions();
    const configs = Object.values(workspaceConfigs);
    expect({
      ignore: configs.map((config) => Object.keys({ ...config.ignore })),
      keys: configs.map((config) => Object.keys(config)),
    }).toStrictEqual({
      ignore: configs.map(() => ["overrides"]),
      keys: configs.map(() => ["$schema", "ignore"]),
    });
  });

  it("every suppressed file still exists", () => {
    expect.hasAssertions();
    expect(suppressedFiles().filter((file) => !(file in sources))).toStrictEqual([]);
  });
});
