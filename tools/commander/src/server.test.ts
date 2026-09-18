import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Option, Schedule, Schema, Stream } from "effect";
import type { Scope } from "effect";

import { bd } from "./bd.ts";
import { AppState, ChatEvent, applyChat, receiveChat } from "./contract.ts";
import { bundledAssets } from "./prompt.ts";
import { makeApp } from "./server.ts";
import { createLedger } from "./tasks.ts";

const origin = "http://127.0.0.1:3090";
const executableMode = 0o755;
const timeout = 120_000;
const ok = 200;
const accepted = 202;
const Created = Schema.Struct({ id: Schema.String });
const badRequest = 400;
const forbidden = 403;
const dataPrefix = "data: ";
const oneExchange = 2;
const twoExchanges = 4;
const sessionIdPosition = 6;
const systemPromptPosition = 10;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const recorder = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const home = path.dirname(process.argv[1]);
const call = {
  actor: process.env.BEADS_ACTOR,
  argv: process.argv.slice(2),
  billed: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"].filter((name) => name in process.env),
  cwd: process.cwd(),
  repository: ["GIT_DIR", "GIT_WORK_TREE"].filter((name) => name in process.env),
  stdin: fs.readFileSync(0, "utf8"),
};
fs.appendFileSync(path.join(home, "calls.jsonl"), JSON.stringify(call) + "\\n");
const lines = [
  { cwd: call.cwd, mcp_servers: [], model: "fake", session_id: "s", subtype: "init", tools: ["Bash", "Glob", "Grep", "Read"], type: "system" },
  { event: { delta: { text: "了解", type: "text_delta" }, type: "content_block_delta" }, type: "stream_event" },
  { is_error: false, num_turns: 1, permission_denials: [], type: "result" },
];
process.stdout.write(lines.map((line) => JSON.stringify(line) + "\\n").join(""));
`;

const Call = Schema.fromJsonString(
  Schema.Struct({
    actor: Schema.String,
    argv: Schema.Array(Schema.String),
    billed: Schema.Array(Schema.String),
    cwd: Schema.String,
    repository: Schema.Array(Schema.String),
    stdin: Schema.String,
  }),
);
const decodeCall = Schema.decodeUnknownEffect(Call);
const decodeState = Schema.decodeUnknownEffect(Schema.fromJsonString(AppState));
const decodeChat = Schema.decodeUnknownOption(Schema.fromJsonString(ChatEvent));

function installRecorder(home: string): Effect.Effect<void, unknown, NodeServices.NodeServices> {
  return Effect.gen(function* installed() {
    const files = yield* FileSystem.FileSystem;
    // oxlint-disable-next-line node/no-process-env
    Object.assign(process.env, {
      ANTHROPIC_API_KEY: "would-be-billed",
      ANTHROPIC_AUTH_TOKEN: "would-be-billed",
      GIT_DIR: `${home}/another-repository.git`,
      GIT_WORK_TREE: `${home}/another-repository`,
    });
    yield* files.writeFileString(`${home}/claude`, recorder);
    yield* files.chmod(`${home}/claude`, executableMode);
  });
}

interface Served {
  readonly directory: string;
  readonly fetch: (request: Request) => Promise<Response>;
  readonly home: string;
}

function withoutLedger(): Effect.Effect<void> {
  return Effect.void;
}

function serve(
  prepare: (
    directory: string,
  ) => Effect.Effect<unknown, unknown, NodeServices.NodeServices> = withoutLedger,
): Effect.Effect<Served, unknown, NodeServices.NodeServices | Scope.Scope> {
  return Effect.gen(function* served() {
    const files = yield* FileSystem.FileSystem;
    const temporary = yield* files.makeTempDirectoryScoped({ prefix: "commander-" });
    const home = yield* files.realPath(temporary);
    const directory = `${home}/project`;
    yield* files.makeDirectory(directory);
    yield* installRecorder(home);
    yield* prepare(directory);
    const app = yield* makeApp({
      directory,
      executable: `${home}/claude`,
      model: undefined,
      origin,
      stateDirectory: `${home}/state`,
    });
    return { directory, fetch: async (request: Request) => app.fetch(request), home };
  });
}

function post(path: string, body: unknown, from: string = origin): Request {
  return new Request(`${origin}${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin: from },
    method: "POST",
  });
}

function send(served: Served, request: Request): Effect.Effect<number> {
  return Effect.promise(async () => served.fetch(request)).pipe(
    Effect.map((response) => response.status),
  );
}

