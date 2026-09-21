import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, Schema } from "effect";

import { secretsFile } from "./deployment.ts";
import { projectName } from "./project.ts";
import { modeAllowsGroupOrOther, openFlagsReadOnlyNoFollow } from "./unix-permission-bits.ts";

import type { FileHandle } from "node:fs/promises";

function declaredKeys(contents: string): ReadonlySet<string> {
  return new Set(Object.keys(parseEnv(contents)));
}

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

function closeHandle(handle: FileHandle): Effect.Effect<void> {
  return Effect.tryPromise(async () => handle.close()).pipe(Effect.ignore);
}

const readOwnerOnly = Effect.fn("readOwnerOnly")(function* readOwnerOnly(handle: FileHandle) {
  const metadata = yield* Effect.tryPromise({
    catch: failure("secrets_file_unreadable"),
    try: async () => handle.stat(),
  });
  if (!metadata.isFile() || metadata.nlink !== 1 || modeAllowsGroupOrOther(metadata.mode)) {
    return yield* Effect.fail(
      new SecretsFileFailure({ code: "secrets_file_readable_by_others", keys: [] }),
    );
  }
  return yield* Effect.tryPromise({
    catch: failure("secrets_file_unreadable"),
    try: async () => handle.readFile("utf-8"),
  });
});

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
      try: async () =>
        open(filename, openFlagsReadOnlyNoFollow(constants.O_RDONLY, constants.O_NOFOLLOW)),
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
