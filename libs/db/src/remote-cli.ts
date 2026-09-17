import { remoteErrorCode } from "./remote-input.ts";
import { runRemoteDatabaseCommand } from "./remote-command.ts";

interface CliResult {
  readonly code: 0 | 1;
  readonly error: string;
  readonly output: string;
}

type CliInput = Readonly<AsyncIterable<unknown>> | readonly unknown[];

const MAX_INPUT_BYTES = 16_384;
const COMMAND_ARGUMENTS_START = 2;

async function readInput(stdin: CliInput): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stdin) {
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

async function runRemoteCli(args: readonly string[], stdin: CliInput): Promise<CliResult> {
  try {
    const input = await readInput(stdin);
    const result = await runRemoteDatabaseCommand(args, input);
    return { code: 0, error: "", output: JSON.stringify(result) };
  } catch (error) {
    const failure = { code: remoteErrorCode(error), event: "database.remote_failed", ok: false };
    return { code: 1, error: JSON.stringify(failure), output: "" };
  }
}

if (import.meta.main) {
  const result = await runRemoteCli(process.argv.slice(COMMAND_ARGUMENTS_START), process.stdin);
  if (result.output !== "") {
    process.stdout.write(`${result.output}\n`);
  }
  if (result.error !== "") {
    process.stderr.write(`${result.error}\n`);
  }
  process.exitCode = result.code;
}

export { runRemoteCli };
