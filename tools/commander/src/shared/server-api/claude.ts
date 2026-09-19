import { Effect, Option, Ref, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { childEnvironment } from "./child-environment.ts";

interface Turn {
  readonly cwd: string;
  readonly executable: string;
  readonly first: boolean;
  readonly model: string | undefined;
  readonly prompt: string;
  readonly scripts: string;
  readonly sessionId: string;
  readonly systemPrompt: string;
}

type CommanderEvent =
  | {
      readonly cwd: string;
      readonly mcpServers: readonly unknown[];
      readonly model: string;
      readonly sessionId: string;
      readonly tools: readonly string[];
      readonly type: "init";
    }
  | { readonly text: string; readonly type: "text" }
  | { readonly id: string; readonly input: unknown; readonly name: string; readonly type: "tool" }
  | { readonly id: string; readonly isError: boolean; readonly type: "toolResult" }
  | {
      readonly denials: readonly { readonly input: unknown; readonly toolName: string }[];
      readonly isError: boolean;
      readonly numTurns: number;
      readonly type: "done";
    }
  | {
      readonly reason: "output_invalid" | "process_failed" | "spawn_failed";
      readonly type: "failed";
    };

const Init = Schema.Struct({
  cwd: Schema.String,
  mcp_servers: Schema.Array(Schema.Unknown),
  model: Schema.String,
  session_id: Schema.String,
  subtype: Schema.Literal("init"),
  tools: Schema.Array(Schema.String),
  type: Schema.Literal("system"),
});
const Delta = Schema.Struct({ text: Schema.String, type: Schema.Literal("text_delta") });
const BlockDelta = Schema.Struct({ delta: Delta, type: Schema.Literal("content_block_delta") });
const TextDelta = Schema.Struct({ event: BlockDelta, type: Schema.Literal("stream_event") });
const OtherBlock = Schema.Struct({ type: Schema.String });
const ToolUse = Schema.Struct({
  id: Schema.String,
  input: Schema.Unknown,
  name: Schema.String,
  type: Schema.Literal("tool_use"),
});
const AssistantBlocks = Schema.Array(Schema.Union([ToolUse, OtherBlock]));
const Assistant = Schema.Struct({
  message: Schema.Struct({ content: AssistantBlocks }),
  type: Schema.Literal("assistant"),
});
const ToolResult = Schema.Struct({
  is_error: Schema.optional(Schema.Boolean),
  tool_use_id: Schema.String,
  type: Schema.Literal("tool_result"),
});
const UserBlocks = Schema.Array(Schema.Union([ToolResult, OtherBlock]));
const User = Schema.Struct({
  message: Schema.Struct({ content: Schema.Union([Schema.String, UserBlocks]) }),
  type: Schema.Literal("user"),
});
const Result = Schema.Struct({
  is_error: Schema.Boolean,
  num_turns: Schema.Number,
  permission_denials: Schema.Array(
    Schema.Struct({ tool_input: Schema.Unknown, tool_name: Schema.String }),
  ),
  type: Schema.Literal("result"),
});
const Line = Schema.Union([Init, TextDelta, Assistant, User, Result]);
const Envelope = Schema.Struct({ subtype: Schema.optional(Schema.String), type: Schema.String });

const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));
const decodeLine = Schema.decodeUnknownOption(Line);
const decodeEnvelope = Schema.decodeUnknownOption(Envelope);
const contracted: ReadonlySet<string> = new Set(["assistant", "user", "result", "stream_event"]);
const invalid: readonly CommanderEvent[] = [{ reason: "output_invalid", type: "failed" }];
const processFailed: CommanderEvent = { reason: "process_failed", type: "failed" };
const spawnFailed: CommanderEvent = { reason: "spawn_failed", type: "failed" };

