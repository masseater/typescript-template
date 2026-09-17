import { parse, record, string as stringSchema, unknown } from "valibot";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { requestTimeout } from "./http.ts";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const mailpit = "http://127.0.0.1:8025";
const grafana = "http://127.0.0.1:3100";
const privateDirectoryMode = 0o700;
const privateFileMode = 0o600;

const defaultSubprocessTimeout = 60_000;
const maximumSubprocessOutput = 4_000_000;
const pollInterval = 250;
const defaultPollTimeout = 30_000;
const failureFrame = /\/tools\/e2e\/src\/(?<file>[a-z.-]+\.ts):(?<line>\d+)/u;

function ensure(condition: boolean, code: string): asserts condition {
  if (!condition) {
    throw new Error(code);
  }
}

function object(input: unknown): Record<string, unknown> {
  ensure(
    typeof input === "object" && input !== null && !Array.isArray(input),
    "E2E_INVALID_OBJECT_RESPONSE",
  );
  return parse(record(stringSchema(), unknown()), input);
}

function string(input: unknown): string {
  ensure(typeof input === "string", "E2E_INVALID_STRING_RESPONSE");
  return input;
}

function failureLocation(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const groups = error.stack?.match(failureFrame)?.groups;
  return groups === undefined ? undefined : `${groups["file"]}:${groups["line"]}`;
}

function safeFailure(error: unknown, stage: string): Error {
  if (error instanceof Error && /^E2E_[A-Z0-9_]+$/u.test(error.message)) {
    return new Error(`${error.message}; stage=${stage}`);
  }
  const kind =
    error instanceof Error && /^[A-Za-z]{1,40}$/u.test(error.name) ? error.name : "Unknown";
  const frame = failureLocation(error);
  return new Error(
    `E2E_OPERATION_FAILED; stage=${stage}; error=${kind}${frame === undefined ? "" : `; at=${frame}`}`,
  );
}

interface RunOptions {
  readonly environment?: Readonly<Record<string, string>>;
  readonly input?: string;
  readonly timeout?: number;
}

function subprocessFailure(command: string): Error {
  const name = command
    .split("/")
    .at(-1)
    ?.replaceAll(/[^a-zA-Z0-9]+/gu, "_")
    .toUpperCase();
  return new Error(`E2E_SUBPROCESS_FAILED_${name ?? "COMMAND"}`);
}

function subprocessEnvironment(environment: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith("AGENT_BROWSER_")),
    ),
    ...environment,
    CI: "true",
    NO_COLOR: "1",
    WRANGLER_SEND_METRICS: "false",
  };
}

async function run(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<string> {
  const { promise, reject, resolve } = Promise.withResolvers<string>();
  const child = spawn(command, args, {
    cwd: root,
    env: subprocessEnvironment(options.environment ?? {}),
    stdio: ["pipe", "pipe", "ignore"],
  });
  let collected = "";
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
    reject(subprocessFailure(command));
  }, options.timeout ?? defaultSubprocessTimeout);
  child.stdout.setEncoding("utf-8").on("data", (chunk: string) => {
    collected += chunk;
    if (collected.length > maximumSubprocessOutput) {
      child.kill("SIGTERM");
      reject(subprocessFailure(command));
    }
  });
  child.once("error", () => {
    clearTimeout(timer);
    reject(subprocessFailure(command));
  });
  child.once("close", (code) => {
    clearTimeout(timer);
    if (code === 0) {
      resolve(collected);
    } else {
      reject(subprocessFailure(command));
    }
  });
  child.stdin
    .on("error", () => {
      reject(subprocessFailure(command));
    })
    .end(options.input ?? "");
  return promise;
}

interface PollOptions<Value> {
  readonly accept: (value: Value) => boolean;
  readonly code: string;
  readonly read: () => Value | Promise<Value>;
  readonly timeout?: number;
}

async function pollUntil<Value>(options: PollOptions<Value>, deadline: number): Promise<Value> {
  ensure(Date.now() < deadline, options.code);
  const value = await options.read();
  if (options.accept(value)) {
    return value;
  }
  await delay(pollInterval);
  return pollUntil(options, deadline);
}

async function poll<Value>(options: PollOptions<Value>): Promise<Value> {
  return pollUntil(options, Date.now() + (options.timeout ?? defaultPollTimeout));
}

interface JsonRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
}

async function json(url: string, init?: JsonRequest): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(requestTimeout.service),
  });
  ensure(response.ok, "E2E_SERVICE_HTTP_ERROR");
  return response.json();
}

async function inStage<Context, Result>(
  stage: string,
  action: (context: Context) => Promise<Result>,
  context: Context,
): Promise<Result> {
  try {
    return await action(context);
  } catch (error) {
    throw safeFailure(error, stage);
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("\\", String.raw`\\`).replaceAll("'", String.raw`\'`)}'`;
}

function parseBatch(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    throw new Error("E2E_BROWSER_INVALID_JSON");
  }
}

function decodeBrowserBatch(input: string): Record<string, unknown>[] {
  const parsed = parseBatch(input);
  ensure(Array.isArray(parsed), "E2E_BROWSER_INVALID_BATCH");
  return parsed.map((item: unknown) => {
    const result = object(item);
    ensure(result["success"] === true, "E2E_BROWSER_COMMAND_FAILED");
    return object(result["result"]);
  });
}

export {
  decodeBrowserBatch,
  ensure,
  grafana,
  inStage,
  json,
  mailpit,
  object,
  poll,
  privateDirectoryMode,
  privateFileMode,
  root,
  run,
  safeFailure,
  shellQuote,
  string,
};
