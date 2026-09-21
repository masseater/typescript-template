import { register } from "node:module";
import path from "node:path";

import { aot } from "elysia/plugin/aot/vite";

import type { Plugin } from "vite-plus";

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
  const { apply, ...plugin } = aot(path.join(appRoot, "src/shared/server-api/server-app.ts"), {
    production: false,
    target: "workerd",
  });
  void apply;
  return plugin;
}

export { elysiaAot };
