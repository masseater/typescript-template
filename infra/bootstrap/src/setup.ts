import { LocalWorkspace } from "@pulumi/pulumi/automation";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as v from "valibot";
import { backendUrl, parseBootstrapConfig, parseCredentials } from "./config.ts";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";

const workDir = fileURLToPath(new URL("../", import.meta.url));
const stateDirectory = fileURLToPath(new URL("../.state/", import.meta.url));
const credentialsFile = `${stateDirectory}/r2.json`;

try {
  const env = v.safeParse(
    v.object({
      BOOTSTRAP_ACCOUNT_ID: v.string(),
      BOOTSTRAP_BUCKET: v.string(),
      CLOUDFLARE_API_TOKEN: v.pipe(v.string(), v.minLength(20)),
      PULUMI_CONFIG_PASSPHRASE: v.pipe(v.string(), v.minLength(32)),
    }),
    process.env,
  );
  if (!env.success) throw new Error("bootstrap_environment_invalid");
  const settings = parseBootstrapConfig({
    accountId: env.output.BOOTSTRAP_ACCOUNT_ID,
    bucket: env.output.BOOTSTRAP_BUCKET,
  });
  await prepareStateDirectory(stateDirectory);
  await mkdir(`${stateDirectory}/local`, { recursive: true, mode: 0o700 });
  const commonEnvironment = {
    CLOUDFLARE_API_TOKEN: env.output.CLOUDFLARE_API_TOKEN,
    PULUMI_CONFIG_PASSPHRASE: env.output.PULUMI_CONFIG_PASSPHRASE,
    PULUMI_HOME: `${stateDirectory}/pulumi-home`,
  };
  const saved = await readCredentials(credentialsFile);
  if (saved && (saved.accountId !== settings.accountId || saved.bucket !== settings.bucket))
    throw new Error("bootstrap_identity_mismatch");
  const active = await LocalWorkspace.createOrSelectStack(
    { stackName: "bootstrap", workDir },
    {
      envVars: {
        ...commonEnvironment,
        PULUMI_BACKEND_URL: saved
          ? backendUrl(saved)
          : pathToFileURL(`${stateDirectory}/local`).href,
        ...(saved
          ? {
              AWS_ACCESS_KEY_ID: saved.accessKeyId,
              AWS_SECRET_ACCESS_KEY: saved.secretAccessKey,
              AWS_REGION: "auto",
            }
          : {}),
      },
    },
  );
  await active.setConfig("template-bootstrap:settings", { value: JSON.stringify(settings) });
  await active.up();
  const outputs = await active.outputs();
  const credentials = parseCredentials(outputs["stateCredentials"]?.value);
  if (!outputs["stateCredentials"]?.secret) throw new Error("state_credentials_not_encrypted");
  if (!saved) {
    const exported = await active.exportStack();
    const remote = await LocalWorkspace.createOrSelectStack(
      { stackName: "bootstrap", workDir },
      {
        envVars: {
          ...commonEnvironment,
          PULUMI_BACKEND_URL: backendUrl(credentials),
          AWS_ACCESS_KEY_ID: credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
          AWS_REGION: "auto",
        },
      },
    );
    await remote.importStack(exported);
    const remoteOutputs = await remote.outputs();
    if (remoteOutputs["stateBackend"]?.value !== backendUrl(credentials))
      throw new Error("state_migration_unverified");
  }
  await writeCredentials(credentialsFile, credentials);
  console.log(JSON.stringify({ event: "bootstrap.ready", backend: backendUrl(settings) }));
} catch {
  console.error(
    JSON.stringify({
      event: "bootstrap.failed",
      action: "Inspect protected local state; credentials are not printed.",
    }),
  );
  process.exitCode = 1;
}
