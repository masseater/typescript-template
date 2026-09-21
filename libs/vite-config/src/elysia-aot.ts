import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { aot } from "elysia/plugin/aot/vite";

import type { Plugin } from "vite-plus";

const elysiaEntry = fileURLToPath(import.meta.resolve("elysia"));

let cloudflareStubsRegistered = false;

function registerCloudflareStubs(): void {
  if (cloudflareStubsRegistered) {
    return;
  }
  register(new URL("./cloudflare-workers-loader.mjs", import.meta.url).href);
  cloudflareStubsRegistered = true;
}

function elysiaAot(appRoot: string): Plugin {
  registerCloudflareStubs();
  const { apply, buildStart, resolveId, ...plugin } = aot(
    path.join(appRoot, "src/shared/server-api/server-app.ts"),
    {
      strip: true,
      target: "workerd",
    },
  );
  void apply;
  let started: Promise<void> | undefined;
  function ensureCompiled(this: unknown): Promise<void> {
    started ??= Promise.resolve(buildStart.call(this as never));
    return started;
  }
  return {
    ...plugin,
    applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
    async buildStart() {
      await ensureCompiled.call(this);
    },
    async configureServer() {
      await ensureCompiled.call(this);
    },
    resolveId(id) {
      if (id === "elysia") {
        return elysiaEntry;
      }
      return resolveId(id);
    },
  };
}

export { elysiaAot };
