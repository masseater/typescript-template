import { Worker, WorkerVersion } from "@pulumi/cloudflare";
import { getProject, isSecret, runtime, secret } from "@pulumi/pulumi";
import type { Output } from "@pulumi/pulumi";
// oxlint-disable-next-line import/no-nodejs-modules
import { createRequire } from "node:module";
import { invariant } from "es-toolkit";
import { readEnvironment } from "./environment.ts";
import { validateAuthSecret } from "./config.ts";

const PROBE_SECRET = "runtime-probe-not-a-real-secret-0001";

interface RuntimeEvidence {
  compilerLoaded: boolean;
  engineConnected: boolean;
  monitorConnected: boolean;
  secretPreserved: boolean;
}

interface ProbeResult {
  probeSecret: Output<string>;
  runtimeEvidence: RuntimeEvidence;
}

function assertProvidersLoadedWithoutCompiler(): void {
  invariant(readEnvironment().PULUMI_NODEJS_TYPESCRIPT !== "true", "pulumi_typescript_enabled");
  invariant(typeof Worker === "function", "worker_provider_missing");
  invariant(typeof WorkerVersion === "function", "worker_version_provider_missing");
}

async function assertEngineConnected(): Promise<void> {
  if (readEnvironment().TEMPLATE_ENGINE_PROBE !== "true") {
    return;
  }
  invariant(runtime.hasEngine(), "engine_not_connected");
  invariant(runtime.hasMonitor(), "monitor_not_connected");
  invariant(getProject() === "template-runtime-probe", "probe_project_mismatch");
  await runtime.requirePulumiVersion(">=3.262.0");
}

async function resolvedValue(value: Readonly<Pick<Output<string>, "apply">>): Promise<string> {
  // oxlint-disable-next-line promise/avoid-new
  return new Promise((resolve) => {
    value.apply((resolved) => {
      resolve(resolved);
    });
  });
}

function assertNoCompilerModules(): void {
  const modules = Object.keys(createRequire(import.meta.url).cache);
  const compilerModules = modules.filter(
    (module) =>
      /\/(?:typescript(?:@[^/]+)?|ts-node(?:@[^/]+)?)\//u.test(module) &&
      !module.endsWith("/typescript/lib/version.cjs") &&
      !module.endsWith("/typescript/package.json"),
  );
  invariant(compilerModules.length === 0, "compiler_modules_loaded");
}

async function probeRuntime(): Promise<ProbeResult> {
  assertProvidersLoadedWithoutCompiler();
  await assertEngineConnected();
  const value = secret(validateAuthSecret(PROBE_SECRET));
  invariant(await isSecret(value), "probe_secret_not_secret");
  invariant((await resolvedValue(value)) === PROBE_SECRET, "probe_secret_changed");
  assertNoCompilerModules();
  const runtimeEvidence = {
    compilerLoaded: false,
    engineConnected: runtime.hasEngine(),
    monitorConnected: runtime.hasMonitor(),
    secretPreserved: await isSecret(value),
  };
  process.stdout.write(
    `${JSON.stringify({
      compilerLoaded: false,
      event: "pulumi.runtime_verified",
      secretPreserved: true,
    })}\n`,
  );
  return { probeSecret: value, runtimeEvidence };
}

const { probeSecret, runtimeEvidence } = await probeRuntime();

export { probeSecret, runtimeEvidence };
