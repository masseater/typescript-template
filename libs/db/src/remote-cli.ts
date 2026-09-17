import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { remoteErrorCode } from "./remote-input.ts";

export async function runRemoteCli(
  args: string[],
  stdin: Iterable<unknown> | AsyncIterable<unknown>,
): Promise<{ code: 0 | 1; output: string; error: string }> {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stdin) {
      if (!Buffer.isBuffer(chunk)) throw new Error("REMOTE_INPUT_INVALID");
      size += chunk.length;
      if (size > 16_384) throw new Error("REMOTE_INPUT_INVALID");
      chunks.push(chunk);
    }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return {
      code: 0,
      output: JSON.stringify(await runRemoteDatabaseCommand(args, input)),
      error: "",
    };
  } catch (error) {
    return {
      code: 1,
      output: "",
      error: JSON.stringify({
        ok: false,
        event: "database.remote_failed",
        code: remoteErrorCode(error),
      }),
    };
  }
}

if (import.meta.main) {
  const result = await runRemoteCli(process.argv.slice(2), process.stdin);
  if (result.output) console.info(result.output);
  if (result.error) console.error(result.error);
  process.exitCode = result.code;
}
