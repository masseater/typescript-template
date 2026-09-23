import { tmpdir } from "node:os";

import {
  budgetKeys,
  deploymentKeys,
  optionalDeploymentKeys,
} from "@repo/observability/deployment-keys";
import { Effect, FileSystem, Schema } from "effect";

import { layer, path } from "./platform.ts";

const OWNER_ONLY_FILE_MODE = 0o600;
const APP_DOMAIN_KEY = "TEMPLATE_APP_DOMAIN";
const retiredOriginKeys = [
  "TEMPLATE_SERVICE_MEMBER_ORIGIN",
  "TEMPLATE_SERVICE_ADMIN_ORIGIN",
  "TEMPLATE_INTERNAL_DASHBOARD_ORIGIN",
] as const;
const carriedDeploymentKeys = [
  ...optionalDeploymentKeys,
  ...budgetKeys.filter((key) => !deploymentKeys.some((required) => required === key)),
];

class PrepareCiEnvFailure extends Schema.TaggedError<PrepareCiEnvFailure>()("PrepareCiEnvFailure", {
  code: Schema.Literals([
    "ci_env_incomplete",
    "ci_env_output_missing",
    "ci_env_retired_origins",
    "ci_env_unwritable",
  ]),
  keys: Schema.Array(Schema.String),
}) {}

type CiEnvPreparation =
  | { readonly filename: string; readonly status: "ready" }
  | { readonly status: "unconfigured" };

function envValue(
  key: string,
  environment: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const value = environment[key];
  return value === undefined || value === "" ? undefined : value;
}

function dotenvLine(key: string, value: string): string {
  return `${key}=${JSON.stringify(value)}`;
}

function presentRetiredOrigins(
  environment: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return retiredOriginKeys.filter((key) => envValue(key, environment) !== undefined);
}

function unwritable(): PrepareCiEnvFailure {
  return new PrepareCiEnvFailure({ code: "ci_env_unwritable", keys: [] });
}

const writeCiSecretsFile = Effect.fn("writeCiSecretsFile")(function* writeCiSecretsFile(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const required = deploymentKeys.map((key) => {
    const value = envValue(key, environment);
    return { key, value } as const;
  });
  const present = required.flatMap(({ key, value }) => (value === undefined ? [] : [key]));
  const missing = required.flatMap(({ key, value }) => (value === undefined ? [key] : []));
  const retired = presentRetiredOrigins(environment);
  if (present.length === 0 && retired.length === 0) {
    return { status: "unconfigured" } as const satisfies CiEnvPreparation;
  }
  if (retired.length > 0) {
    return yield* new PrepareCiEnvFailure({
      code: "ci_env_retired_origins",
      keys: missing.includes(APP_DOMAIN_KEY) ? [APP_DOMAIN_KEY, ...retired] : [...retired],
    });
  }
  if (missing.length > 0) {
    return yield* new PrepareCiEnvFailure({ code: "ci_env_incomplete", keys: missing });
  }
  const lines = [
    ...required.flatMap(({ key, value }) => (value === undefined ? [] : [dotenvLine(key, value)])),
    ...carriedDeploymentKeys.flatMap((key) => {
      const value = envValue(key, environment);
      return value === undefined ? [] : [dotenvLine(key, value)];
    }),
  ];
  const root = environment["RUNNER_TEMP"] ?? tmpdir();
  const directory = path.join(root, "template-cloudflare");
  const filename = path.join(directory, "cloudflare.env");
  const filesystem = yield* FileSystem.FileSystem;
  yield* filesystem
    .makeDirectory(directory, { mode: 0o700, recursive: true })
    .pipe(Effect.mapError(unwritable));
  yield* filesystem
    .writeFileString(filename, `${lines.join("\n")}\n`)
    .pipe(Effect.mapError(unwritable));
  yield* filesystem.chmod(filename, OWNER_ONLY_FILE_MODE).pipe(Effect.mapError(unwritable));
  const githubEnv = environment["GITHUB_ENV"];
  if (githubEnv !== undefined && githubEnv !== "") {
    yield* filesystem
      .writeFileString(githubEnv, `TEMPLATE_CLOUDFLARE_ENV_FILE=${filename}\n`, { flag: "a" })
      .pipe(Effect.mapError(unwritable));
  }
  return { filename, status: "ready" } as const satisfies CiEnvPreparation;
});

function writeCiSecretsFileProvided(
  environment: Readonly<Record<string, string | undefined>>,
): Effect.Effect<CiEnvPreparation, PrepareCiEnvFailure> {
  return writeCiSecretsFile(environment).pipe(Effect.provide(layer));
}

function writeConfiguredOutput(
  environment: Readonly<Record<string, string | undefined>>,
  configured: boolean,
): Effect.Effect<void, PrepareCiEnvFailure> {
  const output = environment["GITHUB_OUTPUT"];
  if (output === undefined || output === "") {
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
