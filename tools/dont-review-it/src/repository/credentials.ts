import { readFile } from "node:fs/promises";
import path from "node:path";

import { secretsFile, secretsFileConfigured } from "@repo/config/deployment";
import { Effect, Schema } from "effect";

import { deploymentValues, type DeploymentValue } from "./secrets.ts";

const NOT_FOUND = "ENOENT";

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

const errorCode = (error: unknown): string | undefined => {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
};

const unavailable = (
  reason: CredentialsUnavailable["reason"],
): ((error: unknown) => CredentialsUnavailable) => {
  return (error) => new CredentialsUnavailable({ code: errorCode(error), reason });
};

const projectName = (root: string): Effect.Effect<string, CredentialsUnavailable> => {
  const manifest = Effect.tryPromise({
    catch: unavailable("manifest-unreadable"),
    try: async () => readFile(path.join(root, "package.json"), "utf-8"),
  });
  return manifest.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Manifest)),
    Effect.mapError(unavailable("manifest-unreadable")),
    Effect.map(({ name }) => name),
  );
};

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
): Effect.Effect<DeploymentCredentials, CredentialsUnavailable> => {
  const contents = Effect.tryPromise({
    catch: unavailable("credentials-unreadable"),
    try: async () => readFile(filename, "utf-8"),
  });
  return contents.pipe(
    Effect.flatMap(scannable),
    Effect.catchIf(
      (failure) =>
        failure.reason === "credentials-unreadable" &&
        failure.code === NOT_FOUND &&
        !secretsFileConfigured(),
      () => Effect.succeed(absent),
    ),
  );
};

const deploymentCredentials = Effect.fn("deploymentCredentials")(function* deploymentCredentials(
  root: string,
) {
  const name = yield* projectName(root);
  return yield* readCredentials(secretsFile(name));
});

export { deploymentCredentials };
