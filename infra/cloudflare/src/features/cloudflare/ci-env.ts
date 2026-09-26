import { deploymentKeys, optionalDeploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, FileSystem, Schema } from "effect";

import { layer, path } from "./platform.ts";

import type { inheritedEnvironment } from "@repo/config/process-environment";

const OWNER_ONLY_FILE_MODE = 0o600;
const APP_DOMAIN_KEY = "TEMPLATE_APP_DOMAIN";
const retiredKeys = [
  "TEMPLATE_SERVICE_MEMBER_ORIGIN",
  "TEMPLATE_SERVICE_ADMIN_ORIGIN",
  "TEMPLATE_INTERNAL_DASHBOARD_ORIGIN",
  "TEMPLATE_OTLP_ENABLED",
] as const;

class PrepareCiEnvFailure extends Schema.TaggedError<PrepareCiEnvFailure>()("PrepareCiEnvFailure", {
  code: Schema.Literals([
    "ci_env_incomplete",
    "ci_env_output_missing",
    "ci_env_retired_keys",
    "ci_env_unwritable",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

type Environment = ReturnType<typeof inheritedEnvironment>;

type CiEnvPreparation =
  | { readonly filename: string; readonly status: "ready" }
  | { readonly status: "unconfigured" };

function dotenvLine(key: string, value: string): string {
  return `${key}=${JSON.stringify(value)}`;
}

function presentRetiredKeys(environment: Environment): readonly string[] {
  return retiredKeys.filter((key) => environment[key] !== undefined);
}

function unwritable(): PrepareCiEnvFailure {
  return new PrepareCiEnvFailure({ code: "ci_env_unwritable", keys: [] });
}

const writeCiSecretsFile = Effect.fn("writeCiSecretsFile")(function* writeCiSecretsFile(
  environment: Environment,
  destination: string | undefined,
) {
  const required = deploymentKeys.map((key) => {
    const value = environment[key];
    return { key, value } as const;
  });
  const present = required.flatMap(({ key, value }) => (value === undefined ? [] : [key]));
  const missing = required.flatMap(({ key, value }) => (value === undefined ? [key] : []));
  const retired = presentRetiredKeys(environment);
  if (present.length === 0 && retired.length === 0) {
    return { status: "unconfigured" } as const satisfies CiEnvPreparation;
  }
  if (retired.length > 0) {
    return yield* new PrepareCiEnvFailure({
      code: "ci_env_retired_keys",
      keys: missing.includes(APP_DOMAIN_KEY) ? [APP_DOMAIN_KEY, ...retired] : [...retired],
    });
  }
  if (missing.length > 0) {
    return yield* new PrepareCiEnvFailure({ code: "ci_env_incomplete", keys: missing });
  }
  const lines = [
    ...required.flatMap(({ key, value }) => (value === undefined ? [] : [dotenvLine(key, value)])),
    ...optionalDeploymentKeys.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [dotenvLine(key, value)];
    }),
  ];
  const runnerTemp = environment["RUNNER_TEMP"];
  const filename =
    destination ??
    (runnerTemp === undefined
      ? yield* new PrepareCiEnvFailure({ code: "ci_env_incomplete", keys: ["RUNNER_TEMP"] })
      : path.join(runnerTemp, "template-cloudflare", "cloudflare.env"));
  const filesystem = yield* FileSystem.FileSystem;
  const directory = path.dirname(filename);
  yield* filesystem
    .makeDirectory(directory, { mode: 0o700, recursive: true })
    .pipe(Effect.mapError(unwritable));
  yield* filesystem
    .writeFileString(filename, `${lines.join("\n")}\n`)
    .pipe(Effect.mapError(unwritable));
  yield* filesystem.chmod(filename, OWNER_ONLY_FILE_MODE).pipe(Effect.mapError(unwritable));
  const githubEnv = environment["GITHUB_ENV"];
  if (githubEnv !== undefined) {
    yield* filesystem
      .writeFileString(githubEnv, `TEMPLATE_CLOUDFLARE_ENV_FILE=${filename}\n`, { flag: "a" })
      .pipe(Effect.mapError(unwritable));
  }
  return { filename, status: "ready" } as const satisfies CiEnvPreparation;
});

function writeCiSecretsFileProvided(
  environment: Environment,
  destination?: string,
): Effect.Effect<CiEnvPreparation, PrepareCiEnvFailure> {
  return writeCiSecretsFile(environment, destination).pipe(Effect.provide(layer));
}

function writeConfiguredOutput(
  environment: Environment,
  configured: boolean,
): Effect.Effect<void, PrepareCiEnvFailure> {
  const output = environment["GITHUB_OUTPUT"];
  if (output === undefined) {
    return Effect.fail(new PrepareCiEnvFailure({ code: "ci_env_output_missing", keys: [] }));
  }
  return Effect.gen(function* appendOutput() {
    const filesystem = yield* FileSystem.FileSystem;
    yield* filesystem
      .writeFileString(output, `configured=${configured}\n`, { flag: "a" })
      .pipe(Effect.mapError(unwritable));
  }).pipe(Effect.provide(layer));
}

export {
  PrepareCiEnvFailure,
  writeCiSecretsFileProvided as writeCiSecretsFile,
  writeConfiguredOutput,
};
export type { CiEnvPreparation };
