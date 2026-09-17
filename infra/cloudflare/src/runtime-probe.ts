import { Worker, WorkerVersion, ZeroTrustAccessApplication } from "@pulumi/cloudflare";
import { getProject, isSecret, runtime, secret } from "@pulumi/pulumi";
import type { Output } from "@pulumi/pulumi";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
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
  assert.notEqual(process.env["PULUMI_NODEJS_TYPESCRIPT"], "true");
  assert.equal(process.execArgv.includes("tsx"), true);
  assert.equal(typeof Worker, "function");
  assert.equal(typeof WorkerVersion, "function");
  assert.equal(typeof ZeroTrustAccessApplication, "function");
}

async function assertEngineConnected(): Promise<void> {
  if (process.env["TEMPLATE_ENGINE_PROBE"] !== "true") {
    return;
  }
  assert.equal(runtime.hasEngine(), true);
  assert.equal(runtime.hasMonitor(), true);
  assert.equal(getProject(), "template-runtime-probe");
  await runtime.requirePulumiVersion(">=3.262.0");
}

async function resolvedValue(value: Output<string>): Promise<string> {
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
  assert.equal(compilerModules.length, 0);
}

async function probeRuntime(): Promise<ProbeResult> {
  assertProvidersLoadedWithoutCompiler();
  await assertEngineConnected();
  const value = secret(validateAuthSecret(PROBE_SECRET));
  assert.equal(await isSecret(value), true);
  assert.equal(await resolvedValue(value), PROBE_SECRET);
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
