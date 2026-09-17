import { backendUrl } from "./config.ts";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { readCredentials } from "./credentials.ts";
import { spawn } from "node:child_process";
import { text } from "node:stream/consumers";

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

function validateStateCommand(args: readonly string[]): void {
  if (args.some((arg) => FORBIDDEN_ARGUMENT_PREFIXES.some((prefix) => arg.startsWith(prefix)))) {
    throw new Error("plaintext_secret_output_forbidden");
  }
  const [command, subcommand] = args;
  if (!["preview", "up", "refresh", "config", "stack"].includes(command ?? "")) {
    throw new Error("state_command_not_allowed");
  }
  if (command === "config" && subcommand !== "set" && subcommand !== "set-all") {
    throw new Error("state_command_not_allowed");
  }
  if (command === "stack" && subcommand !== "init" && subcommand !== "select") {
    throw new Error("state_command_not_allowed");
  }
}

function validateOutputRead(name: string): void {
  if (name !== "databaseId" && name !== "applicationSettings") {
    throw new Error("state_output_not_allowed");
  }
}

async function stateEnvironment(): Promise<NodeJS.ProcessEnv> {
  const passphrase = process.env["PULUMI_CONFIG_PASSPHRASE"];
  const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
  if (passphrase === undefined || passphrase === "" || apiToken === undefined || apiToken === "") {
    throw new Error("state_environment_missing");
  }
  const credentials = await readCredentials(
    fileURLToPath(new URL("../.state/r2.json", import.meta.url)),
  );
  if (!credentials) {
    throw new Error("state_credentials_missing");
  }
  return {
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_REGION: "auto",
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    CLOUDFLARE_API_TOKEN: apiToken,
    HOME: process.env["HOME"],
    PATH: process.env["PATH"],
    PULUMI_BACKEND_URL: backendUrl(credentials),
    PULUMI_CONFIG_PASSPHRASE: passphrase,
    PULUMI_HOME: fileURLToPath(new URL("../.state/pulumi-home", import.meta.url)),
    USER: process.env["USER"],
  };
}

async function runWithState(args: readonly string[]): Promise<number> {
  validateStateCommand(args);
  const env = await stateEnvironment();
  const child = spawn("pulumi", [...args], { env, shell: false, stdio: "inherit" });
  try {
    const exitArguments: unknown[] = await once(child, "exit");
    const [code] = exitArguments;
    return typeof code === "number" ? code : FAILED_EXIT_CODE;
  } catch (error: unknown) {
    throw new Error("state_command_failed", { cause: error });
  }
}

async function spawnForOutput(
  args: readonly string[],
  env: Readonly<NodeJS.ProcessEnv>,
): Promise<string> {
  const child = spawn("pulumi", [...args], {
    env,
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
  });
  try {
    const [output, closeArguments]: [string, unknown[]] = await Promise.all([
      text(child.stdout),
      once(child, "close"),
    ]);
    const [code] = closeArguments;
    if (code === 0) {
      return output;
    }
  } catch (error: unknown) {
    throw new Error("state_output_failed", { cause: error });
  }
  throw new Error("state_output_failed");
}

async function readStackOutput(cwd: string, name: string): Promise<unknown> {
  validateOutputRead(name);
  const env = await stateEnvironment();
  const output = await spawnForOutput(["stack", "output", "--json", name, "--cwd", cwd], env);
  return JSON.parse(output);
}

export { readStackOutput, runWithState, validateOutputRead, validateStateCommand };
