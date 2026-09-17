import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import * as v from "valibot";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const mailpit = "http://127.0.0.1:8025";

export function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

export function object(input: unknown): Record<string, unknown> {
  ensure(
    typeof input === "object" && input !== null && !Array.isArray(input),
    "E2E_INVALID_OBJECT_RESPONSE",
  );
  return v.parse(v.record(v.string(), v.unknown()), input);
}

export function string(input: unknown): string {
  ensure(typeof input === "string", "E2E_INVALID_STRING_RESPONSE");
  return input;
}

export function safeFailure(error: unknown, stage: string): Error {
  if (error instanceof Error && /^E2E_[A-Z0-9_]+$/.test(error.message))
    return new Error(`${error.message}; stage=${stage}`);
  const kind =
    error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : "Unknown";
  const frame =
    error instanceof Error
      ? error.stack
          ?.match(/\/tools\/e2e\/src\/([a-z.-]+\.ts):(\d+)/)
          ?.slice(1, 3)
          .join(":")
      : undefined;
  return new Error(
    `E2E_OPERATION_FAILED; stage=${stage}; error=${kind}${frame ? `; at=${frame}` : ""}`,
  );
}

export async function run(
  command: string,
  args: string[],
  input = "",
  timeout = 60_000,
  environment: Readonly<Record<string, string>> = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !name.startsWith("AGENT_BROWSER_")),
        ),
        ...environment,
        WRANGLER_SEND_METRICS: "false",
        CI: "true",
        NO_COLOR: "1",
      },
    });
    let output = "";
    const failure = () => {
      reject(
        new Error(
          `E2E_SUBPROCESS_FAILED_${
            command
              .split("/")
              .at(-1)
              ?.replace(/[^a-zA-Z0-9]+/g, "_")
              .toUpperCase() ?? "COMMAND"
          }`,
        ),
      );
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      failure();
    }, timeout);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > 4_000_000) {
        child.kill("SIGTERM");
        failure();
      }
    });
    child.stderr.on("data", () => undefined);
    child.once("error", () => {
      clearTimeout(timer);
      failure();
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else failure();
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

export async function poll<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  code: string,
  timeout = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    await delay(250);
  }
  throw new Error(code);
}

export async function json(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  ensure(response.ok, "E2E_SERVICE_HTTP_ERROR");
  return response.json();
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

export function decodeBrowserBatch(input: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("E2E_BROWSER_INVALID_JSON");
  }
  ensure(Array.isArray(parsed), "E2E_BROWSER_INVALID_BATCH");
  return parsed.map((item: unknown) => {
    const result = object(item);
    ensure(result["success"] === true, "E2E_BROWSER_COMMAND_FAILED");
    return object(result["result"]);
  });
}
