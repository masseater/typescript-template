import type { ChatChange, ChatNotice, ChatState } from "./contract.ts";
import { ChatEntry, applyChat } from "./contract.ts";
import { Effect, Exit, Fiber, FileSystem, Option, Queue, Ref, Schema, Stream } from "effect";
import { ChatFailure } from "./chat-failure.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CommanderEvent } from "./claude.ts";
import type { CommanderPrompt } from "./prompt.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { runTurn } from "./claude.ts";

type Spawner = ChildProcessSpawner.ChildProcessSpawner;

interface ChatOptions {
  readonly directory: string;
  readonly executable: string;
  readonly model: string | undefined;
  readonly prompt: CommanderPrompt;
  readonly publish: (event: ChatChange) => Effect.Effect<void>;
  readonly stateDirectory: string;
  readonly turnEnded: Effect.Effect<void, never, Spawner>;
}

interface Session {
  readonly id: string;
  readonly started: boolean;
}

interface Parts {
  readonly chat: Ref.Ref<ChatState>;
  readonly current: Ref.Ref<Option.Option<Fiber.Fiber<void>>>;
  readonly files: FileSystem.FileSystem;
  readonly options: ChatOptions;
  readonly pending: Ref.Ref<number>;
  readonly prompts: Queue.Queue<string>;
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
    const settled = this.settle();
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
    return Ref.update(pending, (count) => count + 1).pipe(
      Effect.andThen(this.emit({ entry: { kind: "user", text }, type: "entry" })),
      Effect.andThen(this.emit({ busy: true, type: "busy" })),
      Effect.andThen(this.save()),
      Effect.andThen(Queue.offer(prompts, text)),
      Effect.asVoid,
    );
  }

  private emit(event: ChatChange): Effect.Effect<void> {
    return Ref.update(this.parts.chat, (state) => applyChat(state, event)).pipe(
      Effect.andThen(this.parts.options.publish(event)),
    );
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
      Effect.orDie,
    );
  }

  private settle(): Effect.Effect<void, never, Spawner> {
    const { options, pending } = this.parts;
    const idle = this.emit({ busy: false, type: "busy" });
    return Ref.updateAndGet(pending, (count) => count - 1).pipe(
      Effect.flatMap((left) => (left === 0 ? idle : Effect.void)),
      Effect.andThen(this.save()),
      Effect.andThen(options.turnEnded),
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

  private turn(prompt: string): Effect.Effect<void, never, Spawner> {
    const { session } = this.parts;
    const attempt = this.attempt(prompt);
    const renew = this.renew();
    const restarted = this.notify("session_restarted");
    return Effect.gen(function* runPrompt() {
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
    chat: yield* Ref.make<ChatState>({ busy: false, entries: stored.entries }),
    current: yield* Ref.make(Option.none<Fiber.Fiber<void>>()),
    files: yield* FileSystem.FileSystem,
    options,
    pending: yield* Ref.make(0),
    prompts: yield* Queue.unbounded<string>(),
    session: yield* Ref.make<Session>({ id: stored.sessionId, started: stored.started }),
  });
  yield* Effect.forkScoped(Effect.forever(conversation.next));
  return conversation;
});

export { makeChat };
