// oxlint-disable-next-line import/no-nodejs-modules
import { appendFile, chmod, mkdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { deploymentKeys, optionalDeploymentKeys } from "@repo/observability/deployment-keys";
import { Effect, Schema } from "effect";

const OWNER_ONLY_FILE_MODE = 0o600;
const APP_DOMAIN_KEY = "TEMPLATE_APP_DOMAIN";
const retiredOriginKeys = [
  "TEMPLATE_SERVICE_MEMBER_ORIGIN",
  "TEMPLATE_SERVICE_ADMIN_ORIGIN",
  "TEMPLATE_INTERNAL_DASHBOARD_ORIGIN",
] as const;

class PrepareCiEnvFailure extends Schema.TaggedError<PrepareCiEnvFailure>()("PrepareCiEnvFailure", {
  code: Schema.Literals(["ci_env_incomplete", "ci_env_retired_origins", "ci_env_unwritable"]),
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
    return yield* Effect.fail(
      new PrepareCiEnvFailure({
        code: "ci_env_retired_origins",
        keys: missing.includes(APP_DOMAIN_KEY) ? [APP_DOMAIN_KEY, ...retired] : [...retired],
      }),
    );
  }
  if (missing.length > 0) {
    return yield* Effect.fail(
      new PrepareCiEnvFailure({ code: "ci_env_incomplete", keys: missing }),
    );
  }
  const lines = [
    ...required.flatMap(({ key, value }) => (value === undefined ? [] : [dotenvLine(key, value)])),
    ...optionalDeploymentKeys.flatMap((key) => {
      const value = envValue(key, environment);
      return value === undefined ? [] : [dotenvLine(key, value)];
    }),
  ];
  const root = environment["RUNNER_TEMP"] ?? tmpdir();
  const directory = path.join(root, "template-cloudflare");
  const filename = path.join(directory, "cloudflare.env");
  yield* Effect.tryPromise({
    catch: () => new PrepareCiEnvFailure({ code: "ci_env_unwritable", keys: [] }),
    try: async () => {
      await mkdir(directory, { mode: 0o700, recursive: true });
      await writeFile(filename, `${lines.join("\n")}\n`, { mode: OWNER_ONLY_FILE_MODE });
      await chmod(filename, OWNER_ONLY_FILE_MODE);
    },
  });
  const githubEnv = environment["GITHUB_ENV"];
  if (githubEnv !== undefined && githubEnv !== "") {
    yield* Effect.tryPromise({
      catch: () => new PrepareCiEnvFailure({ code: "ci_env_unwritable", keys: [] }),
      try: async () => appendFile(githubEnv, `TEMPLATE_CLOUDFLARE_ENV_FILE=${filename}\n`),
    });
  }
  return { filename, status: "ready" } as const satisfies CiEnvPreparation;
});

export { PrepareCiEnvFailure, writeCiSecretsFile };
export type { CiEnvPreparation };
