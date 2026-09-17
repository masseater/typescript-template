// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, readdir } from "node:fs/promises";

const executableMode = 0o755;
const directory = new URL("bin/", import.meta.resolve("agent-browser/package.json"));
const entries = await readdir(directory);
const binaries = entries.filter((name) =>
  /^agent-browser-(?:darwin|linux(?:-musl)?)-(?:arm64|x64)$/u.test(name),
);
await Promise.all(
  binaries.map(async (name) => {
    await chmod(new URL(name, directory), executableMode);
  }),
);
process.stdout.write(
  `${JSON.stringify({ event: "local.browser_cli_prepared", globalConfigurationChanged: false })}\n`,
);
