import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { secretViolations } from "./secrets.ts";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const options = { cwd: root, maxBuffer: 32 * 1024 * 1024 };
try {
  const { stdout } = await run("git", ["ls-files", "--cached", "-z"], options);
  const failures: { file: string; rules: string[] }[] = [];
  for (const file of stdout.split("\0").filter(Boolean)) {
    const result = await run("git", ["show", `:${file}`], options);
    const rules = secretViolations(file, result.stdout);
    if (rules.length) failures.push({ file, rules });
  }
  console.log(
    JSON.stringify({ event: "quality.staged_secrets", ok: failures.length === 0, failures }),
  );
  if (failures.length) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ event: "quality.staged_secrets_failed", ok: false }));
  process.exitCode = 1;
}
