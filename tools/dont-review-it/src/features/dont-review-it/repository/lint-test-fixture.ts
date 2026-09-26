import { lintOptions } from "./lint.ts";

const configuredLintRules: Readonly<Record<string, unknown>> = Object.assign(
  {},
  lintOptions.rules,
  ...lintOptions.overrides
    .filter((override) => override.files?.includes("libs/**") === true)
    .map((override) => override.rules ?? {}),
);

const builtInPlugins: ReadonlySet<string> = new Set([
  "eslint",
  "import",
  "jest",
  "jsdoc",
  "jsx-a11y",
  "nextjs",
  "node",
  "oxc",
  "promise",
  "react",
  "react-perf",
  "typescript",
  "unicorn",
  "vitest",
  "vue",
]);

const overridePluginMismatches = (overrides: typeof lintOptions.overrides): readonly string[] =>
  overrides.flatMap((override, index) => {
    const plugins = override.plugins;
    if (plugins === undefined) {
      return [];
    }
    const enabled = new Set<string>(plugins);
    return Object.keys(override.rules ?? {}).flatMap((rule) => {
      const plugin = rule.includes("/") ? rule.slice(0, rule.indexOf("/")) : "eslint";
      if (!builtInPlugins.has(plugin) || enabled.has(plugin)) {
        return [];
      }
      return [`overrides[${String(index)}] ${rule} needs plugins to include ${plugin}`];
    });
  });

export { configuredLintRules, overridePluginMismatches };
