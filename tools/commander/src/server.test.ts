import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Option, Schedule, Schema, Stream } from "effect";
import type { Scope } from "effect";

import { AppState, ChatEvent } from "./contract.ts";
import { bundledAssets } from "./prompt.ts";
import { makeApp } from "./server.ts";
import { createLedger } from "./tasks.ts";

const origin = "http://127.0.0.1:3090";
const executableMode = 0o755;
const timeout = 120_000;
const accepted = 202;
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
  cwd: process.cwd(),
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
    cwd: Schema.String,
    stdin: Schema.String,
  }),
);
const decodeCall = Schema.decodeUnknownEffect(Call);
const decodeState = Schema.decodeUnknownEffect(Schema.fromJsonString(AppState));
const decodeChat = Schema.decodeUnknownOption(Schema.fromJsonString(ChatEvent));

interface Served {
  readonly directory: string;
  readonly fetch: (request: Request) => Promise<Response>;
  readonly home: string;
}

function serve(): Effect.Effect<Served, unknown, NodeServices.NodeServices | Scope.Scope> {
  return Effect.gen(function* served() {
    const files = yield* FileSystem.FileSystem;
    const temporary = yield* files.makeTempDirectoryScoped({ prefix: "commander-" });
    const home = yield* files.realPath(temporary);
    const directory = `${home}/project`;
    yield* files.makeDirectory(directory);
    yield* files.writeFileString(`${home}/claude`, recorder);
    yield* files.chmod(`${home}/claude`, executableMode);
    yield* createLedger(directory);
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

function exchange(
  served: Served,
  text: string,
  entries: number,
): Effect.Effect<typeof AppState.Type, unknown> {
  const settled = state(served).pipe(
    Effect.repeat({
      schedule: Schedule.spaced("100 millis"),
      until: ({ chat }) => !chat.busy && chat.entries.length >= entries,
    }),
  );
  return send(served, post("/api/chat", { text })).pipe(Effect.andThen(settled));
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
    "--disable-slash-commands",
    "--permission-mode",
    "dontAsk",
    "--allowedTools",
    "Bash(bd *)",
    `Bash(${bundledAssets}/commander/scripts/*)`,
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
            cwd: served.directory,
            stdin: "今どうなってる？",
          },
          {
            actor: "commander",
            argv: turnArguments(["--resume", sessionId], systemPrompt),
            cwd: served.directory,
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
      assert.include(systemPrompt, `${served.home}/state/coordinator.md`);
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
        Stream.takeUntil((event) => event.type === "busy" && !event.busy),
        Stream.runCollect,
      );
      const watcher = yield* Effect.forkChild(watching);
      yield* Deferred.await(connected);
      const status = yield* send(served, post("/api/chat", { text: "README に 1 行足しといて" }));
      assert.strictEqual(status, accepted);
      assert.deepStrictEqual(yield* Fiber.join(watcher), [
        { entry: { kind: "user", text: "README に 1 行足しといて" }, type: "entry" },
        { busy: true, type: "busy" },
        { text: "了解", type: "delta" },
        { busy: false, type: "busy" },
      ]);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  timeout,
);