function lines(served: Served): Stream.Stream<string, unknown> {
  const opened = Effect.promise(async () => served.fetch(new Request(`${origin}/api/events`)));
  const body = opened.pipe(
    Effect.map((response) =>
      Stream.fromReadableStream({
        evaluate: () => response.body ?? new ReadableStream<Uint8Array>(),
        onError: (cause) => cause,
      }),
    ),
  );
  return Stream.unwrap(body).pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filter((line) => line.startsWith(dataPrefix)),
    Stream.map((line) => line.slice(dataPrefix.length)),
  );
}

function state(served: Served): Effect.Effect<typeof AppState.Type, unknown> {
  return Stream.runHead(lines(served)).pipe(
    Effect.map((first) => Option.getOrElse(first, () => "")),
    Effect.flatMap((line) => decodeState(line)),
  );
}

function settled(served: Served, entries: number): Effect.Effect<typeof AppState.Type, unknown> {
  return state(served).pipe(
    Effect.repeat({
      schedule: Schedule.spaced("100 millis"),
      until: ({ chat }) => !chat.busy && chat.entries.length >= entries,
    }),
  );
}

function exchange(
  served: Served,
  text: string,
  entries: number,
): Effect.Effect<typeof AppState.Type, unknown> {
  return send(served, post("/api/chat", { text })).pipe(Effect.andThen(settled(served, entries)));
}

function finishedWork(directory: string): Effect.Effect<void, unknown, NodeServices.NodeServices> {
  return Effect.gen(function* finished() {
    const worker = { actor: "w-1", directory };
    yield* createLedger(directory);
    const { id } = yield* bd(worker, ["create", "A"], Created);
    yield* bd(worker, ["update", id, "--claim"], Schema.Unknown);
    yield* bd(worker, ["update", id, "--add-label", "needs-review"], Schema.Unknown);
  });
}

function calls(
  served: Served,
): Effect.Effect<readonly (typeof Call.Type)[], unknown, NodeServices.NodeServices> {
  return Effect.gen(function* recorded() {
    const files = yield* FileSystem.FileSystem;
    const text = yield* files.readFileString(`${served.home}/calls.jsonl`);
    return yield* Effect.forEach(text.trim().split("\n"), (line) => decodeCall(line));
  });
}

function turnArguments(session: readonly [string, string], systemPrompt: string): string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    ...session,
    "--system-prompt-snapshot",
    "off",
    "--append-system-prompt",
    systemPrompt,
    "--tools",
    "Bash,Read,Grep,Glob",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--disable-slash-commands",
    "--permission-mode",
    "dontAsk",
    "--allowedTools",
    "Bash(bd *)",
    `Bash(${bundledAssets}/commander/scripts/*)`,
    `Bash(BEADS_ACTOR=commander ${bundledAssets}/commander/scripts/*)`,
    `Bash(WORKER_MODEL=haiku ${bundledAssets}/commander/scripts/dispatch.sh *)`,
    `Bash(WORKER_MODEL=sonnet ${bundledAssets}/commander/scripts/dispatch.sh *)`,
    `Bash(WORKER_MODEL=opus ${bundledAssets}/commander/scripts/dispatch.sh *)`,
    "Bash(claude agents *)",
    "Bash(claude --bg *)",
    "Bash(jq *)",
    "Read",
    "Grep",
    "Glob",
  ];
}

