import * as v from "valibot";
import { getPlatformProxy } from "wrangler";
import { bootstrapAdmin } from "./admin.ts";
import { createDb } from "./index.ts";
import { localDatabasePersistence, writeLocalDatabaseConfig } from "./local.ts";
import type { DatabaseBinding } from "./index.ts";

async function bootstrapLocal() {
  const email = v.parse(v.pipe(v.string(), v.email()), process.argv[2]);
  const platform = await getPlatformProxy<{ DB: DatabaseBinding }>({
    remoteBindings: false,
    envFiles: [],
    configPath: await writeLocalDatabaseConfig(),
    persist: { path: `${localDatabasePersistence}/v3` },
  });
  try {
    const administrator = await bootstrapAdmin(createDb(platform.env.DB), email);
    console.log(
      JSON.stringify({
        action: "admin_bootstrap",
        userId: administrator.id,
        role: administrator.role,
      }),
    );
  } finally {
    await platform.dispose();
  }
}

await bootstrapLocal().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      action: "admin_bootstrap",
      success: false,
      error:
        error instanceof Error && error.message === "BOOTSTRAP_REQUIRES_VERIFIED_USER_AND_NO_ADMIN"
          ? error.message
          : "LOCAL_BOOTSTRAP_FAILED",
    }),
  );
  process.exitCode = 1;
});
