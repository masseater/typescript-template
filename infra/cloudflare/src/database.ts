import { fileURLToPath } from "node:url";
import { runRemoteDatabaseCommand } from "@template/db/remote";
import { readStackOutput } from "@template/infra-bootstrap/state";
import * as v from "valibot";

const settingsSchema = v.object({ accountId: v.string() });

try {
  const args = process.argv.slice(2);
  const shared = fileURLToPath(new URL("../shared", import.meta.url));
  const settings = v.parse(settingsSchema, await readStackOutput(shared, "applicationSettings"));
  const databaseId = await readStackOutput(shared, "databaseId");
  const chunks: Buffer[] = [];
  if (args[0] === "bootstrap") {
    for await (const chunk of process.stdin) {
      if (!Buffer.isBuffer(chunk)) throw new Error("database_input_invalid");
      chunks.push(chunk);
    }
  }
  const email = Buffer.concat(chunks).toString("utf8").trim();
  const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
  const result = await runRemoteDatabaseCommand(args, {
    accountId: settings.accountId,
    databaseId,
    ...(args[1] === "--execute" && apiToken ? { apiToken } : {}),
    ...(email ? { email } : {}),
  });
  console.info(JSON.stringify(result));
} catch {
  console.error(JSON.stringify({ event: "cloudflare.database_command_failed" }));
  process.exitCode = 1;
}
