import { Effect } from "effect";
import type { Scope } from "effect";
import type { SetupServer } from "msw/node";
import { setupServer } from "msw/node";

function mockServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ...handlers: Parameters<typeof setupServer>
): Effect.Effect<SetupServer, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (server) =>
      Effect.sync(() => {
        server.close();
      }),
  );
}

export { mockServer };
