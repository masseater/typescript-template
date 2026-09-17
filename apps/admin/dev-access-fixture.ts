import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { DevEndpoint } from "./dev-access-client.ts";
import { adminDevAccess } from "./dev-access.ts";
import { createServer } from "vite-plus";
import { localOrigin } from "./dev-access-client.ts";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const privateFileMode = 0o600;

interface DevServer extends DevEndpoint {
  readonly addUpgradeListener: () => void;
  readonly root: string;
}

function credentialsText(password: string): string {
  return `APP_ORIGIN=${JSON.stringify(localOrigin)}\nLOCAL_ADMIN_USER="operator"\nLOCAL_ADMIN_PASSWORD=${JSON.stringify(password)}\n`;
}

async function createWorkspace(root: string, password: string): Promise<URL> {
  const credentialsFile = path.join(root, ".dev.vars");
  await Promise.all([mkdir(path.join(root, "src")), mkdir(path.join(root, ".local"))]);
  await Promise.all([
    writeFile(credentialsFile, credentialsText(password), { mode: privateFileMode }),
    writeFile(
      path.join(root, "index.html"),
      '<html><body>Administrator<script type="module" src="/src/admin.js"></script></body></html>',
    ),
    writeFile(path.join(root, "src/admin.js"), 'export const label = "administrator-module";'),
    writeFile(path.join(root, ".local/runtime.json"), JSON.stringify({ password })),
  ]);
  return pathToFileURL(credentialsFile);
}

function listeningPort(address: Readonly<AddressInfo> | string | null | undefined): number {
  if (address === undefined || address === null || typeof address === "string") {
    throw new Error("TEST_SERVER_ADDRESS_REQUIRED");
  }
  return address.port;
}

async function withDevServer(consume: (dev: DevServer) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "admin-dev-access-"));
  const password = crypto.randomUUID();
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [adminDevAccess(await createWorkspace(root, password))],
    root,
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  try {
    await server.listen();
    await consume({
      addUpgradeListener: (): void => {
        server.httpServer?.on("upgrade", () => {
          throw new Error("UNREACHABLE_UNAUTHENTICATED_HANDLER");
        });
      },
      authorization: `Basic ${btoa(`operator:${password}`)}`,
      port: listeningPort(server.httpServer?.address()),
      root,
    });
  } finally {
    await server.close();
    await rm(root, { force: true, recursive: true });
  }
}

export { credentialsText, withDevServer };
export type { DevServer };
