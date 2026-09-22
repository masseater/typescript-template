import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { UPSTREAM_PLUGINS, UPSTREAM_RULES } from "./upstream-rules.ts";

const require = createRequire(import.meta.url);
const oxlintRoot = dirname(require.resolve("oxlint/package.json"));

type Schema = {
  readonly definitions: {
    readonly DummyRuleMap: {
      readonly properties: Readonly<Record<string, unknown>>;
    };
  };
};

const schemaReactRules = (): readonly string[] => {
  const schema = JSON.parse(
    readFileSync(join(oxlintRoot, "configuration_schema.json"), "utf8"),
  ) as Schema;
  return Object.keys(schema.definitions.DummyRuleMap.properties)
    .filter((rule) => rule.startsWith("react/"))
    .map((rule) => rule.slice("react/".length))
    .toSorted();
};

const configuredReactRules = (): ReadonlyMap<string, unknown> => {
  return new Map(
    Object.entries(UPSTREAM_RULES)
      .filter(([rule]) => rule.startsWith("react/"))
      .map(([rule, setting]) => [rule.slice("react/".length), setting]),
  );
};

const severityOf = (setting: unknown): unknown => (Array.isArray(setting) ? setting[0] : setting);

describe("upstream react rules", () => {
  it("keeps the react plugin on the upstream plugin list", () => {
    expect.hasAssertions();
    expect(UPSTREAM_PLUGINS).toContain("react");
  });

  it("names every non-nursery oxlint react rule at error or off", () => {
    expect.hasAssertions();
    const configured = configuredReactRules();
    const nursery = new Set(["require-render-return"]);
    const listed = schemaReactRules().filter((rule) => !nursery.has(rule));
    expect(listed.filter((rule) => !configured.has(rule))).toStrictEqual([]);
    expect(
      [...configured.entries()]
        .filter(([, setting]) => {
          const severity = severityOf(setting);
          return severity !== LINT_SEVERITY.ERROR && severity !== LINT_SEVERITY.OFF;
        })
        .map(([rule]) => rule)
        .toSorted(),
    ).toStrictEqual([]);
  });

  it("leaves react-in-jsx-scope off for the automatic JSX runtime", () => {
    expect.hasAssertions();
    expect(configuredReactRules().get("react-in-jsx-scope")).toStrictEqual(LINT_SEVERITY.OFF);
  });
});
