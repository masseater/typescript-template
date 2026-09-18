import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Stream } from "effect";

import { runTurn } from "./claude.ts";

const executableMode = 0o755;
const sessionId = "11111111-1111-4111-8111-111111111111";
const failedExit = 1;

const replay = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const home = path.dirname(process.argv[1]);
process.stdout.write(fs.readFileSync(path.join(home, "stdout"), "utf8"));
process.exitCode = Number(fs.readFileSync(path.join(home, "exit"), "utf8"));
`;

function replayed(
  lines: readonly unknown[],
  exitCode: number,
): Effect.Effect<readonly unknown[], unknown, NodeServices.NodeServices> {
  return Effect.gen(function* program() {
    const files = yield* FileSystem.FileSystem;
    const home = yield* files.makeTempDirectoryScoped({ prefix: "commander-claude-" });
    const stdout = lines.map(
      (line) => `${typeof line === "string" ? line : JSON.stringify(line)}\n`,
    );
    yield* files.writeFileString(`${home}/claude`, replay);
    yield* files.chmod(`${home}/claude`, executableMode);
    yield* files.writeFileString(`${home}/stdout`, stdout.join(""));
    yield* files.writeFileString(`${home}/exit`, String(exitCode));
    const events = runTurn({
      cwd: home,
      executable: `${home}/claude`,
      first: true,
      model: undefined,
      prompt: "今どうなってる？",
      scripts: `${home}/scripts`,
      sessionId,
      systemPrompt: "司令塔",
    });
    return yield* Stream.runCollect(events);
  }).pipe(Effect.scoped);
}

it.effect(
  "the session start and text deltas are kept, and lines outside the contract are ignored",
  () =>
    Effect.gen(function* program() {
      const events = yield* replayed(
        [
          { hook_name: "SessionStart:startup", subtype: "hook_started", type: "system" },
          {
            apiKeySource: "none",
            cwd: "/project",
            mcp_servers: [],
            model: "claude-haiku-4-5-20251001",
            permissionMode: "dontAsk",
            session_id: sessionId,
            subtype: "init",
            tools: ["Bash", "Glob", "Grep", "Read"],
            type: "system",
          },
          { event: { message: { content: [] }, type: "message_start" }, type: "stream_event" },
          {
            event: { delta: { text: "いま", type: "text_delta" }, type: "content_block_delta" },
            type: "stream_event",
          },
          {
            event: {
              delta: { partial_json: "{", type: "input_json_delta" },
              type: "content_block_delta",
            },
            type: "stream_event",
          },
          { rate_limit_info: { status: "allowed" }, type: "rate_limit_event" },
          { is_error: false, num_turns: 1, permission_denials: [], result: "いま", type: "result" },
        ],
        0,
      );
      assert.deepStrictEqual(events, [
        {
          cwd: "/project",
          mcpServers: [],
          model: "claude-haiku-4-5-20251001",
          sessionId,
          tools: ["Bash", "Glob", "Grep", "Read"],
          type: "init",
        },
        { text: "いま", type: "text" },
        { denials: [], isError: false, numTurns: 1, type: "done" },
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("tool calls, their results and refused operations are reported", () =>
  Effect.gen(function* program() {
    const call = {
      caller: { type: "direct" },
      id: "toolu_01",
      input: { command: "bd ready --json" },
      name: "Bash",
      type: "tool_use",
    };
    const outcome = {
      content: "[]",
      is_error: false,
      tool_use_id: "toolu_01",
      type: "tool_result",
    };
    const denial = { tool_input: { command: "echo x > y" }, tool_name: "Bash", tool_use_id: "t2" };
    const events = yield* replayed(
      [
        {
          message: { content: [{ signature: "x", thinking: "", type: "thinking" }] },
          type: "assistant",
        },
        { message: { content: [call] }, type: "assistant" },
        { message: { content: [outcome], role: "user" }, type: "user" },
        { message: { content: [{ text: "ok", type: "text" }] }, type: "assistant" },
        {
          is_error: false,
          num_turns: 2,
          permission_denials: [denial],
          result: "ok",
          type: "result",
        },
      ],
      0,
    );
    assert.deepStrictEqual(events, [
      { id: "toolu_01", input: { command: "bd ready --json" }, name: "Bash", type: "tool" },
      { id: "toolu_01", isError: false, type: "toolResult" },
      {
        denials: [{ input: { command: "echo x > y" }, toolName: "Bash" }],
        isError: false,
        numTurns: 2,
        type: "done",
      },
    ]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("a resume of a session that no longer exists ends as an error with zero turns", () =>
  Effect.gen(function* program() {
    const result = {
      errors: [`No conversation found with session ID: ${sessionId}`],
      is_error: true,
      num_turns: 0,
      permission_denials: [],
      session_id: sessionId,
      subtype: "error_during_execution",
      type: "result",
    };
    const events = yield* replayed([result], failedExit);
    assert.deepStrictEqual(events, [{ denials: [], isError: true, numTurns: 0, type: "done" }]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("a broken line and an exit without a result become typed failures", () =>
  Effect.gen(function* program() {
    const events = yield* replayed(['{"type":"assistant","message":', "not json"], failedExit);
    assert.deepStrictEqual(events, [
      { reason: "output_invalid", type: "failed" },
      { reason: "output_invalid", type: "failed" },
      { reason: "process_failed", type: "failed" },
    ]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("a contracted line whose shape changed is reported instead of being dropped", () =>
  Effect.gen(function* program() {
    const events = yield* replayed([{ is_error: "no", type: "result" }], 0);
    assert.deepStrictEqual(events, [
      { reason: "output_invalid", type: "failed" },
      { reason: "process_failed", type: "failed" },
    ]);
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("an executable that cannot be started becomes a typed failure", () =>
  Effect.gen(function* program() {
    const events = yield* Stream.runCollect(
      runTurn({
        cwd: "/",
        executable: "/nonexistent/commander-claude",
        first: true,
        model: undefined,
        prompt: "x",
        scripts: "/scripts",
        sessionId,
        systemPrompt: "司令塔",
      }),
    );
    assert.deepStrictEqual(events, [{ reason: "spawn_failed", type: "failed" }]);
  }).pipe(Effect.provide(NodeServices.layer)),
);
