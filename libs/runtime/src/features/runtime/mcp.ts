import { Cause, Effect, Predicate, Schema } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { secureResponse } from "./responses.ts";

import type { AppServices } from "./configured-app-layer.ts";

type ToolResult = { content: [{ type: "text"; text: string }]; isError?: true };

type ToolFailure = ToolResult & { isError: true };

type RunApp = <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>;

type ToolRun = <Value, Failure>(
  program: Effect.Effect<Value, Failure, AppServices>,
) => Promise<ToolResult>;

type McpHandler = Readonly<{ fetch: (incoming: Request) => Response | Promise<Response> }>;

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

const toolFailure = (failureMessage: string): ToolFailure => ({
  content: [{ text: failureMessage, type: "text" }],
  isError: true,
});

const toolText = (toolValue: unknown): Effect.Effect<ToolResult> =>
  encodeJson(toolValue).pipe(
    Effect.map((encodedText): ToolResult => ({ content: [{ text: encodedText, type: "text" }] })),
    Effect.orDie,
  );

const failureTag = (squashed: unknown): string =>
  Predicate.hasProperty(squashed, "_tag") && typeof squashed._tag === "string" ? squashed._tag : "";

const toolRunner =
  (run: RunApp, failureCodes: ReadonlyMap<string, string>): ToolRun =>
  (program) =>
    run(
      program.pipe(
        Effect.flatMap(toolText),
        Effect.catchCause((cause) =>
          Effect.succeed(
            toolFailure(failureCodes.get(failureTag(Cause.squash(cause))) ?? "operation_failed"),
          ),
        ),
      ),
    );

const mcpEndpoint = <Actor, Failure, Requirements>(
  authorize: (
    incoming: Request,
    origin: string,
  ) => Effect.Effect<Actor | Response, Failure, Requirements>,
  handlerFor: (actor: Actor, run: RunApp) => McpHandler,
): ((
  incoming: Request,
) => Effect.Effect<Response, Failure, Requirements | AppOrigin | AppServices>) =>
  Effect.fn("serveMcp")(function* serveMcp(incoming: Request) {
    const authorized = yield* authorize(incoming, yield* AppOrigin);
    if (authorized instanceof Response) {
      return authorized;
    }
    const appContext = yield* Effect.context<AppServices>();
    const run = <Value, RunFailure>(
      program: Effect.Effect<Value, RunFailure, AppServices>,
    ): Promise<Value> => Effect.runPromiseWith(appContext)(program);
    const mcpHandler = handlerFor(authorized, run);
    const mcpResponse = yield* Effect.promise(() => Promise.resolve(mcpHandler.fetch(incoming)));
    return secureResponse({ httpRequest: incoming, httpResponse: mcpResponse });
  });

export { mcpEndpoint, toolFailure, toolRunner };
export type { McpHandler, RunApp, ToolFailure, ToolResult, ToolRun };
