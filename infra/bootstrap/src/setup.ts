import {
  BootstrapFailure,
  backendUrl,
  fail,
  parseBootstrapConfig,
  parseCredentials,
} from "./config.ts";
import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath, pathToFileURL } from "node:url";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";
import { LocalWorkspace } from "@pulumi/pulumi/automation";
import { NodeRuntime } from "@effect/platform-node";
import type { Stack } from "@pulumi/pulumi/automation";
import type { StateCredentials } from "./config.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir } from "node:fs/promises";

const MIN_API_TOKEN_LENGTH = 20;
const MIN_PASSPHRASE_LENGTH = 32;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;

const workDir = fileURLToPath(new URL("../", import.meta.url));
const stateDirectory = fileURLToPath(new URL("../.state/", import.meta.url));
const credentialsFile = `${stateDirectory}/r2.json`;

const BootstrapEnvironment = Schema.Struct({
  BOOTSTRAP_ACCOUNT_ID: Schema.String,
  BOOTSTRAP_BUCKET: Schema.String,
  CLOUDFLARE_API_TOKEN: Schema.String.check(Schema.isMinLength(MIN_API_TOKEN_LENGTH)),
  PULUMI_CONFIG_PASSPHRASE: Schema.String.check(Schema.isMinLength(MIN_PASSPHRASE_LENGTH)),
});

type EnvironmentVariables = Readonly<Record<string, string>>;

function stack<Value>(run: () => Promise<Value>): Effect.Effect<Value, BootstrapFailure> {
  return Effect.tryPromise({
    catch: () => new BootstrapFailure({ code: "bootstrap_stack_failed" }),
    try: run,
  });
}

function selectStack(envVars: EnvironmentVariables): Effect.Effect<Stack, BootstrapFailure> {
  return stack(async () =>
    LocalWorkspace.createOrSelectStack({ stackName: "bootstrap", workDir }, { envVars }),
  );
}

const savedEnvironment = Effect.fn("savedEnvironment")(function* savedEnvironment(
  saved: StateCredentials | undefined,
) {
  if (saved === undefined) {
    return { PULUMI_BACKEND_URL: pathToFileURL(`${stateDirectory}/local`).href };
  }
  return {
    AWS_ACCESS_KEY_ID: saved.accessKeyId,
    AWS_REGION: "auto",
    AWS_SECRET_ACCESS_KEY: saved.secretAccessKey,
    PULUMI_BACKEND_URL: yield* backendUrl(saved),
  };
});

const migrateState = Effect.fn("migrateState")(function* migrateState(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  active: Stack,
  credentials: StateCredentials,
  commonEnvironment: EnvironmentVariables,
) {
  const remoteBackend = yield* backendUrl(credentials);
  const exported = yield* stack(async () => active.exportStack());
  const remote = yield* selectStack({
    ...commonEnvironment,
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_REGION: "auto",
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    PULUMI_BACKEND_URL: remoteBackend,
  });
  yield* stack(async () => remote.importStack(exported));
  const remoteOutputs = yield* stack(async () => remote.outputs());
  if (remoteOutputs["stateBackend"]?.value !== remoteBackend) {
    return yield* fail("state_migration_unverified");
  }
});

const applyBootstrap = Effect.fn("applyBootstrap")(function* applyBootstrap(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  active: Stack,
  settings: unknown,
) {
  yield* stack(async () =>
    active.setConfig("template-bootstrap:settings", { value: JSON.stringify(settings) }),
  );
  yield* stack(async () => active.up());
  const outputs = yield* stack(async () => active.outputs());
  const credentials = yield* parseCredentials(outputs["stateCredentials"]?.value);
  if (outputs["stateCredentials"]?.secret !== true) {
    return yield* fail("state_credentials_not_encrypted");
  }
  return credentials;
});

const prepareBootstrap = Effect.fn("prepareBootstrap")(function* prepareBootstrap() {
  // oxlint-disable-next-line node/no-process-env
  const env = yield* Schema.decodeUnknownEffect(BootstrapEnvironment)(process.env).pipe(
    Effect.mapError(() => new BootstrapFailure({ code: "bootstrap_environment_invalid" })),
  );
  const settings = yield* parseBootstrapConfig({
    accountId: env.BOOTSTRAP_ACCOUNT_ID,
    bucket: env.BOOTSTRAP_BUCKET,
  });
  yield* prepareStateDirectory(stateDirectory);
  yield* Effect.tryPromise({
    catch: () => new BootstrapFailure({ code: "state_directory_unavailable" }),
    try: async () =>
      mkdir(`${stateDirectory}/local`, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true }),
  });
  const commonEnvironment = {
    CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
    PULUMI_CONFIG_PASSPHRASE: env.PULUMI_CONFIG_PASSPHRASE,
    PULUMI_HOME: `${stateDirectory}/pulumi-home`,
  };
  return { commonEnvironment, settings };
});

const bootstrap = Effect.fn("bootstrap")(function* bootstrap() {
  const { commonEnvironment, settings } = yield* prepareBootstrap();
  const saved = yield* readCredentials(credentialsFile);
  if (saved && (saved.accountId !== settings.accountId || saved.bucket !== settings.bucket)) {
    return yield* fail("bootstrap_identity_mismatch");
  }
  const active = yield* selectStack({ ...commonEnvironment, ...(yield* savedEnvironment(saved)) });
  const credentials = yield* applyBootstrap(active, settings);
  if (saved === undefined) {
    yield* migrateState(active, credentials, commonEnvironment);
  }
  yield* writeCredentials(credentialsFile, credentials);
  return yield* backendUrl(settings);
});

NodeRuntime.runMain(
  bootstrap().pipe(
    Effect.flatMap((backend) =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.log(JSON.stringify({ backend, event: "bootstrap.ready" }));
      }),
    ),
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(
          JSON.stringify({
            action: "Inspect protected local state; credentials are not printed.",
            event: "bootstrap.failed",
          }),
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
