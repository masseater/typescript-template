import { Context, Effect, Layer, PubSub, Stream } from "effect";

import { makeBoard } from "./board.ts";
import { makeChat } from "./chat.ts";
import { commanderPrompt } from "./prompt.ts";
import { briefing, makeWatch } from "./watch.ts";

import type { ServerEvent } from "#shared/contract/index.ts";
import type { NodeServices } from "@effect/platform-node";
import type { BdFailure } from "./bd.ts";
import type { ChatFailure } from "./chat-failure.ts";
import type { PromptFailure } from "./prompt.ts";

interface CommanderOptions {
  readonly assets: string;
  readonly directory: string;
  readonly executable: string;
  readonly model: string | undefined;
  readonly stateDirectory: string;
}

type Published = typeof ServerEvent.Type;

interface Parts {
  readonly board: Effect.Success<ReturnType<typeof makeBoard>>;
  readonly chat: Effect.Success<ReturnType<typeof makeChat>>;
  readonly hub: PubSub.PubSub<Published>;
}

class Commander extends Context.Service<Commander, Parts>()("@repo/commander/Commander") {}

function turnEnded(event: Published): boolean {
  return event.event === "chat" && event.data.change.type === "busy" && !event.data.change.busy;
}

const makeParts = Effect.fn("makeParts")(function* makeParts(options: CommanderOptions) {
  const hub = yield* PubSub.unbounded<Published>();
  const changes = yield* PubSub.subscribe(hub);
  const board = yield* makeBoard(options.directory, (event) => PubSub.publish(hub, event));
  const chat = yield* makeChat({
    briefing: board.state.pipe(Effect.map(({ tasks }) => briefing(tasks))),
    directory: options.directory,
    executable: options.executable,
    model: options.model,
    prompt: yield* commanderPrompt({
      assets: options.assets,
      directory: options.directory,
      stateDirectory: options.stateDirectory,
    }),
    publish: (data) => PubSub.publish(hub, { data, event: "chat" }),
    stateDirectory: options.stateDirectory,
  });
  const watch = yield* makeWatch((text) => chat.wake(text));
  const current = board.state.pipe(Effect.flatMap(({ tasks }) => watch(tasks)));
  const settled = board.refresh.pipe(Effect.andThen(current));
  const observed = Stream.fromSubscription(changes).pipe(
    Stream.runForEach((event) => {
      if (event.event === "tasks") {
        return watch(event.data);
      }
      return turnEnded(event) ? settled : Effect.void;
    }),
  );
  yield* Effect.forkScoped(observed);
  return { board, chat, hub } satisfies Parts;
});

function commanderLayer(
  options: CommanderOptions,
): Layer.Layer<Commander, BdFailure | ChatFailure | PromptFailure, NodeServices.NodeServices> {
  return Layer.effect(Commander, makeParts(options));
}

export { Commander, commanderLayer };
export type { CommanderOptions };
