// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import {
  Console,
  Effect,
  Exit,
  Fiber,
  FileSystem,
  Option,
  Queue,
  Ref,
  Schema,
  Semaphore,
  Stream,
} from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

import type { ChatChange, ChatEvent, ChatNotice, ChatState } from "#shared/contract/index.ts";
import { ChatEntry, applyChat } from "#shared/contract/index.ts";

import { ChatFailure } from "./chat-failure.ts";
import type { CommanderEvent } from "./claude.ts";
import { runTurn } from "./claude.ts";
import type { CommanderPrompt } from "./prompt.ts";

type Spawner = ChildProcessSpawner.ChildProcessSpawner;

interface ChatOptions {
  readonly briefing: Effect.Effect<string>;
  readonly directory: string;
  readonly executable: string;
  readonly model: string | undefined;
  readonly prompt: CommanderPrompt;
  readonly publish: (event: typeof ChatEvent.Type) => Effect.Effect<void>;
  readonly stateDirectory: string;
}

interface Session {
  readonly id: string;
  readonly started: boolean;
}

interface Prompt {
  readonly from: "queue" | "user" | "watch";
  readonly text: string;
}

interface Parts {
  readonly chat: Ref.Ref<ChatState>;
  readonly current: Ref.Ref<Option.Option<Fiber.Fiber<void>>>;
  readonly files: FileSystem.FileSystem;
  readonly options: ChatOptions;
  readonly order: Semaphore.Semaphore;
  readonly pending: Ref.Ref<number>;
  readonly prompts: Queue.Queue<Prompt>;
  readonly session: Ref.Ref<Session>;
}

type Done = Extract<CommanderEvent, { readonly type: "done" }>;

const Stored = Schema.fromJsonString(
  Schema.Struct({
    entries: Schema.Array(ChatEntry),
    sessionId: Schema.String,
    started: Schema.Boolean,
  }),
);
const Summarized = Schema.Struct({
  command: Schema.optional(Schema.String),
  file_path: Schema.optional(Schema.String),
  pattern: Schema.optional(Schema.String),
});
const summarize = Schema.decodeUnknownOption(Summarized);
const keptEntries = 300;
const stateFile = "session.json";

function toolSummary(name: string, input: unknown, scripts: string): string {
  const known = Option.getOrUndefined(summarize(input));
  const detail = known?.command ?? known?.file_path ?? known?.pattern;
  return detail === undefined ? name : `${name} ${detail.replaceAll(`${scripts}/`, "")}`;
}

class Conversation {
  private readonly parts: Parts;

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  public constructor(parts: Parts) {
    this.parts = parts;
  }

  public get state(): Effect.Effect<ChatState> {
    return Ref.get(this.parts.chat);
  }

  public get stop(): Effect.Effect<void> {
    return Ref.get(this.parts.current).pipe(
      Effect.flatMap((current) => Effect.forEach(Option.toArray(current), Fiber.interrupt)),
      Effect.asVoid,
    );
  }

  public get next(): Effect.Effect<void, never, Spawner> {
    const { current, prompts } = this.parts;
    const stopped = this.notify("stopped");
    const { settled } = this;
    const started = Queue.take(prompts).pipe(
      Effect.flatMap((prompt) => Effect.forkChild(this.turn(prompt))),
    );
    return Effect.gen(function* nextPrompt() {
      const fiber = yield* started;
      yield* Ref.set(current, Option.some(fiber));
      const exit = yield* Fiber.await(fiber);
      yield* Ref.set(current, Option.none());
      if (Exit.hasInterrupts(exit)) {
        yield* stopped;
      }
      yield* settled;
    });
  }

  public send(text: string): Effect.Effect<void> {
    const { pending, prompts } = this.parts;
    const direct = this.emit({ entry: { kind: "user", text }, type: "entry" }).pipe(
      Effect.andThen(this.emit({ busy: true, type: "busy" })),
      Effect.andThen(Queue.offer(prompts, { from: "user", text })),
    );
    const ahead = this.emit({ text, type: "queued" }).pipe(
      Effect.andThen(Queue.offer(prompts, { from: "queue", text })),
    );
    return Ref.modify(pending, (count) => [count > 0, count + 1] as const).pipe(
      Effect.flatMap((busy) => (busy ? ahead : direct)),
      Effect.asVoid,
    );
  }

  public wake(text: string): Effect.Effect<boolean> {
    const { pending, prompts } = this.parts;
    const claimed = Ref.modify(pending, (count) =>
      count === 0 ? ([true, 1] as const) : ([false, count] as const),
    );
    const started = this.emit({ busy: true, type: "busy" }).pipe(
      Effect.andThen(Queue.offer(prompts, { from: "watch", text })),
    );
    return claimed.pipe(Effect.tap((idle) => (idle ? started : Effect.void)));
  }

  private get settled(): Effect.Effect<void> {
    const idle = this.emit({ busy: false, type: "busy" });
    return this.save().pipe(
      Effect.andThen(Ref.updateAndGet(this.parts.pending, (count) => count - 1)),
      Effect.flatMap((left) => (left === 0 ? idle : Effect.void)),
    );
  }

  private emit(change: ChatChange): Effect.Effect<void> {
    const { chat, options, order } = this.parts;
    const applied = Ref.updateAndGet(chat, (state) => applyChat(state, change)).pipe(
      Effect.flatMap(({ version }) => options.publish({ change, version })),
    );
    return order.withPermit(applied);
  }

