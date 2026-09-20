import { randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { appEnvKey } from "@repo/config";

import { applicationRoot } from "./repository.ts";

import type { Application } from "@repo/config";

const secretBytes = 48;

const generateAuthSecret = (): string => {
  return randomBytes(secretBytes).toString("base64url");
};

const presentContent = async (file: string): Promise<readonly string[]> => {
  try {
    return [await readFile(file, "utf-8")];
  } catch (unreadable) {
    if (unreadable instanceof Error && "code" in unreadable && unreadable.code === "ENOENT") {
      return [];
    }
    throw unreadable;
  }
};

type DevVars = {
  readonly appOrigin: string;
  readonly authSecret: string;
  readonly mailOrigin: string;
};

const serialize = (devVars: DevVars): string => {
  const assignments: readonly (readonly [string, string])[] = [
    [appEnvKey.appOrigin, devVars.appOrigin],
    [appEnvKey.authSecret, devVars.authSecret],
    [appEnvKey.emailFrom, "no-reply@example.test"],
    [appEnvKey.mailpitUrl, devVars.mailOrigin],
    [appEnvKey.opsEmail, "ops@example.test"],
  ];
  return `${assignments.map(([variable, assigned]) => `${variable}=${JSON.stringify(assigned)}`).join("\n")}\n`;
};

const replaceDevVars = async (
  application: Application,
  devVars: DevVars,
): Promise<() => Promise<void>> => {
  const file = path.join(applicationRoot(application), ".dev.vars");
  const [replaced] = await presentContent(file);
  const fileMode = 0o600;
  await writeFile(file, serialize(devVars), { mode: fileMode });
  return async () => {
    if (replaced === undefined) {
      await rm(file, { force: true });
      return;
    }
    await writeFile(file, replaced, { mode: fileMode });
  };
};

export { generateAuthSecret, replaceDevVars };
