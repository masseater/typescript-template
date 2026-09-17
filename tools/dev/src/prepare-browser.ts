import { chmod, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const executableMode = 0o755;
const require = createRequire(import.meta.url);
const directory = path.join(path.dirname(require.resolve("agent-browser/package.json")), "bin");
const entries = await readdir(directory);
const binaries = entries.filter((name) =>
  /^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/u.test(name),
);
await Promise.all(
  binaries.map(async (name) => {
    await chmod(path.join(directory, name), executableMode);
  }),
);
process.stdout.write(
  `${JSON.stringify({ event: "local.browser_cli_prepared", globalConfigurationChanged: false })}\n`,
);
