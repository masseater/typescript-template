import { runRemoteDatabaseCommand } from "./remote-command.ts";
import { remoteErrorCode } from "./remote-input.ts";

try {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    if (!Buffer.isBuffer(chunk)) throw new Error("REMOTE_INPUT_INVALID");
    size += chunk.length;
    if (size > 16_384) throw new Error("REMOTE_INPUT_INVALID");
    chunks.push(chunk);
  }
  const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  console.info(JSON.stringify(await runRemoteDatabaseCommand(process.argv.slice(2), input)));
} catch (error) {
  console.error(
    JSON.stringify({ ok: false, event: "database.remote_failed", code: remoteErrorCode(error) }),
  );
  process.exitCode = 1;
}
