import { browser, browserCommand } from "./browser.ts";
import { connection, logs, start, status, stop } from "./applications.ts";
import type { App } from "./local-environment.ts";
import { appSchema } from "./local-environment.ts";
import { parse } from "valibot";
import { setup } from "./setup.ts";

const firstUserArgumentIndex = 2;
const globalCommands = new Map<string, () => Promise<unknown>>([
  ["connect", connection],
  ["setup", setup],
  ["status", status],
]);
const appCommands = new Map<string, (app: App) => Promise<unknown>>([
  ["browser", browser],
  ["logs", logs],
  ["start", start],
  ["stop", stop],
]);

function writeReport(report: unknown): void {
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

async function runAppCommand(
  action: string,
  appName: string | undefined,
  browserArguments: readonly string[],
): Promise<void> {
  const app = parse(appSchema, appName);
  if (action === "browser-command") {
    await browserCommand(app, browserArguments);
    return;
  }
  const command = appCommands.get(action);
  if (command === undefined) {
    throw new Error("Unsupported local application command");
  }
  writeReport(await command(app));
}

async function execute(): Promise<void> {
  const [action = "", appName, ...browserArguments] = process.argv.slice(firstUserArgumentIndex);
  const command = globalCommands.get(action);
  if (command === undefined) {
    await runAppCommand(action, appName, browserArguments);
  } else {
    writeReport(await command());
  }
}

try {
  await execute();
} catch {
  process.stderr.write(
    `${JSON.stringify({
      event: "local.application_command_failed",
      ok: false,
      remediation:
        "Check vp run --filter @template/dev setup, local configuration permissions, build output, tmux and agent-browser doctor. Credentials are never printed.",
    })}\n`,
  );
  process.exitCode = 1;
}
