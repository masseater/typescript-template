import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { privateDirectoryMode, privateFileMode, root } from "./support.ts";
import { randomBytes, randomUUID } from "node:crypto";
import type { StackSettings } from "./workers.ts";
import type { Workspace } from "./stack-resources.ts";
import { createRequire } from "node:module";
import path from "node:path";

const basicPasswordBytes = 32;
const authSecretBytes = 48;

async function createWorkspace(): Promise<Workspace> {
  const local = path.join(root, ".local");
  await mkdir(local, { mode: privateDirectoryMode, recursive: true });
  const directory = await mkdtemp(path.join(local, "e2e-"));
  await chmod(directory, privateDirectoryMode);
  return { directory, id: path.basename(directory), local };
}

function stackSettings(workspace: Workspace): StackSettings {
  const wrangler = path.join(
    path.dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
    "bin/wrangler.js",
  );
  return {
    authSecret: randomBytes(authSecretBytes).toString("base64url"),
    basicPassword: randomBytes(basicPasswordBytes).toString("base64url"),
    basicUser: `gate-${workspace.id}`,
    browserConfig: path.join(workspace.directory, "agent-browser.json"),
    databaseId: randomUUID(),
    directory: workspace.directory,
    id: workspace.id,
    persist: path.join(workspace.directory, "d1"),
    wrangler,
  };
}

async function writeBrowserConfig(settings: StackSettings): Promise<void> {
  await writeFile(settings.browserConfig, "{}", { mode: privateFileMode });
}

export { createWorkspace, stackSettings, writeBrowserConfig };
