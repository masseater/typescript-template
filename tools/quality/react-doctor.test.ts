import { stringEntriesOf } from "@repo/dont-review-it/record-fields";
import { linkWrapperFiles } from "@repo/ui/lint-settings";
import { describe, expect, it } from "vite-plus/test";

import { field } from "./dependencies.ts";
import { commands, reachable } from "./tasks.ts";

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

const workflowRuns = (): string[] => {
  return Object.values(workflows).flatMap((workflow) =>
    [...workflow.matchAll(runStep)].map((match) => match.groups?.command ?? ""),
  );
};

const scriptCommands = (): string[] => {
  return typeof scripts === "object" && scripts !== null ? Object.values(scripts).map(String) : [];
};

const suppressedFiles = (): string[] => {
  const suppressed: string[] = [];
  for (const [file, config] of Object.entries(workspaceConfigs)) {
    const workspace = file.replace(/\/doctor\.config\.json$/u, "");
    for (const override of config.ignore?.overrides ?? []) {
      suppressed.push(...override.files.map((target) => `${workspace}/${target}`));
    }
  }
  return suppressed;
};

const rootDoctorConfigs: Readonly<Record<string, unknown>> = import.meta.glob(
  "./doctor.config.ts",
  { eager: true, import: "default" },
);

const aiOperableDoctorRules = [
  "react-doctor/control-has-associated-label",
  "react-doctor/dialog-has-accessible-name",
  "react-doctor/no-hover-only-reveal",
  "react-doctor/base-ui-dialog-popup-requires-title",
] as const;

const compilerOptions: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../tsconfig.base.json",
  { eager: true, import: "default" },
);

const knipOwnedRules = [
  "react-doctor/unused-dependency",
  "react-doctor/unused-dev-dependency",
  "react-doctor/unused-export",
  "react-doctor/unused-file",
  "react-doctor/unused-type",
] as const;

const globalOffRules = [
  ...knipOwnedRules,
  "react-doctor/no-all-caps-body-text",
  "react-doctor/react-compiler-no-manual-memoization",
  "react-doctor/react-in-jsx-scope",
] as const;

const rootRules = (): unknown => field(rootDoctorConfigs["./doctor.config.ts"], "rules");

const offRules = (): string[] =>
  stringEntriesOf(rootRules())
    .filter(([, severity]) => severity === "off")
    .map(([rule]) => rule)
    .toSorted();

describe("react-doctor integration", () => {
  it("only the root check:react task runs react-doctor", () => {
    expect.hasAssertions();
    expect({
      scripts: scriptCommands().filter((command) => command.includes("react-doctor")),
      workflows: workflowRuns().filter((command) => command.includes("react-doctor")),
    }).toStrictEqual({ scripts: [], workflows: [] });
  });

  it("keeps AI-operable UI rules enabled at error", () => {
    expect.hasAssertions();
    const config = rootDoctorConfigs["./doctor.config.ts"];
    const rules = field(config, "rules");
    expect(
      Object.fromEntries(aiOperableDoctorRules.map((rule) => [rule, field(rules, rule)])),
    ).toStrictEqual(Object.fromEntries(aiOperableDoctorRules.map((rule) => [rule, "error"])));
  });

  it("workspace configs only add file-scoped suppressions", () => {
    expect.hasAssertions();
    const configs = Object.values(workspaceConfigs);
    expect(configs.map((config) => Object.keys(config).toSorted())).toStrictEqual(
      configs.map(() => ["$schema", "ignore"]),
    );
    expect(
      configs.every((config) =>
        Object.keys({ ...config.ignore }).every((key) => key === "files" || key === "overrides"),
      ),
    ).toBe(true);
  });

  it("every suppressed file still exists", () => {
    expect.hasAssertions();
    expect(suppressedFiles().filter((file) => !(file in sources))).toStrictEqual([]);
  });

  it("keeps global offs inside knip, the JSX runtime, a retired rule, and the all-caps false positive", () => {
    expect.hasAssertions();
    expect(offRules()).toStrictEqual([...globalOffRules].toSorted());
    expect(field(rootRules(), "react-doctor/circular-dependency")).toStrictEqual("error");
    expect(field(rootRules(), "react-doctor/jsx-props-no-spreading")).toStrictEqual("error");
    expect(field(rootDoctorConfigs["./doctor.config.ts"], "ignore")).toStrictEqual({
      files: ["dist/**"],
    });
  });

  it("leaves unused rules off only while knip --strict is on the push gate", () => {
    expect.hasAssertions();
    expect(commands(".", "knip")).toStrictEqual(["knip", "knip --strict"]);
    expect(reachable(".", ["prepush"])).toContain("knip");
    expect(knipOwnedRules.filter((rule) => !offRules().includes(rule))).toStrictEqual([]);
  });

  it("leaves React in scope off only while the automatic JSX runtime is on", () => {
    expect.hasAssertions();
    const base = compilerOptions["../../tsconfig.base.json"];
    expect(field(field(base, "compilerOptions"), "jsx")).toStrictEqual("react-jsx");
    expect(field(rootRules(), "react-doctor/react-in-jsx-scope")).toStrictEqual("off");
  });

  it("names the link wrappers that forward anchor props, and no other spreading escape", () => {
    expect.hasAssertions();
    const spreadingFiles = Object.entries(workspaceConfigs).flatMap(([file, config]) => {
      const workspace = file.replace(/\/doctor\.config\.json$/u, "");
      return (config.ignore?.overrides ?? [])
        .filter((override) => override.rules?.includes("react-doctor/jsx-props-no-spreading"))
        .flatMap((override) => override.files.map((target) => `${workspace}/${target}`));
    });
    expect(spreadingFiles.toSorted()).toStrictEqual(
      linkWrapperFiles.map((file) => `../../${file}`).toSorted(),
    );
  });
});
