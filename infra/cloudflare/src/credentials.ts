import { parseEnv } from "node:util";

import { deploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, FileSystem, Option, Path, Schema } from "effect";

import { secretsFile } from "./deployment.ts";
import { isNotFound, layer } from "./platform.ts";
import { projectName } from "./project.ts";
import { modeAllowsGroupOrOther } from "./unix-permission-bits.ts";

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

function missing(): SecretsFileFailure {
  return new SecretsFileFailure({ code: "secrets_file_missing", keys: [] });
}

function unreadable(): SecretsFileFailure {
  return new SecretsFileFailure({ code: "secrets_file_unreadable", keys: [] });
}

function symlinkForbidden(): SecretsFileFailure {
  return new SecretsFileFailure({ code: "secrets_file_symlink_forbidden", keys: [] });
}

const verifySecretsFile = Effect.fn("verifySecretsFile")(function* verifySecretsFile(
  filename: string,
) {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const directoryPath = paths.dirname(filename);
  const parentLinked = yield* filesystem.readLink(directoryPath).pipe(
    Effect.as(true),
    Effect.catch((error) => (isNotFound(error) ? missing() : Effect.succeed(false))),
  );
  if (parentLinked) {
    return yield* symlinkForbidden();
  }
  const directory = yield* filesystem.stat(directoryPath).pipe(Effect.mapError(missing));
  if (directory.type !== "Directory") {
    return yield* symlinkForbidden();
  }
  const fileLinked = yield* filesystem.readLink(filename).pipe(
    Effect.as(true),
    Effect.catch((error) => (isNotFound(error) ? missing() : Effect.succeed(false))),
  );
  if (fileLinked) {
    return yield* symlinkForbidden();
  }
  const metadata = yield* filesystem.stat(filename).pipe(Effect.mapError(unreadable));
  if (
    metadata.type !== "File" ||
    Option.getOrElse(metadata.nlink, () => 0) !== 1 ||
    modeAllowsGroupOrOther(metadata.mode)
  ) {
    return yield* new SecretsFileFailure({ code: "secrets_file_readable_by_others", keys: [] });
  }
  const contents = yield* filesystem.readFileString(filename).pipe(Effect.mapError(unreadable));
  const declared = declaredKeys(contents);
  const absent = deploymentKeys.filter((key) => !declared.has(key));
  if (absent.length > 0) {
    return yield* new SecretsFileFailure({ code: "secrets_file_incomplete", keys: absent });
  }
  return { contents, filename };
});

function verifiedSecrets(): Effect.Effect<
  { readonly contents: string; readonly filename: string },
  SecretsFileFailure
> {
  return Effect.gen(function* readVerifiedSecrets() {
    return yield* verifySecretsFile(secretsFile(yield* projectName));
  }).pipe(Effect.provide(layer));
}

function verifySecretsFileProvided(
  filename: string,
): Effect.Effect<{ readonly contents: string; readonly filename: string }, SecretsFileFailure> {
  return verifySecretsFile(filename).pipe(Effect.provide(layer));
}

type DeploymentSecrets = Readonly<Effect.Success<ReturnType<typeof verifiedSecrets>>>;

export { verifiedSecrets, verifySecretsFileProvided as verifySecretsFile };
export type { DeploymentSecrets };