it.live(
  "the first message already reaches the commander, and later messages resume the same session",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      yield* exchange(served, "今どうなってる？", oneExchange);
      const { chat } = yield* exchange(served, "続けて", twoExchanges);
      const [first, second] = yield* calls(served);
      const sessionId = first?.argv[sessionIdPosition] ?? "";
      const systemPrompt = first?.argv[systemPromptPosition] ?? "";
      assert.match(sessionId, uuid);
      assert.deepStrictEqual(
        [first, second],
        [
          {
            actor: "commander",
            argv: turnArguments(["--session-id", sessionId], systemPrompt),
            billed: [],
            cwd: served.directory,
            repository: [],
            stdin: "今どうなってる？",
          },
          {
            actor: "commander",
            argv: turnArguments(["--resume", sessionId], systemPrompt),
            billed: [],
            cwd: served.directory,
            repository: [],
            stdin: "続けて",
          },
        ],
      );
      assert.deepStrictEqual(chat.entries, [
        { body: { kind: "user", text: "今どうなってる？" }, id: 0 },
        { body: { kind: "commander", text: "了解" }, id: 1 },
        { body: { kind: "user", text: "続けて" }, id: 2 },
        { body: { kind: "commander", text: "了解" }, id: 3 },
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.live(
  "the commander prompt is the bundled skill with every path pointing into the bundled assets",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      yield* exchange(served, "x", oneExchange);
      const [first] = yield* calls(served);
      const systemPrompt = first?.argv[systemPromptPosition] ?? "";
      assert.include(systemPrompt, "# commander（司令塔）");
      assert.include(systemPrompt, `${bundledAssets}/commander/scripts/status.sh`);
      assert.include(
        systemPrompt,
        `claude --bg --name coordinator-project-state --model sonnet "${served.home}/state/coordinator.md を読んで`,
      );
      assert.include(systemPrompt, 'select(.name == "coordinator-project-state")');
      assert.notInclude(systemPrompt, ".claude/skills/");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "chat accepts only a text, so no mode or role can be chosen by the caller",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      const statuses = yield* Effect.forEach(
        [
          post("/api/chat", { mode: "worker", text: "x" }),
          post("/api/chat", { text: "" }),
          post("/api/chat", { text: "x" }, "https://other.example.test"),
        ],
        (request) => send(served, request),
      );
      assert.deepStrictEqual(statuses, [badRequest, badRequest, forbidden]);
      const files = yield* FileSystem.FileSystem;
      assert.isFalse(yield* files.exists(`${served.home}/calls.jsonl`));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "the reply streams to a connected viewer while the turn is running",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      const connected = yield* Deferred.make<boolean>();
      const watching = lines(served).pipe(
        Stream.tap(() => Deferred.succeed(connected, true)),
        Stream.flatMap((line) => Stream.fromIterable(Option.toArray(decodeChat(line)))),
        Stream.takeUntil(({ change }) => change.type === "busy" && !change.busy),
        Stream.runCollect,
      );
      const watcher = yield* Effect.forkChild(watching);
      yield* Deferred.await(connected);
      const status = yield* send(served, post("/api/chat", { text: "README に 1 行足しといて" }));
      assert.strictEqual(status, accepted);
      assert.deepStrictEqual(yield* Fiber.join(watcher), [
        {
          change: { entry: { kind: "user", text: "README に 1 行足しといて" }, type: "entry" },
          version: 1,
        },
        { change: { busy: true, type: "busy" }, version: 2 },
        { change: { text: "了解", type: "delta" }, version: 3 },
        { change: { busy: false, type: "busy" }, version: 4 },
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.live(
  "messages typed ahead wait their turn, so each reply follows its own message",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      yield* send(served, post("/api/chat", { text: "1 つ目" }));
      const { chat } = yield* exchange(served, "2 つ目", twoExchanges);
      assert.deepStrictEqual(
        chat.entries.map(({ body }) => body),
        [
          { kind: "user", text: "1 つ目" },
          { kind: "commander", text: "了解" },
          { kind: "user", text: "2 つ目" },
          { kind: "commander", text: "了解" },
        ],
      );
      assert.deepStrictEqual(chat.queued, []);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect("a viewer that already has a change ignores its replay and applies only newer ones", () =>
  Effect.sync(() => {
    const seen = applyChat(
      { busy: false, entries: [], queued: [], version: 0 },
      { text: "了", type: "delta" },
    );
    const replayed = receiveChat(seen, { change: { text: "了", type: "delta" }, version: 1 });
    const next = receiveChat(replayed, { change: { text: "解", type: "delta" }, version: 2 });
    assert.deepStrictEqual(next, {
      busy: false,
      entries: [{ body: { kind: "commander", text: "了解" }, id: 0 }],
      queued: [],
      version: 2,
    });
  }),
);

it.live(
  "finished work wakes the commander without anyone typing, once per bead",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve(finishedWork);
      const { chat, tasks } = yield* settled(served, oneExchange);
      const id = tasks?.review[0]?.id ?? "";
      assert.deepStrictEqual(
        chat.entries.map(({ body }) => body),
        [
          { kind: "notice", notice: "woken" },
          { kind: "commander", text: "了解" },
        ],
      );
      yield* exchange(served, "ただいま", twoExchanges);
      const stdins = (yield* calls(served)).map(({ stdin }) => stdin);
      const briefed = `（アプリが見ている台帳の現況: レビュー待ち ${id}。`;
      assert.deepStrictEqual(
        stdins.map((stdin) => [
          stdin.startsWith(briefed),
          stdin.includes("アプリの見張りからの呼び出し"),
          stdin.endsWith("\n\nただいま"),
        ]),
        [
          [true, true, false],
          [true, false, true],
        ],
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);

it.effect(
  "a request that names another host is refused before it can read the conversation",
  () =>
    Effect.gen(function* program() {
      const served = yield* serve();
      const foreign = new Request(`${origin}/api/events`, { headers: { host: "evil.example" } });
      const local = new Request(`${origin}/api/events`, { headers: { host: "localhost:3090" } });
      assert.strictEqual(yield* send(served, foreign), forbidden);
      assert.strictEqual(yield* send(served, local), ok);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);
