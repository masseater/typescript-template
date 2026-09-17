import { NodeRuntime } from "@effect/platform-node";
import { LocalWorkspace } from "@pulumi/pulumi/automation";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Effect, Schema } from "effect";
import {
  BootstrapFailure,
  backendUrl,
  fail,
  parseBootstrapConfig,
  parseCredentials,
} from "./config.ts";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";

const workDir = fileURLToPath(new URL("../", import.meta.url));
const stateDirectory = fileURLToPath(new URL("../.state/", import.meta.url));
const credentialsFile = `${stateDirectory}/r2.json`;

const BootstrapEnvironment = Schema.Struct({
  BOOTSTRAP_ACCOUNT_ID: Schema.String,
  BOOTSTRAP_BUCKET: Schema.String,
  CLOUDFLARE_API_TOKEN: Schema.String.check(Schema.isMinLength(20)),
  PULUMI_CONFIG_PASSPHRASE: Schema.String.check(Schema.isMinLength(32)),
});

const stack = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: () => new BootstrapFailure({ code: "bootstrap_stack_failed" }),
  });

NodeRuntime.runMain(
  Effect.gen(function* () {
    const env = yield* Schema.decodeUnknownEffect(BootstrapEnvironment)(process.env).pipe(
      Effect.mapError(() => new BootstrapFailure({ code: "bootstrap_environment_invalid" })),
    );
    const settings = yield* parseBootstrapConfig({
      accountId: env.BOOTSTRAP_ACCOUNT_ID,
      bucket: env.BOOTSTRAP_BUCKET,
    });
    yield* prepareStateDirectory(stateDirectory);
    yield* Effect.tryPromise({
      try: () => mkdir(`${stateDirectory}/local`, { recursive: true, mode: 0o700 }),
      catch: () => new BootstrapFailure({ code: "state_directory_unavailable" }),
    });
    const commonEnvironment = {
      CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
      PULUMI_CONFIG_PASSPHRASE: env.PULUMI_CONFIG_PASSPHRASE,
      PULUMI_HOME: `${stateDirectory}/pulumi-home`,
    };
    const saved = yield* readCredentials(credentialsFile);
    if (saved && (saved.accountId !== settings.accountId || saved.bucket !== settings.bucket))
      return yield* fail("bootstrap_identity_mismatch");
    const savedEnvironment = saved
      ? {
          PULUMI_BACKEND_URL: yield* backendUrl(saved),
          AWS_ACCESS_KEY_ID: saved.accessKeyId,
          AWS_SECRET_ACCESS_KEY: saved.secretAccessKey,
          AWS_REGION: "auto",
        }
      : { PULUMI_BACKEND_URL: pathToFileURL(`${stateDirectory}/local`).href };
    const active = yield* stack(() =>
      LocalWorkspace.createOrSelectStack(
        { stackName: "bootstrap", workDir },
        { envVars: { ...commonEnvironment, ...savedEnvironment } },
      ),
    );
    yield* stack(() =>
      active.setConfig("template-bootstrap:settings", { value: JSON.stringify(settings) }),
    );
    yield* stack(() => active.up());
    const outputs = yield* stack(() => active.outputs());
    const credentials = yield* parseCredentials(outputs["stateCredentials"]?.value);
    if (!outputs["stateCredentials"]?.secret) return yield* fail("state_credentials_not_encrypted");
    const remoteBackend = yield* backendUrl(credentials);
    if (!saved) {
      const exported = yield* stack(() => active.exportStack());
      const remote = yield* stack(() =>
        LocalWorkspace.createOrSelectStack(
          { stackName: "bootstrap", workDir },
          {
            envVars: {
              ...commonEnvironment,
              PULUMI_BACKEND_URL: remoteBackend,
              AWS_ACCESS_KEY_ID: credentials.accessKeyId,
              AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
              AWS_REGION: "auto",
            },
          },
        ),
      );
      yield* stack(() => remote.importStack(exported));
      const remoteOutputs = yield* stack(() => remote.outputs());
      if (remoteOutputs["stateBackend"]?.value !== remoteBackend)
        return yield* fail("state_migration_unverified");
    }
    yield* writeCredentials(credentialsFile, credentials);
    const backend = yield* backendUrl(settings);
    console.log(JSON.stringify({ event: "bootstrap.ready", backend }));
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(
          JSON.stringify({
            event: "bootstrap.failed",
            action: "Inspect protected local state; credentials are not printed.",
          }),
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
