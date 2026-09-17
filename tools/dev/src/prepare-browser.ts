import { chmod, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const directory = path.join(path.dirname(require.resolve("agent-browser/package.json")), "bin");
for (const name of await readdir(directory)) {
  if (/^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/.test(name)) {
    await chmod(path.join(directory, name), 0o755);
  }
}
console.info(
  JSON.stringify({ event: "local.browser_cli_prepared", globalConfigurationChanged: false }),
);
