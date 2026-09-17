import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { backendUrl } from "./config.ts";
import { readCredentials } from "./credentials.ts";

export function validateStateCommand(args: readonly string[]): void {
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
  ) {
    throw new Error("plaintext_secret_output_forbidden");
  }
  const command = args[0];
  if (!["preview", "up", "refresh", "config", "stack"].includes(command ?? ""))
    throw new Error("state_command_not_allowed");
  if (command === "config" && args[1] !== "set" && args[1] !== "set-all")
    throw new Error("state_command_not_allowed");
  if (command === "stack" && args[1] !== "init" && args[1] !== "select")
    throw new Error("state_command_not_allowed");
}

export function validateOutputRead(name: string): void {
  if (name !== "databaseId" && name !== "applicationSettings")
    throw new Error("state_output_not_allowed");
}

async function stateEnvironment() {
  if (!process.env["PULUMI_CONFIG_PASSPHRASE"] || !process.env["CLOUDFLARE_API_TOKEN"])
    throw new Error("state_environment_missing");
  const credentials = await readCredentials(
    fileURLToPath(new URL("../.state/r2.json", import.meta.url)),
  );
  if (!credentials) throw new Error("state_credentials_missing");
  return {
    PATH: process.env["PATH"],
    HOME: process.env["HOME"],
    USER: process.env["USER"],
    PULUMI_CONFIG_PASSPHRASE: process.env["PULUMI_CONFIG_PASSPHRASE"],
    CLOUDFLARE_API_TOKEN: process.env["CLOUDFLARE_API_TOKEN"],
    PULUMI_HOME: fileURLToPath(new URL("../.state/pulumi-home", import.meta.url)),
    PULUMI_BACKEND_URL: backendUrl(credentials),
    AWS_ACCESS_KEY_ID: credentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
    AWS_REGION: "auto",
  };
}

export async function runWithState(args: readonly string[]): Promise<number> {
  validateStateCommand(args);
  const env = await stateEnvironment();
  return new Promise((resolve, reject) => {
    const child = spawn("pulumi", [...args], { shell: false, stdio: "inherit", env });
    child.on("error", () => reject(new Error("state_command_failed")));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

export async function readStackOutput(cwd: string, name: string): Promise<unknown> {
  validateOutputRead(name);
  const env = await stateEnvironment();
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn("pulumi", ["stack", "output", "--json", name, "--cwd", cwd], {
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
      env,
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", () => reject(new Error("state_output_failed")));
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks).toString("utf8"))
        : reject(new Error("state_output_failed")),
    );
  });
  return JSON.parse(output) as unknown;
}
