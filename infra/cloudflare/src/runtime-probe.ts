import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { validateAuthSecret } from "./config.ts";

assert.notEqual(process.env["PULUMI_NODEJS_TYPESCRIPT"], "true");
assert.equal(process.execArgv.includes("tsx"), true);
assert.equal(typeof cloudflare.Worker, "function");
assert.equal(typeof cloudflare.WorkerVersion, "function");
if (process.env["TEMPLATE_ENGINE_PROBE"] === "true") {
  assert.equal(pulumi.runtime.hasEngine(), true);
  assert.equal(pulumi.runtime.hasMonitor(), true);
  assert.equal(pulumi.getProject(), "template-runtime-probe");
  await pulumi.runtime.requirePulumiVersion(">=3.262.0");
}
const value = pulumi.secret(validateAuthSecret("runtime-probe-not-a-real-secret-0001"));
assert.equal(await pulumi.isSecret(value), true);
await new Promise<void>((resolve) => {
  value.apply((resolved) => {
    assert.equal(resolved, "runtime-probe-not-a-real-secret-0001");
    resolve();
  });
});
const modules = Object.keys(createRequire(import.meta.url).cache);
const compilerModules = modules.filter(
  (module) =>
    /\/(?:typescript(?:@[^/]+)?|ts-node(?:@[^/]+)?)\//.test(module) &&
    !module.endsWith("/typescript/lib/version.cjs") &&
    !module.endsWith("/typescript/package.json"),
);
assert.equal(compilerModules.length, 0);
export const runtimeEvidence = {
  engineConnected: pulumi.runtime.hasEngine(),
  monitorConnected: pulumi.runtime.hasMonitor(),
  compilerLoaded: false,
  secretPreserved: await pulumi.isSecret(value),
};
export const probeSecret = value;
console.log(
  JSON.stringify({
    event: "pulumi.runtime_verified",
    compilerLoaded: false,
    secretPreserved: true,
  }),
);
