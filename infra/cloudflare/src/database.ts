import { object, parse, string } from "valibot";
import { readEnvironment } from "./environment.ts";
import { readStackOutput } from "@template/infra-bootstrap/state";
import { runRemoteDatabaseCommand } from "@template/db/remote";

const FIRST_USER_ARGUMENT_INDEX = 2;

const settingsSchema = object({ accountId: string() });

async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    if (!Buffer.isBuffer(chunk)) {
      throw new TypeError("database_input_invalid");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

try {
  const args = process.argv.slice(FIRST_USER_ARGUMENT_INDEX);
  const [operation, mode] = args;
  const shared = `${import.meta.dirname}/../shared`;
  const settings = parse(settingsSchema, await readStackOutput(shared, "applicationSettings"));
  const databaseId = await readStackOutput(shared, "databaseId");
  const email = operation === "bootstrap" ? await readStandardInput() : "";
  const apiToken = readEnvironment().CLOUDFLARE_API_TOKEN;
  const result = await runRemoteDatabaseCommand(args, {
    accountId: settings.accountId,
    databaseId,
    ...(mode === "--execute" && apiToken !== undefined && apiToken !== "" ? { apiToken } : {}),
    ...(email === "" ? {} : { email }),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch {
  process.stderr.write(`${JSON.stringify({ event: "cloudflare.database_command_failed" })}\n`);
  process.exitCode = 1;
}
