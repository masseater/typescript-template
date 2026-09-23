import { createRequire } from "node:module";

import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Schema } from "effect";
import { expect } from "vite-plus/test";

import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { path } from "../platform/path.ts";
import { UPSTREAM_PLUGINS, UPSTREAM_RULES } from "./upstream-rules.ts";

const require = createRequire(import.meta.url);
const oxlintRoot = path.dirname(require.resolve("oxlint/package.json"));

const ConfigurationSchema = Schema.Struct({
  definitions: Schema.Struct({
    DummyRuleMap: Schema.Struct({
      properties: Schema.Record(Schema.String, Schema.Unknown),
    }),
  }),
});

const schemaReactRules = Effect.gen(function* schemaReactRules() {
  const filesystem = yield* FileSystem.FileSystem;
  const schema = yield* Schema.decodeEffect(Schema.fromJsonString(ConfigurationSchema))(
    yield* filesystem.readFileString(path.join(oxlintRoot, "configuration_schema.json")),
  );
  return Object.keys(schema.definitions.DummyRuleMap.properties)
    .filter((rule) => rule.startsWith("react/"))
    .map((rule) => rule.slice("react/".length))
    .toSorted();
});

const configuredReactRules = (): ReadonlyMap<string, unknown> => {
  return new Map(
    Object.entries(UPSTREAM_RULES)
      .filter(([rule]) => rule.startsWith("react/"))
      .map(([rule, setting]) => [rule.slice("react/".length), setting]),
  );
};

const severityOf = (setting: unknown): unknown => (Array.isArray(setting) ? setting[0] : setting);

layer(NodeServices.layer)("upstream react rules", (it) => {
  it.effect("keeps the react plugin on the upstream plugin list", () =>
    Effect.sync(() => {
      expect.hasAssertions();
      expect(UPSTREAM_PLUGINS).toContain("react");
    }),
  );

  it.effect("names every non-nursery oxlint react rule at error or off", () =>
    Effect.gen(function* program() {
      expect.hasAssertions();
      const configured = configuredReactRules();
      const nursery = new Set(["require-render-return"]);
      const listed = (yield* schemaReactRules).filter((rule) => !nursery.has(rule));
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
    }),
  );

  it.effect("leaves react-in-jsx-scope off for the automatic JSX runtime", () =>
    Effect.sync(() => {
      expect.hasAssertions();
      expect(configuredReactRules().get("react-in-jsx-scope")).toStrictEqual(LINT_SEVERITY.OFF);
    }),
  );
});
