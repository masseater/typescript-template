import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { BootstrapFailure, backendUrl, fail } from "./config.ts";
import { readCredentials } from "./credentials.ts";

export const validateStateCommand = Effect.fn("validateStateCommand")(function* (
  args: readonly string[],
) {
  if (
    args.some(
      (arg) =>
        arg.startsWith("--show-secrets") ||
        arg.startsWith("--plaintext") ||
        arg.startsWith("--logflow") ||
        arg.startsWith("--verbose") ||
        arg.startsWith("-v") ||
        arg.startsWith("--logtostderr") ||
        arg.startsWith("--tracing") ||
        arg.startsWith("--debug"),
    )
  )
    return yield* fail("plaintext_secret_output_forbidden");
  const command = args[0];
  if (!["preview", "up", "refresh", "config", "stack"].includes(command ?? ""))
    return yield* fail("state_command_not_allowed");
  if (command === "config" && args[1] !== "set" && args[1] !== "set-all")
    return yield* fail("state_command_not_allowed");
  if (command === "stack" && args[1] !== "init" && args[1] !== "select")
    return yield* fail("state_command_not_allowed");
});

export const validateOutputRead = Effect.fn("validateOutputRead")(function* (name: string) {
  if (name !== "databaseId" && name !== "applicationSettings")
    return yield* fail("state_output_not_allowed");
});

const stateEnvironment = Effect.fn("stateEnvironment")(function* () {
  const passphrase = process.env["PULUMI_CONFIG_PASSPHRASE"];
  const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
  if (!passphrase || !apiToken) return yield* fail("state_environment_missing");
  const credentials = yield* readCredentials(
    fileURLToPath(new URL("../.state/r2.json", import.meta.url)),
  );
  if (!credentials) return yield* fail("state_credentials_missing");
  return {
    PATH: process.env["PATH"],
    HOME: process.env["HOME"],
    USER: process.env["USER"],
    PULUMI_CONFIG_PASSPHRASE: passphrase,
    CLOUDFLARE_API_TOKEN: apiToken,
    PULUMI_HOME: fileURLToPath(new URL("../.state/pulumi-home", import.meta.url)),
    PULUMI_BACKEND_URL: yield* backendUrl(credentials),
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    AWS_REGION: "auto",
  };
});

export const runWithState = Effect.fn("runWithState")(function* (args: readonly string[]) {
  yield* validateStateCommand(args);
  const env = yield* stateEnvironment();
  return yield* Effect.callback<number, BootstrapFailure>((resume) => {
    const child = spawn("pulumi", [...args], { shell: false, stdio: "inherit", env });
    child.on("error", () => resume(fail("state_command_failed")));
    child.on("exit", (code) => resume(Effect.succeed(code ?? 1)));
  });
});

export const readStackOutput = Effect.fn("readStackOutput")(function* (cwd: string, name: string) {
  yield* validateOutputRead(name);
  const env = yield* stateEnvironment();
  const output = yield* Effect.callback<string, BootstrapFailure>((resume) => {
    const child = spawn("pulumi", ["stack", "output", "--json", name, "--cwd", cwd], {
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
      env,
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () => resume(fail("state_output_failed")));
    child.on("close", (code) =>
      resume(
        code === 0
          ? Effect.succeed(Buffer.concat(chunks).toString("utf8"))
          : fail("state_output_failed"),
      ),
    );
  });
  return yield* Effect.try({
    try: (): unknown => JSON.parse(output),
    catch: () => new BootstrapFailure({ code: "state_output_failed" }),
  });
});
