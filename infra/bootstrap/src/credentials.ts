import { constants } from "node:fs";
import { chmod, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Effect, Schema } from "effect";
import { BootstrapFailure, fail, parseCredentials } from "./config.ts";

class CredentialsAbsent extends Schema.TaggedError<CredentialsAbsent>()("CredentialsAbsent", {}) {}

const failure = (code: BootstrapFailure["code"]) => () => new BootstrapFailure({ code });

export const prepareStateDirectory = Effect.fn("prepareStateDirectory")(function* (
  directory: string,
) {
  const unavailable = failure("state_directory_unavailable");
  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true, mode: 0o700 }),
    catch: unavailable,
  });
  const resolved = yield* Effect.tryPromise({ try: () => realpath(directory), catch: unavailable });
  if (resolved !== path.resolve(directory)) return yield* fail("state_directory_symlink_forbidden");
  yield* Effect.tryPromise({ try: () => chmod(directory, 0o700), catch: unavailable });
});

const readable = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (error) =>
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? new CredentialsAbsent()
        : new BootstrapFailure({ code: "state_credentials_unreadable" }),
  });

export const readCredentials = Effect.fn("readCredentials")(
  function* (filename: string) {
    const unreadable = failure("state_credentials_unreadable");
    const directory = path.dirname(filename);
    if ((yield* readable(() => realpath(directory))) !== path.resolve(directory))
      return yield* Effect.fail(unreadable());
    return yield* Effect.acquireUseRelease(
      readable(() => open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)),
      (handle) =>
        Effect.gen(function* () {
          const metadata = yield* readable(() => handle.stat());
          if (!metadata.isFile() || metadata.nlink !== 1 || (metadata.mode & 0o077) !== 0)
            return yield* Effect.fail(unreadable());
          const text = yield* readable(() => handle.readFile("utf8"));
          const input = yield* Effect.try({
            try: (): unknown => JSON.parse(text),
            catch: unreadable,
          });
          return yield* parseCredentials(input).pipe(Effect.mapError(unreadable));
        }),
      (handle) => Effect.tryPromise(() => handle.close()).pipe(Effect.ignore),
    );
  },
  Effect.catchTag("CredentialsAbsent", () => Effect.succeed(undefined)),
);

export const writeCredentials = Effect.fn("writeCredentials")(function* (
  filename: string,
  input: unknown,
) {
  const writeFailed = failure("state_credentials_write_failed");
  const credentials = yield* parseCredentials(input);
  yield* prepareStateDirectory(path.dirname(filename));
  const temporary = `${filename}.${randomUUID()}.tmp`;
  yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () =>
        open(
          temporary,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        ),
      catch: writeFailed,
    }),
    (handle) =>
      Effect.tryPromise({
        try: async () => {
          await handle.writeFile(JSON.stringify(credentials));
          await handle.sync();
        },
        catch: writeFailed,
      }),
    (handle) => Effect.tryPromise(() => handle.close()).pipe(Effect.ignore),
  );
  yield* Effect.tryPromise({ try: () => rename(temporary, filename), catch: writeFailed }).pipe(
    Effect.tapError(() => Effect.tryPromise(() => unlink(temporary)).pipe(Effect.ignore)),
  );
});
