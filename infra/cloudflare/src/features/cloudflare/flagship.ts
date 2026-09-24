import { flagDefinitions } from "@repo/feature-flags/definitions";
import { Flagship } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { prefixedStack } from "./prefixed-stack.ts";
import { settings } from "./settings.ts";
import { stackName } from "./stacks.ts";

const appResource = "App";

const stack = prefixedStack(
  "flagship",
  Effect.gen(function* flagship() {
    const config = yield* Effect.orDie(settings);
    const app = yield* Flagship.App(appResource, { name: `${config.prefix}-flags` });
    for (const [index, definition] of flagDefinitions.entries()) {
      yield* Flagship.Flag(`Flag${index}`, {
        appId: app.appId,
        defaultVariation: definition.defaultVariation,
        description: definition.description,
        enabled: definition.enabled,
        key: definition.key,
        variations: definition.variations,
      });
    }
    return { appId: app.appId };
  }),
);

function flagshipAppRef(): Effect.Effect<Flagship.App> {
  return Flagship.App.ref(appResource, { stack: stackName("flagship") });
}

export default stack;
export { flagshipAppRef };
