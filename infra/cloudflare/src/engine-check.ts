import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import * as v from "valibot";

try {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const executable = process.argv[2];
  if (!executable || !path.isAbsolute(executable)) throw new Error("local_cli_path_required");
  const binary = await realpath(executable);
  if (!binary.startsWith(path.join(root, ".local", "tools") + path.sep))
    throw new Error("local_cli_path_required");
  if (process.platform !== "darwin") throw new Error("network_sandbox_requires_macos");
  const isolated = await mkdtemp(path.join(root, ".local", "pulumi-engine-"));
  const project = path.join(isolated, "project");
  const state = path.join(isolated, "state");
  await mkdir(project, { mode: 0o700 });
  await mkdir(state, { mode: 0o700 });
  await mkdir(path.join(isolated, "tmp"), { mode: 0o700 });
  await writeFile(
    path.join(project, "Pulumi.yaml"),
    [
      "name: template-runtime-probe",
      "runtime:",
      "  name: nodejs",
      "  options:",
      "    typescript: false",
      `main: ${JSON.stringify(fileURLToPath(new URL("./runtime-probe.ts", import.meta.url)))}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
  await writeFile(
    path.join(project, "package.json"),
    JSON.stringify({
      name: "template-runtime-probe",
      private: true,
      type: "module",
    }),
    { mode: 0o600 },
  );
  const environment = {
    PATH: process.env["PATH"],
    USER: userInfo().username,
    HOME: userInfo().homedir,
    TMPDIR: path.join(isolated, "tmp"),
    PULUMI_HOME: path.join(isolated, "pulumi-home"),
    PULUMI_BACKEND_URL: pathToFileURL(state).href,
    PULUMI_CONFIG_PASSPHRASE: randomBytes(32).toString("hex"),
    PULUMI_DISABLE_AUTOMATIC_PLUGIN_ACQUISITION: "true",
    PULUMI_IGNORE_AMBIENT_PLUGINS: "true",
    PULUMI_SKIP_UPDATE_CHECK: "true",
    PULUMI_DISABLE_CHECKPOINT_BACKUPS: "true",
    TEMPLATE_ENGINE_PROBE: "true",
  };
  async function command(label: string, args: string[]) {
    try {
      const result = await promisify(execFile)(
        "/usr/bin/sandbox-exec",
        [
          "-p",
          `(version 1)(allow default)(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))(deny file-write*)(allow file-write* (subpath ${JSON.stringify(isolated)}) (literal "/dev/null"))`,
          binary,
          ...args,
        ],
        { cwd: project, env: environment, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
      );
      await writeFile(path.join(isolated, `${label}.log`), result.stdout + result.stderr, {
        mode: 0o600,
      });
      return result.stdout;
    } catch (error: unknown) {
      if (error instanceof Error && "stdout" in error && "stderr" in error) {
        await writeFile(
          path.join(isolated, `${label}.log`),
          `${String(error.stdout)}${String(error.stderr)}`,
          { mode: 0o600 },
        );
      }
      throw new Error(`engine_${label}_failed`, { cause: error });
    }
  }
  assert.equal((await command("version", ["version"])).trim(), "v3.262.0");
  await command("init", [
    "stack",
    "init",
    "isolated",
    "--secrets-provider",
    "passphrase",
    "--non-interactive",
  ]);
  await command("preview", ["preview", "--non-interactive", "--json"]);
  await command("up", ["up", "--yes", "--skip-preview", "--non-interactive", "--json"]);
  const output: unknown = JSON.parse(await command("outputs", ["stack", "output", "--json"]));
  const evidence = v.parse(
    v.object({
      runtimeEvidence: v.object({
        engineConnected: v.literal(true),
        monitorConnected: v.literal(true),
        compilerLoaded: v.literal(false),
        secretPreserved: v.literal(true),
      }),
      probeSecret: v.literal("[secret]"),
    }),
    output,
  );
  const checkpoint: unknown = JSON.parse(await command("export", ["stack", "export"]));
  const verifiedState = v.parse(
    v.object({
      deployment: v.object({
        resources: v.array(v.object({ type: v.literal("pulumi:pulumi:Stack") })),
      }),
    }),
    checkpoint,
  );
  assert.equal(verifiedState.deployment.resources.length, 1);
  console.log(
    JSON.stringify({
      event: "pulumi.engine_verified",
      cliVersion: "3.262.0",
      ...evidence.runtimeEvidence,
      cloudResources: 0,
      outboundNetwork: "loopback-only",
      evidenceDirectory: isolated,
    }),
  );
} catch (error: unknown) {
  const code =
    error instanceof Error && /^engine_[a-z]+_failed$/.test(error.message)
      ? error.message
      : "engine_verification_failed";
  console.error(JSON.stringify({ event: code }));
  process.exitCode = 1;
}
