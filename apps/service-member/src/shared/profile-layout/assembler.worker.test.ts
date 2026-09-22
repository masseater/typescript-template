import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { assembleProfileLayout, ProfileLayoutAssembler } from "./assembler.ts";
import { interviewProfileLayout } from "./default.ts";

import type { Scope } from "effect";

type Network = ReturnType<typeof setupNetwork>;

const endpoint = "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions";
const access = { accountId: "account", apiKey: "test-token" } as const;
const unavailable = 503;

function withServer(
  ...handlers: Parameters<Network["use"]>
): Effect.Effect<Network, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(...handlers);
      network.enable();
      return network;
    }),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

function assemble(
  sheet: Readonly<Record<string, never>>,
): ReturnType<ProfileLayoutAssembler["Service"]["assemble"]> {
  return Effect.gen(function* program() {
    const assembler = yield* ProfileLayoutAssembler;
    return yield* assembler.assemble(sheet);
  }).pipe(Effect.provide(ProfileLayoutAssembler.layer(access)));
}

function completion(content: unknown): Response {
  return HttpResponse.json({
    choices: [
      {
        finish_reason: "stop",
        index: 0,
        message: { content: JSON.stringify(content), role: "assistant" },
      },
    ],
    created: 0,
    id: "completion",
    model: "@cf/google/gemma-4-26b-a4b-it",
    object: "chat.completion",
  });
}

it.effect("off-catalogue model output falls back to the default interview layout", () =>
  Effect.gen(function* program() {
    yield* withServer(http.post(endpoint, () => completion({ blocks: [{ kind: "custom-html" }] })));
    const layout = yield* assembleProfileLayout({}).pipe(
      Effect.provide(ProfileLayoutAssembler.layer(access)),
    );
    assert.deepStrictEqual(layout, interviewProfileLayout);
  }),
);

it.effect("a valid model answer keeps the chosen block order", () =>
  Effect.gen(function* program() {
    const chosen = {
      blocks: [
        { kind: "identity" },
        { kind: "sheet-message" },
        { kind: "sheet-occupation" },
        { kind: "actions" },
      ],
    } as const;
    yield* withServer(http.post(endpoint, () => completion(chosen)));
    const layout = yield* assemble({});
    assert.deepStrictEqual(layout, chosen);
  }),
);

it.effect("without access to a model the assembler reports that it is unavailable", () =>
  Effect.gen(function* program() {
    const failed = yield* Effect.gen(function* program() {
      const assembler = yield* ProfileLayoutAssembler;
      return yield* assembler.assemble({});
    }).pipe(Effect.provide(ProfileLayoutAssembler.layer()), Effect.flip);
    assert.deepStrictEqual(failed.reason, "unavailable");
  }),
);

it.effect("a model error is reported as a layout failure", () =>
  Effect.gen(function* program() {
    yield* withServer(
      http.post(endpoint, () => new HttpResponse(undefined, { status: unavailable })),
    );
    const failed = yield* assemble({}).pipe(Effect.flip);
    assert.deepStrictEqual(failed.reason, "model_failed");
  }),
);
