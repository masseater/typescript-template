import type { StackSettings, WorkerTarget } from "./workers.ts";
import { createWorkspace, stackSettings, writeBrowserConfig } from "./workspace.ts";
import { ensure, run } from "./support.ts";
import {
  migrateDatabase,
  reservePort,
  startWorker,
  stopWorker,
  workerConfigPath,
  writeWorkerFiles,
} from "./workers.ts";
import { Browser } from "./browser.ts";
import type { Service } from "./observation.ts";
import { StackResources } from "./stack-resources.ts";
import type { StackResourcesHandle } from "./stack-resources.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prerequisites } from "./prerequisites.ts";
import { randomBytes } from "node:crypto";

interface Account {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

interface Stack {
  readonly account: (name: string) => Account;
  readonly adminOrigin: string;
  readonly basicPassword: string;
  readonly basicUser: string;
  readonly bootstrap: (email: string) => Promise<void>;
  readonly browser: (name: string) => Browser;
  readonly cleanup: () => Promise<void>;
  readonly ownMessage: (messageId: string) => void;
  readonly stopUser: () => Promise<void>;
  readonly userOrigin: string;
  readonly wikiOrigin: string;
}

const audiences: readonly Service[] = ["user", "admin", "wiki"];
const accountPasswordBytes = 32;

async function reserveWorkers(resources: StackResourcesHandle): Promise<WorkerTarget[]> {
  return Promise.all(
    audiences.map(async (audience) => {
      const reservation = await reservePort();
      resources.addPort(reservation);
      return { audience, origin: `http://localhost:${reservation.port}`, reservation };
    }),
  );
}

function workerOrigin(workers: readonly WorkerTarget[], audience: Service): string {
  const worker = workers.find((target) => target.audience === audience);
  ensure(worker !== undefined, "E2E_PORT_ALLOCATION_FAILED");
  return worker.origin;
}

function stackInterface(
  settings: StackSettings,
  resources: StackResourcesHandle,
  workers: readonly WorkerTarget[],
): Stack {
  const userOrigin = workerOrigin(workers, "user");
  return {
    account: (name) => {
      const email = `${settings.id.toLowerCase()}-${name}@example.test`;
      resources.register(email);
      return {
        email,
        name: `E2E ${name}`,
        password: randomBytes(accountPasswordBytes).toString("base64url"),
      };
    },
    adminOrigin: workerOrigin(workers, "admin"),
    basicPassword: settings.basicPassword,
    basicUser: settings.basicUser,
    bootstrap: async (email) => {
      await run(process.execPath, [fileURLToPath(new URL("bootstrap.ts", import.meta.url))], {
        input: JSON.stringify({
          config: workerConfigPath(settings, "user"),
          email,
          persist: path.join(settings.persist, "v3"),
        }),
      });
    },
    browser: (name) => {
      const browser = new Browser(`${settings.id}-${name}`, settings.browserConfig);
      resources.addBrowser(browser);
      return browser;
    },
    cleanup: async () => {
      await resources.cleanup();
    },
    ownMessage: (messageId) => {
      resources.ownMessage(messageId);
    },
    stopUser: async () => {
      await stopWorker(settings, resources, { audience: "user", origin: userOrigin });
    },
    userOrigin,
    wikiOrigin: workerOrigin(workers, "wiki"),
  };
}

async function startStack(
  settings: StackSettings,
  resources: StackResourcesHandle,
): Promise<Stack> {
  await writeBrowserConfig(settings);
  const workers = await reserveWorkers(resources);
  await Promise.all(workers.map(async (target) => writeWorkerFiles(settings, target)));
  await migrateDatabase(settings);
  for (const target of workers) {
    await startWorker(settings, resources, target);
  }
  return stackInterface(settings, resources, workers);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function createStack(): Promise<Stack> {
  await prerequisites();
  const workspace = await createWorkspace();
  const resources = new StackResources(workspace);
  try {
    return await startStack(stackSettings(workspace), resources);
  } catch (error) {
    try {
      await resources.cleanup();
    } catch (cleanupError) {
      throw new Error(
        `${errorMessage(error, "E2E_STACK_FAILED")}; ${errorMessage(cleanupError, "E2E_CLEANUP_FAILED")}`,
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

export { createStack };
export type { Account, Stack };
