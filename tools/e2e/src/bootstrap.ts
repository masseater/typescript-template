import { email, pipe, safeParse, strictObject, string } from "valibot";
import type { DatabaseBinding } from "@template/db";
import { bootstrapAdmin } from "@template/db/admin";
import { createDb } from "@template/db";
import { getPlatformProxy } from "wrangler";

const inputSchema = strictObject({
  config: string(),
  email: pipe(string(), email()),
  persist: string(),
});

async function readInput(): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    if (!Buffer.isBuffer(chunk)) {
      throw new TypeError("INVALID_INPUT");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString()) as unknown;
}

function report(event: string, ok: boolean): void {
  const stream = ok ? process.stdout : process.stderr;
  stream.write(`${JSON.stringify({ event, ok })}\n`);
}

try {
  const parsed = safeParse(inputSchema, await readInput());
  if (!parsed.success) {
    throw new Error("INVALID_INPUT");
  }
  const platform = await getPlatformProxy<{ DB: DatabaseBinding }>({
    configPath: parsed.output.config,
    envFiles: [],
    persist: { path: parsed.output.persist },
    remoteBindings: false,
  });
  try {
    await bootstrapAdmin(createDb(platform.env.DB), parsed.output.email);
  } finally {
    await platform.dispose();
  }
  report("e2e.admin_bootstrapped", true);
} catch {
  report("e2e.admin_bootstrap_failed", false);
  process.exitCode = 1;
}
