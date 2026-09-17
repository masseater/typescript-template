import { remoteErrorCode } from "./remote-input.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";

const MAX_INPUT_BYTES = 16_384;
const COMMAND_ARGUMENTS_START = 2;

async function readInput(): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    if (!Buffer.isBuffer(chunk)) {
      throw new TypeError("REMOTE_INPUT_INVALID");
    }
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) {
      throw new Error("REMOTE_INPUT_INVALID");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

try {
  const input = await readInput();
  const result = await runRemoteDatabaseCommand(process.argv.slice(COMMAND_ARGUMENTS_START), input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const failure = { code: remoteErrorCode(error), event: "database.remote_failed", ok: false };
  process.stderr.write(`${JSON.stringify(failure)}\n`);
  process.exitCode = 1;
}
