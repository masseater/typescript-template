import { Effect } from "effect";
import { sumBy } from "es-toolkit";

import type { PluginOption } from "vite-plus";

const envFileLoader = "tanstack-start-core:load-env";

const pluginNamed = (plugin: PluginOption): string | undefined =>
  typeof plugin === "object" &&
  plugin !== null &&
  "name" in plugin &&
  typeof plugin.name === "string"
    ? plugin.name
    : undefined;

const stripEnvFileLoader = (
  pluginOptions: readonly PluginOption[],
): readonly [PluginOption[], number] => {
  const pieces = pluginOptions.map((plugin): readonly [PluginOption[], number] => {
    if (Array.isArray(plugin)) {
      const [nested, removedCount] = stripEnvFileLoader(plugin);
      return [[...nested], removedCount];
    }
    return pluginNamed(plugin) === envFileLoader ? [[], 1] : [[plugin], 0];
  });
  return [pieces.flatMap(([kept]) => kept), sumBy(pieces, ([, removedCount]) => removedCount)];
};

const withoutEnvFileLoader = (plugins: readonly PluginOption[]): PluginOption[] => {
  const [kept, removed] = stripEnvFileLoader(plugins);
  if (removed === 0) {
    return Effect.runSync(Effect.die(`${envFileLoader} plugin not found`));
  }
  return [...kept];
};

export { withoutEnvFileLoader };
