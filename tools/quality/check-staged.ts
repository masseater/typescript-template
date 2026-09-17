import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { secretViolations } from "./secrets.ts";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const bytesPerMebibyte = 1024;
const maxOutputMebibytes = 32;
const options = { cwd: root, maxBuffer: maxOutputMebibytes * bytesPerMebibyte * bytesPerMebibyte };
try {
  const { stdout } = await run("git", ["ls-files", "--cached", "-z"], options);
  const failures: { file: string; rules: string[] }[] = [];
  for (const file of stdout.split("\0").filter(Boolean)) {
    const result = await run("git", ["show", `:${file}`], options);
    const rules = secretViolations(file, result.stdout);
    if (rules.length > 0) {
      failures.push({ file, rules });
    }
  }
  process.stdout.write(
    `${JSON.stringify({ event: "quality.staged_secrets", failures, ok: failures.length === 0 })}\n`,
  );
  if (failures.length > 0) {
    process.exitCode = 1;
  }
} catch {
  process.stderr.write(
    `${JSON.stringify({ event: "quality.staged_secrets_failed", ok: false })}\n`,
  );
  process.exitCode = 1;
}
