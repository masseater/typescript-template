// oxlint-disable-next-line import/no-nodejs-modules
import { randomBytes } from "node:crypto";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import type { Application } from "@repo/config";

import { applicationRoot } from "./repository.ts";

const fileMode = 0o600;
const secretBytes = 48;
const sender = "no-reply@example.test";

interface DevVars {
  readonly appOrigin: string;
  readonly authSecret: string;
  readonly mailOrigin: string;
}

function devVarsFile(application: Application): string {
  return path.join(applicationRoot(application), ".dev.vars");
}

function serialize(values: DevVars): string {
  const entries: readonly (readonly [string, string])[] = [
    ["APP_ORIGIN", values.appOrigin],
    ["AUTH_SECRET", values.authSecret],
    ["EMAIL_FROM", sender],
    ["MAILPIT_URL", values.mailOrigin],
  ];
  return `${entries.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n")}\n`;
}

function generateAuthSecret(): string {
  return randomBytes(secretBytes).toString("base64url");
}

async function presentContent(file: string): Promise<readonly string[]> {
  try {
    return [await readFile(file, "utf-8")];
  } catch {
    return [];
  }
}

async function replaceDevVars(
  application: Application,
  values: DevVars,
): Promise<() => Promise<void>> {
  const file = devVarsFile(application);
  const [previous] = await presentContent(file);
  await writeFile(file, serialize(values), { mode: fileMode });
  return async () => {
    if (previous === undefined) {
      await rm(file, { force: true });
      return;
    }
    await writeFile(file, previous, { mode: fileMode });
  };
}

export { generateAuthSecret, replaceDevVars };
