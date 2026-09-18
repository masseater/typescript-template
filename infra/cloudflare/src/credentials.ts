import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

import { deploymentKeys, secretsFile } from "@template/config/deployment";
import { Effect, Schema } from "effect";

import { projectName } from "./project.ts";

import type { FileHandle } from "node:fs/promises";

const GROUP_AND_OTHER_PERMISSIONS = 0o077;
const KEY_PATTERN = /^\s*(?:export\s+)?(?<key>[A-Za-z_][A-Za-z0-9_]*)\s*=/u;

const closeHandle = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  handle: FileHandle,
): Effect.Effect<void> => {
  return Effect.tryPromise(async () => handle.close()).pipe(Effect.ignore);
};

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

const failure = (code: SecretsFileFailure["code"]): (() => SecretsFileFailure) => {
  return () => new SecretsFileFailure({ code, keys: [] });
};

const readOwnerOnly = Effect.fn("readOwnerOnly")(function* readOwnerOnly(handle: FileHandle) {
  const metadata = yield* Effect.tryPromise({
    catch: failure("secrets_file_unreadable"),
    try: async () => handle.stat(),
  });
  if (
    !metadata.isFile() ||
    metadata.nlink !== 1 ||
    (metadata.mode & GROUP_AND_OTHER_PERMISSIONS) !== 0
  ) {
    return yield* Effect.fail(
      new SecretsFileFailure({ code: "secrets_file_readable_by_others", keys: [] }),
    );
  }
  return yield* Effect.tryPromise({
    catch: failure("secrets_file_unreadable"),
    try: async () => handle.readFile("utf-8"),
  });
});

const declaredKeys = (contents: string): ReadonlySet<string> => {
  return new Set(
    contents.split("\n").flatMap((line) => {
      const key = KEY_PATTERN.exec(line)?.groups?.key;
      return key === undefined ? [] : [key];
    }),
  );
};

const verifySecretsFile = Effect.fn("verifySecretsFile")(function* verifySecretsFile(
  filename: string,
) {
  const directory = yield* Effect.tryPromise({
    catch: failure("secrets_file_missing"),
    try: async () => lstat(path.dirname(filename)),
  });
  if (!directory.isDirectory()) {
    return yield* Effect.fail(
      new SecretsFileFailure({ code: "secrets_file_symlink_forbidden", keys: [] }),
    );
  }
  const contents = yield* Effect.acquireUseRelease(
    Effect.tryPromise({
      catch: (cause) =>
        cause instanceof Error && "code" in cause && cause.code === "ELOOP"
          ? new SecretsFileFailure({ code: "secrets_file_symlink_forbidden", keys: [] })
          : new SecretsFileFailure({ code: "secrets_file_missing", keys: [] }),

      try: async () => open(filename, constants.O_RDONLY | constants.O_NOFOLLOW),
    }),
    readOwnerOnly,
    closeHandle,
  );
  const declared = declaredKeys(contents);
  const missing = deploymentKeys.filter((key) => !declared.has(key));
  if (missing.length > 0) {
    return yield* Effect.fail(
      new SecretsFileFailure({ code: "secrets_file_incomplete", keys: missing }),
    );
  }
  return { contents, filename };
});

const verifiedSecrets = Effect.fn("verifiedSecrets")(function* verifiedSecrets() {
  return yield* verifySecretsFile(secretsFile(yield* projectName));
});

type DeploymentSecrets = Readonly<Effect.Success<ReturnType<typeof verifiedSecrets>>>;

export { verifiedSecrets, verifySecretsFile };
export type { DeploymentSecrets };
