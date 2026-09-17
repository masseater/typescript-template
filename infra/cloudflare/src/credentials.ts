import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { open, realpath } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import type { FileHandle } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { constants } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import { homedir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { settingsKeys } from "./settings.ts";

const GROUP_AND_OTHER_PERMISSIONS = 0o077;
const ENVIRONMENT_FILE_VARIABLE = "TEMPLATE_CLOUDFLARE_ENV_FILE";
const ENVIRONMENT_FILE_NAME = "cloudflare.env";
const KEY_PATTERN = /^\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=/u;

class SecretsFileFailure extends Schema.TaggedError<SecretsFileFailure>()("SecretsFileFailure", {
  code: Schema.Literals([
    "secrets_file_missing",
    "secrets_file_readable_by_others",
    "secrets_file_symlink_forbidden",
    "secrets_file_unreadable",
    "secrets_file_incomplete",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

function failure(code: SecretsFileFailure["code"]): () => SecretsFileFailure {
  return () => new SecretsFileFailure({ code, keys: [] });
}

function configurationHome(project: string): string {
  // oxlint-disable-next-line node/no-process-env
  const base = process.env["XDG_CONFIG_HOME"];
  return path.join(
    base === undefined || base === "" ? path.join(homedir(), ".config") : base,
    project,
  );
}

function secretsFile(project: string): string {
  // oxlint-disable-next-line node/no-process-env
  const configured = process.env[ENVIRONMENT_FILE_VARIABLE];
  return configured === undefined || configured === ""
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
}

function closeHandle(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  handle: FileHandle,
): Effect.Effect<void> {
  return Effect.tryPromise(async () => handle.close()).pipe(Effect.ignore);
}

const readDeclaredKeys = Effect.fn("readDeclaredKeys")(function* readDeclaredKeys(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  handle: FileHandle,
) {
  const metadata = yield* Effect.tryPromise({
    catch: failure("secrets_file_unreadable"),
    try: async () => handle.stat(),
  });
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1 ||
    // oxlint-disable-next-line no-bitwise
    (metadata.mode & GROUP_AND_OTHER_PERMISSIONS) !== 0
  ) {
    return yield* Effect.fail(
      new SecretsFileFailure({ code: "secrets_file_readable_by_others", keys: [] }),
    );
  }
  const text = yield* Effect.tryPromise({
    catch: failure("secrets_file_unreadable"),
    try: async () => handle.readFile("utf-8"),
  });
  return new Set(
    text.split("\n").flatMap((line) => {
      const key = KEY_PATTERN.exec(line)?.groups?.["key"];
      return key === undefined ? [] : [key];
    }),
  );
});

const readOwnerOnlySecretsFile = Effect.fn("readOwnerOnlySecretsFile")(
  function* readOwnerOnlySecretsFile(filename: string) {
    const directory = path.dirname(filename);
    const resolved = yield* Effect.tryPromise({
      catch: failure("secrets_file_missing"),
      try: async () => realpath(directory),
    });
    if (resolved !== path.resolve(directory)) {
      return yield* Effect.fail(
        new SecretsFileFailure({ code: "secrets_file_symlink_forbidden", keys: [] }),
      );
    }
    const declared = yield* Effect.acquireUseRelease(
      Effect.tryPromise({
        catch: (cause) =>
          cause instanceof Error && "code" in cause && cause.code === "ELOOP"
            ? new SecretsFileFailure({ code: "secrets_file_symlink_forbidden", keys: [] })
            : new SecretsFileFailure({ code: "secrets_file_missing", keys: [] }),
        // oxlint-disable-next-line no-bitwise
        try: async () => open(filename, constants.O_RDONLY | constants.O_NOFOLLOW),
      }),
      readDeclaredKeys,
      closeHandle,
    );
    const missing = settingsKeys.filter((key) => !declared.has(key));
    if (missing.length > 0) {
      return yield* Effect.fail(
        new SecretsFileFailure({ code: "secrets_file_incomplete", keys: missing }),
      );
    }
    return filename;
  },
);

export { readOwnerOnlySecretsFile, secretsFile };