function translate(line: typeof Line.Type): readonly CommanderEvent[] {
  if (line.type === "system") {
    return [
      {
        cwd: line.cwd,
        mcpServers: line.mcp_servers,
        model: line.model,
        sessionId: line.session_id,
        tools: line.tools,
        type: "init",
      },
    ];
  }
  if (line.type === "stream_event") {
    return [{ text: line.event.delta.text, type: "text" }];
  }
  if (line.type === "assistant") {
    return line.message.content.flatMap((block) =>
      "id" in block ? [{ id: block.id, input: block.input, name: block.name, type: "tool" }] : [],
    );
  }
  if (line.type === "user") {
    return typeof line.message.content === "string"
      ? []
      : line.message.content.flatMap((block) =>
          "tool_use_id" in block
            ? [{ id: block.tool_use_id, isError: block.is_error === true, type: "toolResult" }]
            : [],
        );
  }
  return [
    {
      denials: line.permission_denials.map((denial) => ({
        input: denial.tool_input,
        toolName: denial.tool_name,
      })),
      isError: line.is_error,
      numTurns: line.num_turns,
      type: "done",
    },
  ];
}

function unrecognized(json: unknown): readonly CommanderEvent[] {
  const envelope = decodeEnvelope(json);
  if (Option.isNone(envelope)) {
    return invalid;
  }
  const { subtype, type } = envelope.value;
  return contracted.has(type) || (type === "system" && subtype === "init") ? invalid : [];
}

function read(text: string): readonly CommanderEvent[] {
  const json = parseJson(text);
  if (Option.isNone(json)) {
    return invalid;
  }
  const line = decodeLine(json.value);
  return Option.isSome(line) ? translate(line.value) : unrecognized(json.value);
}

const workerModels = ["haiku", "sonnet", "opus"] as const;
const billedCredentials: ReadonlySet<string> = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
]);

function allowedTools(scripts: string): readonly string[] {
  return [
    "Bash(bd *)",
    `Bash(${scripts}/*)`,
    `Bash(BEADS_ACTOR=commander ${scripts}/*)`,
    ...workerModels.map((model) => `Bash(WORKER_MODEL=${model} ${scripts}/dispatch.sh *)`),
    "Bash(claude agents *)",
    "Bash(claude --bg *)",
    "Bash(jq *)",
    "Read",
    "Grep",
    "Glob",
  ];
}

function turnArguments(turn: Turn): readonly string[] {
  return [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    turn.first ? "--session-id" : "--resume",
    turn.sessionId,
    "--system-prompt-snapshot",
    "off",
    "--append-system-prompt",
    turn.systemPrompt,
    "--tools",
    "Bash,Read,Grep,Glob",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--disable-slash-commands",
    "--permission-mode",
    "dontAsk",
    ...(turn.model === undefined ? [] : ["--model", turn.model]),
    "--allowedTools",
    ...allowedTools(turn.scripts),
  ];
}

function runTurn(
  turn: Turn,
): Stream.Stream<CommanderEvent, never, ChildProcessSpawner.ChildProcessSpawner> {
  const command = ChildProcess.make(turn.executable, turnArguments(turn), {
    cwd: turn.cwd,
    env: childEnvironment({ BEADS_ACTOR: "commander" }, billedCredentials),
    extendEnv: false,
    stderr: "inherit",
    stdin: Stream.encodeText(Stream.make(turn.prompt)),
  });
  const spawned = Effect.gen(function* spawned() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(command);
    const finished = yield* Ref.make(false);
    const events = handle.stdout.pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.filter((text) => text.trim() !== ""),
      Stream.flatMap((text) => Stream.fromIterable(read(text))),
      Stream.tap((event) => Ref.update(finished, (seen) => seen || event.type === "done")),
    );
    const exited = handle.exitCode.pipe(Effect.andThen(Ref.get(finished)));
    const ending = exited.pipe(Effect.map((seen) => (seen ? [] : [processFailed])));
    return Stream.concat(events, Stream.fromIterableEffect(ending));
  });
  return Stream.unwrap(spawned).pipe(Stream.orElseSucceed(() => spawnFailed));
}

export { runTurn };
export type { CommanderEvent };
