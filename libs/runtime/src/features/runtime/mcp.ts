import { Effect, Schema } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { secureResponse } from "./responses.ts";

import type { AppServices } from "./index.ts";

type ToolResult = { content: [{ type: "text"; text: string }]; isError?: true };

type ToolFailure = ToolResult & { isError: true };

type RunApp = <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<Value>;

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

function toolFailure(message: string): ToolFailure {
  return { content: [{ text: message, type: "text" }], isError: true };
}

function toolText(value: unknown): Effect.Effect<ToolResult> {
  return encodeJson(value).pipe(
    Effect.map((text): ToolResult => ({ content: [{ text, type: "text" }] })),
    Effect.orDie,
  );
}

function toolRunner(
  run: RunApp,
  failureCodes: ReadonlyMap<string, string>,
): <Value>(program: Effect.Effect<Value, unknown, AppServices>) => Promise<ToolResult> {
  return (program) =>
    run(program.pipe(Effect.flatMap(toolText))).catch(
      (failure: { readonly _tag?: string } | undefined): ToolFailure =>
        toolFailure(failureCodes.get(failure?._tag ?? "") ?? "operation_failed"),
    );
}

function mcpEndpoint<Actor, Failure, Requirements>(
  authorize: (
    request: Request,
    origin: string,
  ) => Effect.Effect<Actor | Response, Failure, Requirements>,
  handlerFor: (
    actor: Actor,
    run: RunApp,
  ) => Readonly<{ fetch: (request: Request) => Response | Promise<Response> }>,
) {
  return Effect.fn("serveMcp")(function* serveMcp(request: Request) {
    const authorized = yield* authorize(request, yield* AppOrigin);
    if (authorized instanceof Response) {
      return authorized;
    }
    const context = yield* Effect.context<AppServices>();
    const run = <Value, RunFailure>(
      program: Effect.Effect<Value, RunFailure, AppServices>,
    ): Promise<Value> => Effect.runPromiseWith(context)(program);
    const handler = handlerFor(authorized, run);
    const response = yield* Effect.promise(() => Promise.resolve(handler.fetch(request)));
    return secureResponse(request, response);
  });
}

export { mcpEndpoint, toolFailure, toolRunner };
export type { RunApp, ToolFailure, ToolResult };
