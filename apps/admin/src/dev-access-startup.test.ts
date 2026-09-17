import { test as baseTest, describe, expect } from "vite-plus/test";
import { credentialsText, withDevServer } from "#dev-access-fixture";
import { localOrigin, upgrade, websocketPath } from "#dev-access-client";
import type { DevServer } from "#dev-access-fixture";
import type { UpgradeCall } from "#dev-access-client";
import { adminDevAccess } from "#dev-access";
import { createServer } from "vite-plus";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { writeFile } from "node:fs/promises";

const switchingProtocolsStatus = 101;
const unauthorizedStatus = 401;
const privateFileMode = 0o600;
const sharedFileMode = 0o644;

type DevContext = Readonly<{ dev: DevServer }>;

const test = baseTest.extend<{ dev: DevServer }>({
  dev: [
    async ({}: object, provide): Promise<void> => {
      await withDevServer(provide);
    },
    { scope: "file" },
  ],
});

describe("admin development HMR access", () => {
  test.for<UpgradeCall & { readonly status: number }>([
    { authorized: false, origin: localOrigin, protocol: "vite-hmr", status: unauthorizedStatus },
    {
      authorized: true,
      origin: "https://attacker.invalid",
      protocol: "vite-hmr",
      status: unauthorizedStatus,
    },
    { authorized: true, origin: undefined, protocol: "vite-hmr", status: unauthorizedStatus },
    { authorized: false, origin: localOrigin, protocol: "vite-invoke", status: unauthorizedStatus },
    {
      authorized: false,
      origin: localOrigin,
      protocol: "custom-worker-websocket",
      status: unauthorizedStatus,
    },
    {
      authorized: true,
      origin: localOrigin,
      protocol: "vite-hmr",
      status: switchingProtocolsStatus,
    },
  ])(
    "answers $protocol upgrade from $origin with a valid Vite token",
    async (call, { dev }: DevContext) => {
      expect.hasAssertions();
      const pathname = await websocketPath(dev);
      await expect(upgrade(dev, pathname, call)).resolves.toBe(call.status);
    },
  );

  test("late upgrade handlers cannot bypass the authentication gate", ({ dev }: DevContext) => {
    expect.hasAssertions();
    expect(dev.addUpgradeListener).toThrow("ADMIN_DEV_UNGUARDED_UPGRADE_LISTENER_DENIED");
  });
});

describe("admin development server startup", () => {
  test.for<Readonly<{ file: string; host: string; message: string; mode: number }>>([
    {
      file: "shared.dev.vars",
      host: "127.0.0.1",
      message: "ADMIN_DEV_CREDENTIALS_REQUIRE_MODE_0600",
      mode: sharedFileMode,
    },
    {
      file: "private.dev.vars",
      host: "0.0.0.0",
      message: "ADMIN_DEV_REQUIRES_LOCAL_SINGLE_HTTP_SERVER",
      mode: privateFileMode,
    },
  ])("refuses $file on $host", async ({ file, host, message, mode }, { dev }: DevContext) => {
    expect.hasAssertions();
    const credentialsFile = path.join(dev.root, file);
    await writeFile(credentialsFile, credentialsText(crypto.randomUUID()), { mode });
    const plugin = adminDevAccess(credentialsFile);
    const startup = createServer({
      configFile: false,
      logLevel: "silent",
      plugins: [plugin],
      root: dev.root,
      server: { host, port: 0 },
    });
    await expect(startup).rejects.toThrow(message);
  });
});
