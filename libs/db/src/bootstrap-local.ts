import { email, parse, pipe, string } from "valibot";
import type { DatabaseBinding } from "./index.ts";
import { bootstrapAdmin } from "./admin.ts";
import { createDb } from "./index.ts";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

const EMAIL_ARGUMENT_INDEX = 2;

async function bootstrapLocal(): Promise<void> {
  const address = parse(pipe(string(), email()), process.argv[EMAIL_ARGUMENT_INDEX]);
  const platform = await getPlatformProxy<{ DB: DatabaseBinding }>({
    configPath: fileURLToPath(new URL("../../../apps/user/wrangler.jsonc", import.meta.url)),
    envFiles: [],
    persist: { path: fileURLToPath(new URL("../../../.local/d1/v3", import.meta.url)) },
    remoteBindings: false,
  });
  try {
    const administrator = await bootstrapAdmin(createDb(platform.env.DB), address);
    const report = {
      action: "admin_bootstrap",
      role: administrator.role,
      userId: administrator.id,
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await platform.dispose();
  }
}

await bootstrapLocal().catch((error: unknown) => {
  const failure = {
    action: "admin_bootstrap",
    error:
      error instanceof Error && error.message === "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN"
        ? error.message
        : "LOCAL_BOOTSTRAP_FAILED",
    success: false,
  };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
});
