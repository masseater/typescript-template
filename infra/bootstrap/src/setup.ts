import { backendUrl, parseBootstrapConfig, parseCredentials } from "./config.ts";
import { fileURLToPath, pathToFileURL } from "node:url";
import { minLength, object, pipe, safeParse, string } from "valibot";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";
import { LocalWorkspace } from "@pulumi/pulumi/automation";
import { mkdir } from "node:fs/promises";

const MIN_API_TOKEN_LENGTH = 20;
const MIN_PASSPHRASE_LENGTH = 32;

const workDir = fileURLToPath(new URL("../", import.meta.url));
const stateDirectory = fileURLToPath(new URL("../.state/", import.meta.url));
const credentialsFile = `${stateDirectory}/r2.json`;
const environmentSchema = object({
  BOOTSTRAP_ACCOUNT_ID: string(),
  BOOTSTRAP_BUCKET: string(),
  CLOUDFLARE_API_TOKEN: pipe(string(), minLength(MIN_API_TOKEN_LENGTH)),
  PULUMI_CONFIG_PASSPHRASE: pipe(string(), minLength(MIN_PASSPHRASE_LENGTH)),
});

try {
  const env = safeParse(environmentSchema, process.env);
  if (!env.success) {
    throw new Error("bootstrap_environment_invalid");
  }
  const settings = parseBootstrapConfig({
    accountId: env.output.BOOTSTRAP_ACCOUNT_ID,
    bucket: env.output.BOOTSTRAP_BUCKET,
  });
  await prepareStateDirectory(stateDirectory);
  await mkdir(`${stateDirectory}/local`, { mode: 0o700, recursive: true });
  const commonEnvironment = {
    CLOUDFLARE_API_TOKEN: env.output.CLOUDFLARE_API_TOKEN,
    PULUMI_CONFIG_PASSPHRASE: env.output.PULUMI_CONFIG_PASSPHRASE,
    PULUMI_HOME: `${stateDirectory}/pulumi-home`,
  };
  const saved = await readCredentials(credentialsFile);
  if (saved && (saved.accountId !== settings.accountId || saved.bucket !== settings.bucket)) {
    throw new Error("bootstrap_identity_mismatch");
  }
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
              AWS_REGION: "auto",
              AWS_SECRET_ACCESS_KEY: saved.secretAccessKey,
            }
          : {}),
      },
    },
  );
  await active.setConfig("template-bootstrap:settings", { value: JSON.stringify(settings) });
  await active.up();
  const outputs = await active.outputs();
  const credentials = parseCredentials(outputs["stateCredentials"]?.value);
  if (outputs["stateCredentials"]?.secret !== true) {
    throw new Error("state_credentials_not_encrypted");
  }
  if (!saved) {
    const exported = await active.exportStack();
    const remote = await LocalWorkspace.createOrSelectStack(
      { stackName: "bootstrap", workDir },
      {
        envVars: {
          ...commonEnvironment,
          AWS_ACCESS_KEY_ID: credentials.accessKeyId,
          AWS_REGION: "auto",
          AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
          PULUMI_BACKEND_URL: backendUrl(credentials),
        },
      },
    );
    await remote.importStack(exported);
    const remoteOutputs = await remote.outputs();
    if (remoteOutputs["stateBackend"]?.value !== backendUrl(credentials)) {
      throw new Error("state_migration_unverified");
    }
  }
  await writeCredentials(credentialsFile, credentials);
  process.stdout.write(
    `${JSON.stringify({ backend: backendUrl(settings), event: "bootstrap.ready" })}\n`,
  );
} catch {
  process.stderr.write(
    `${JSON.stringify({
      action: "Inspect protected local state; credentials are not printed.",
      event: "bootstrap.failed",
    })}\n`,
  );
  process.exitCode = 1;
}
