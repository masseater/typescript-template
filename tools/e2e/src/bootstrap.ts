import { getPlatformProxy } from "wrangler";
import { createDb } from "@template/db";
import type { DatabaseBinding } from "@template/db";
import { bootstrapAdmin } from "@template/db/admin";
import * as v from "valibot";

try {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    if (!Buffer.isBuffer(chunk)) throw new Error("INVALID_INPUT");
    chunks.push(chunk);
  }
  const parsed = v.safeParse(
    v.strictObject({
      config: v.string(),
      persist: v.string(),
      email: v.pipe(v.string(), v.email()),
    }),
    JSON.parse(Buffer.concat(chunks).toString()) as unknown,
  );
  if (!parsed.success) throw new Error("INVALID_INPUT");
  const platform = await getPlatformProxy<{ DB: DatabaseBinding }>({
    configPath: parsed.output.config,
    envFiles: [],
    remoteBindings: false,
    persist: { path: parsed.output.persist },
  });
  try {
    await bootstrapAdmin(createDb(platform.env.DB), parsed.output.email);
  } finally {
    await platform.dispose();
  }
  console.info(JSON.stringify({ ok: true, event: "e2e.admin_bootstrapped" }));
} catch {
  console.error(JSON.stringify({ ok: false, event: "e2e.admin_bootstrap_failed" }));
  process.exitCode = 1;
}
