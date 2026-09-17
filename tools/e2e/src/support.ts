import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Cause, Effect, Schema } from "effect";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const mailpit = "http://127.0.0.1:8025";

export class E2eFailure extends Schema.TaggedError<E2eFailure>()("E2eFailure", {
  code: Schema.String,
}) {
  override get message() {
    return this.code;
  }
}

class StageFailure extends Schema.TaggedError<StageFailure>()("StageFailure", {
  message: Schema.String,
}) {}

export const fail = (code: string) => Effect.fail(new E2eFailure({ code }));

export const ensure = (condition: unknown, code: string): Effect.Effect<void, E2eFailure> =>
  condition ? Effect.void : fail(code);

const UnknownRecord = Schema.Record(Schema.String, Schema.Unknown);

export const object = (input: unknown) =>
  Schema.decodeUnknownEffect(UnknownRecord)(input).pipe(
    Effect.mapError(() => new E2eFailure({ code: "E2E_INVALID_OBJECT_RESPONSE" })),
  );

export const string = (input: unknown) =>
  Schema.decodeUnknownEffect(Schema.String)(input).pipe(
    Effect.mapError(() => new E2eFailure({ code: "E2E_INVALID_STRING_RESPONSE" })),
  );

export const field = Effect.fn("field")(function* (input: unknown, ...keys: readonly string[]) {
  let current = input;
  for (const key of keys) current = (yield* object(current))[key];
  return current;
});

export const parseJson = (text: string, code: string) =>
  Effect.try({ try: (): unknown => JSON.parse(text), catch: () => new E2eFailure({ code }) });

export function safeFailure(error: unknown, stage: string): StageFailure {
  if (error instanceof Error && /^E2E_[A-Z0-9_]+$/.test(error.message))
    return new StageFailure({ message: `${error.message}; stage=${stage}` });
  const source = Cause.isUnknownError(error) ? error.cause : error;
  const kind =
    source instanceof Error && /^[A-Za-z]{1,40}$/.test(source.name) ? source.name : "Unknown";
  const frame =
    source instanceof Error
      ? source.stack
          ?.match(/\/tools\/e2e\/src\/([a-z.-]+\.ts):(\d+)/)
          ?.slice(1, 3)
          .join(":")
      : undefined;
  return new StageFailure({
    message: `E2E_OPERATION_FAILED; stage=${stage}; error=${kind}${frame ? `; at=${frame}` : ""}`,
  });
}

export const staged =
  (stage: () => string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.catchCause((cause) => Effect.fail(safeFailure(Cause.squash(cause), stage()))),
    );

export const run = (
  command: string,
  args: readonly string[],
  input = "",
  timeout = 60_000,
  environment: Readonly<Record<string, string>> = {},
) =>
  Effect.callback<string, E2eFailure>((resume) => {
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
    let settled = false;
    const failure = () => {
      settled = true;
      resume(
        fail(
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
      if (code === 0) {
        settled = true;
        resume(Effect.succeed(output));
      } else failure();
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
    return Effect.sync(() => {
      clearTimeout(timer);
      if (!settled) child.kill("SIGTERM");
    });
  });

export const poll = Effect.fn("poll")(function* <A, E, R>(
  read: Effect.Effect<A, E, R>,
  accept: (value: A) => boolean,
  code: string,
  timeout = 30_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = yield* read;
    if (accept(value)) return value;
    yield* Effect.sleep(250);
  }
  return yield* fail(code);
});

export const fetchResponse = (
  url: string,
  { timeout, ...init }: Omit<RequestInit, "signal"> & { readonly timeout: number },
) =>
  Effect.tryPromise((signal) =>
    fetch(url, { ...init, signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) }),
  );

export const json = Effect.fn("json")(function* (url: string, init: RequestInit = {}) {
  const response = yield* fetchResponse(url, {
    ...init,
    timeout: 10_000,
    redirect: "error",
  });
  yield* ensure(response.ok, "E2E_SERVICE_HTTP_ERROR");
  return yield* Effect.tryPromise((): Promise<unknown> => response.json());
});

export function shellQuote(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

export const decodeBrowserBatch = Effect.fn("decodeBrowserBatch")(function* (input: string) {
  const parsed = yield* parseJson(input, "E2E_BROWSER_INVALID_JSON");
  if (!Array.isArray(parsed)) return yield* fail("E2E_BROWSER_INVALID_BATCH");
  return yield* Effect.forEach(parsed, (item: unknown) =>
    Effect.gen(function* () {
      const result = yield* object(item);
      yield* ensure(result["success"] === true, "E2E_BROWSER_COMMAND_FAILED");
      return yield* object(result["result"]);
    }),
  );
});