  private notify(notice: ChatNotice): Effect.Effect<void> {
    return this.emit({ entry: { kind: "notice", notice }, type: "entry" });
  }

  private save(): Effect.Effect<void> {
    const { chat, files, options, session } = this.parts;
    return Effect.gen(function* write() {
      const { entries } = yield* Ref.get(chat);
      const { id, started } = yield* Ref.get(session);
      const kept = entries.slice(-keptEntries);
      const text = yield* Schema.encodeEffect(Stored)({ entries: kept, sessionId: id, started });
      yield* files.makeDirectory(options.stateDirectory, { recursive: true });
      yield* files.writeFileString(path.join(options.stateDirectory, stateFile), text);
    }).pipe(
      Effect.mapError((cause) => new ChatFailure({ cause, reason: "state_unwritable" })),
      Effect.catchTag("ChatFailure", (failure) =>
        Console.error(
          JSON.stringify({ event: "commander.state_unwritable", reason: failure.reason }),
        ),
      ),
    );
  }

  private finish(event: Done, resumed: boolean): Effect.Effect<boolean> {
    if (resumed && event.isError && event.numTurns === 0) {
      return Effect.succeed(true);
    }
    if (event.isError) {
      return this.notify("failed").pipe(Effect.as(false));
    }
    const denied = event.denials.length > 0 ? this.notify("denied") : Effect.void;
    return denied.pipe(Effect.as(false));
  }

  private show(event: CommanderEvent, session: Session): Effect.Effect<void> {
    if (event.type === "init") {
      const started = Ref.set(this.parts.session, { id: session.id, started: true });
      return started.pipe(Effect.andThen(this.save()));
    }
    if (event.type === "text") {
      return this.emit({ text: event.text, type: "delta" });
    }
    if (event.type === "tool") {
      const { scripts } = this.parts.options.prompt;
      const summary = toolSummary(event.name, event.input, scripts);
      return this.emit({ entry: { kind: "tool", summary }, type: "entry" });
    }
    return event.type === "failed" ? this.notify("failed") : Effect.void;
  }

  private handle(event: CommanderEvent, session: Session): Effect.Effect<boolean> {
    return event.type === "done"
      ? this.finish(event, session.started)
      : this.show(event, session).pipe(Effect.as(false));
  }

  private attempt(prompt: string): Effect.Effect<boolean, never, Spawner> {
    return Ref.get(this.parts.session).pipe(Effect.flatMap((session) => this.run(prompt, session)));
  }

  private run(prompt: string, session: Session): Effect.Effect<boolean, never, Spawner> {
    const { options } = this.parts;
    const events = runTurn({
      cwd: options.directory,
      executable: options.executable,
      first: !session.started,
      model: options.model,
      prompt,
      scripts: options.prompt.scripts,
      sessionId: session.id,
      systemPrompt: options.prompt.systemPrompt,
    });
    const fold = Stream.runFoldEffect(
      () => false,
      (before: boolean, event: CommanderEvent) =>
        this.handle(event, session).pipe(Effect.map((now) => before || now)),
    );
    return fold(events);
  }

  private renew(): Effect.Effect<void> {
    const { session } = this.parts;
    return Effect.suspend(() => Ref.set(session, { id: crypto.randomUUID(), started: false }));
  }

  private opened(from: Prompt["from"]): Effect.Effect<void> {
    if (from === "user") {
      return Effect.void;
    }
    return from === "queue" ? this.emit({ type: "taken" }) : this.notify("woken");
  }

  private turn(prompt: Prompt): Effect.Effect<void, never, Spawner> {
    const { options, session } = this.parts;
    const opened = this.opened(prompt.from).pipe(Effect.andThen(this.save()));
    const briefed = options.briefing.pipe(
      Effect.map((briefing) => (briefing === "" ? prompt.text : `${briefing}\n\n${prompt.text}`)),
    );
    const attempt = briefed.pipe(Effect.flatMap((text) => this.attempt(text)));
    const renew = this.renew();
    const restarted = this.notify("session_restarted");
    return Effect.gen(function* runPrompt() {
      yield* opened;
      if (yield* attempt) {
        yield* renew;
        yield* restarted;
        yield* attempt;
      }
      if (!(yield* Ref.get(session)).started) {
        yield* renew;
      }
    });
  }
}

const restore = Effect.fn("restore")(function* restore(stateDirectory: string) {
  const files = yield* FileSystem.FileSystem;
  const file = path.join(stateDirectory, stateFile);
  if (!(yield* Effect.orDie(files.exists(file)))) {
    return { entries: [], sessionId: crypto.randomUUID(), started: false };
  }
  return yield* files.readFileString(file).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Stored)),
    Effect.mapError((cause) => new ChatFailure({ cause, reason: "state_invalid" })),
  );
});

const makeChat = Effect.fn("makeChat")(function* makeChat(options: ChatOptions) {
  const stored = yield* restore(options.stateDirectory);
  const conversation = new Conversation({
    chat: yield* Ref.make<ChatState>({
      busy: false,
      entries: stored.entries,
      queued: [],
      version: 0,
    }),
    current: yield* Ref.make(Option.none<Fiber.Fiber<void>>()),
    files: yield* FileSystem.FileSystem,
    options,
    order: yield* Semaphore.make(1),
    pending: yield* Ref.make(0),
    prompts: yield* Queue.unbounded<Prompt>(),
    session: yield* Ref.make<Session>({ id: stored.sessionId, started: stored.started }),
  });
  yield* Effect.forkScoped(Effect.forever(conversation.next));
  return conversation;
});

export { makeChat };
