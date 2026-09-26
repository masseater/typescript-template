import { secretsFile, secretsFileConfigured } from "@repo/infra-cloudflare/deployment";
import { Effect, FileSystem, Option, Path, PlatformError, Schema } from "effect";

import { failureCodeOf, isMissingPath } from "../platform/path-failure.ts";
import { deploymentValues, type DeploymentValue } from "./secrets.ts";

const Manifest = Schema.fromJsonString(Schema.Struct({ name: Schema.String }));

interface DeploymentCredentials {
  readonly source: "absent" | "file";
  readonly values: readonly DeploymentValue[];
}

class CredentialsUnavailable extends Schema.TaggedError<CredentialsUnavailable>()(
  "CredentialsUnavailable",
  {
    code: Schema.optional(Schema.String),
    reason: Schema.Literals([
      "credentials-unreadable",
      "credentials-without-values",
      "manifest-unreadable",
    ]),
  },
) {
  public get report(): Readonly<Record<string, unknown>> {
    return this.code === undefined
      ? { reason: this.reason }
      : { code: this.code, reason: this.reason };
  }
}

const errorCode = (error: unknown): string | undefined =>
  failureCodeOf(error instanceof PlatformError.PlatformError ? error.reason.cause : error) ??
  undefined;

const unavailable =
  (reason: CredentialsUnavailable["reason"]): ((error: unknown) => CredentialsUnavailable) =>
  (error) =>
    new CredentialsUnavailable({ code: errorCode(error), reason });

const projectName = (
  root: string,
): Effect.Effect<string, CredentialsUnavailable, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* projectName() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const manifestText = yield* filesystem.readFileString(paths.join(root, "package.json"));
    const { name } = yield* Schema.decodeEffect(Manifest)(manifestText);
    return name;
  }).pipe(Effect.mapError(unavailable("manifest-unreadable")));

const scannable = (
  contents: string,
): Effect.Effect<DeploymentCredentials, CredentialsUnavailable> => {
  const values = deploymentValues(contents);
  return values.length === 0
    ? Effect.fail(new CredentialsUnavailable({ reason: "credentials-without-values" }))
    : Effect.succeed({ source: "file", values });
};

const absent: DeploymentCredentials = { source: "absent", values: [] };

const readCredentials = (
  filename: string,
): Effect.Effect<DeploymentCredentials, CredentialsUnavailable, FileSystem.FileSystem> =>
  Effect.gen(function* credentialsText() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* filesystem.readFileString(filename);
  }).pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => isMissingPath(error) && !secretsFileConfigured(),
      () => Effect.succeedNone,
    ),
    Effect.mapError(unavailable("credentials-unreadable")),
    Effect.flatMap(Option.match({ onNone: () => Effect.succeed(absent), onSome: scannable })),
  );

const deploymentCredentials = Effect.fn("deploymentCredentials")(function* deploymentCredentials(
  root: string,
) {
  const name = yield* projectName(root);
  return yield* readCredentials(secretsFile(name));
});

export { deploymentCredentials };
