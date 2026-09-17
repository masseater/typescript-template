import type { App, Credentials } from "./local-environment.ts";
import {
  apps,
  credentialsFile,
  local,
  origins,
  readCredentials,
  refreshBrowserConfig,
} from "./local-environment.ts";
import {
  isErrorCode,
  privateDirectoryMode,
  replacePrivateFile,
  writePrivateFile,
} from "./private-files.ts";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

interface SetupReport {
  readonly credentialsFile: string;
  readonly event: "local.app_configuration_ready";
  readonly ok: true;
  readonly secretsPrinted: false;
}

const adminPasswordBytes = 32;
const authSecretBytes = 48;
const jsonIndentation = 2;
const otlpEndpoint = "http://127.0.0.1:4318";

async function credentialsExist(): Promise<boolean> {
  try {
    await stat(credentialsFile);
    return true;
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

async function createCredentials(): Promise<Credentials> {
  const credentials = {
    adminPassword: randomBytes(adminPasswordBytes).toString("base64url"),
    adminUser: "operator" as const,
    authSecret: randomBytes(authSecretBytes).toString("base64url"),
  };
  await writePrivateFile(
    credentialsFile,
    `${JSON.stringify(credentials, undefined, jsonIndentation)}\n`,
  );
  return credentials;
}

async function loadOrCreateCredentials(): Promise<Credentials> {
  return (await credentialsExist()) ? readCredentials() : createCredentials();
}

function appVariables(app: App, credentials: Credentials): Record<string, string> {
  return {
    APP_ORIGIN: origins[app],
    ...(app === "wiki"
      ? { OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint }
      : {
          AUTH_SECRET: credentials.authSecret,
          EMAIL_FROM: "no-reply@example.test",
          MAILPIT_URL: "http://127.0.0.1:8025",
          OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint,
        }),
    ...(app === "admin"
      ? {
          LOCAL_ADMIN_PASSWORD: credentials.adminPassword,
          LOCAL_ADMIN_USER: credentials.adminUser,
        }
      : {}),
  };
}

async function writeAppVariables(app: App, credentials: Credentials): Promise<void> {
  const content = `${Object.entries(appVariables(app, credentials))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n")}\n`;
  await replacePrivateFile(new URL(`../../../apps/${app}/.dev.vars`, import.meta.url), content);
}

async function setup(): Promise<SetupReport> {
  await mkdir(local, { mode: privateDirectoryMode, recursive: true });
  await mkdir(new URL("logs/", local), { mode: privateDirectoryMode, recursive: true });
  await refreshBrowserConfig();
  const credentials = await loadOrCreateCredentials();
  await Promise.all(
    apps.map(async (app) => {
      await writeAppVariables(app, credentials);
    }),
  );
  return {
    credentialsFile: fileURLToPath(credentialsFile),
    event: "local.app_configuration_ready",
    ok: true,
    secretsPrinted: false,
  };
}

export { setup };
