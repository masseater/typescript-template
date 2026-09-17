import { BootstrapFailure, backendUrl, fail } from "./config.ts";
import { Effect } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { readCredentials } from "./credentials.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";

const FORBIDDEN_ARGUMENT_PREFIXES = [
  "--show-secrets",
  "--plaintext",
  "--logflow",
  "--verbose",
  "-v",
  "--logtostderr",
  "--tracing",
  "--debug",
];
const FAILED_EXIT_CODE = 1;

const validateStateCommand = Effect.fn("validateStateCommand")(function* validateStateCommand(
  args: readonly string[],
) {
  if (args.some((arg) => FORBIDDEN_ARGUMENT_PREFIXES.some((prefix) => arg.startsWith(prefix)))) {
    return yield* fail("plaintext_secret_output_forbidden");
  }
  const [command, subcommand] = args;
  if (
    !["preview", "up", "refresh", "config", "stack"].includes(command ?? "") ||
    (command === "config" && subcommand !== "set" && subcommand !== "set-all") ||
    (command === "stack" && subcommand !== "init" && subcommand !== "select")
  ) {
    return yield* fail("state_command_not_allowed");
  }
});

const validateOutputRead = Effect.fn("validateOutputRead")(function* validateOutputRead(
  name: string,
) {
  if (name !== "databaseId" && name !== "applicationSettings") {
    return yield* fail("state_output_not_allowed");
  }
});

const stateEnvironment = Effect.fn("stateEnvironment")(function* stateEnvironment() {
  // oxlint-disable-next-line node/no-process-env
  const passphrase = process.env["PULUMI_CONFIG_PASSPHRASE"];
  // oxlint-disable-next-line node/no-process-env
  const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
  if (passphrase === undefined || passphrase === "" || apiToken === undefined || apiToken === "") {
    return yield* fail("state_environment_missing");
  }
  const credentials = yield* readCredentials(
    fileURLToPath(new URL("../.state/r2.json", import.meta.url)),
  );
  if (!credentials) {
    return yield* fail("state_credentials_missing");
  }
  return {
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_REGION: "auto",
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    CLOUDFLARE_API_TOKEN: apiToken,
    // oxlint-disable-next-line node/no-process-env
    HOME: process.env["HOME"],
    // oxlint-disable-next-line node/no-process-env
    PATH: process.env["PATH"],
    PULUMI_BACKEND_URL: yield* backendUrl(credentials),
    PULUMI_CONFIG_PASSPHRASE: passphrase,
    PULUMI_HOME: fileURLToPath(new URL("../.state/pulumi-home", import.meta.url)),
    // oxlint-disable-next-line node/no-process-env
    USER: process.env["USER"],
  };
});

const runWithState = Effect.fn("runWithState")(function* runWithState(args: readonly string[]) {
  yield* validateStateCommand(args);
  const env = yield* stateEnvironment();
  return yield* Effect.callback<number, BootstrapFailure>((resume) => {
    const child = spawn("pulumi", [...args], { env, shell: false, stdio: "inherit" });
    child.on("error", () => {
      resume(fail("state_command_failed"));
    });
    child.on("exit", (code) => {
      resume(Effect.succeed(code ?? FAILED_EXIT_CODE));
    });
  });
});

const readStackOutput = Effect.fn("readStackOutput")(function* readStackOutput(
  cwd: string,
  name: string,
) {
  yield* validateOutputRead(name);
  const env = yield* stateEnvironment();
  const output = yield* Effect.callback<string, BootstrapFailure>((resume) => {
    const child = spawn("pulumi", ["stack", "output", "--json", name, "--cwd", cwd], {
      env,
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const chunks: Buffer[] = [];
    // oxlint-disable-next-line typescript/strict-void-return, typescript/prefer-readonly-parameter-types
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () => {
      resume(fail("state_output_failed"));
    });
    child.on("close", (code) => {
      resume(
        code === 0
          ? Effect.succeed(Buffer.concat(chunks).toString("utf-8"))
          : fail("state_output_failed"),
      );
    });
  });
  return yield* Effect.try({
    catch: () => new BootstrapFailure({ code: "state_output_failed" }),
    try: (): unknown => JSON.parse(output),
  });
});

export { readStackOutput, runWithState, validateOutputRead, validateStateCommand };
