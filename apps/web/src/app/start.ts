import { createMiddleware, createStart } from "@tanstack/react-start";
import { Effect, Option } from "effect";

import { SEARCH_INDEX_ORIGIN } from "#/shared/config";

const noindex = createMiddleware().server(({ next }) =>
  Effect.runPromise(
    Effect.promise(() => Promise.resolve(next())).pipe(
      Effect.map(({ response }) => {
        const unindexed = new Response(response.body, response);
        unindexed.headers.set("X-Robots-Tag", "noindex");
        return unindexed;
      }),
    ),
  ),
);

const startInstance = createStart(() => ({
  requestMiddleware: Option.match(SEARCH_INDEX_ORIGIN, {
    onNone: () => [noindex],
    onSome: () => [],
  }),
}));

export { startInstance };
