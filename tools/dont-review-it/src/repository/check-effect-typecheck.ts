#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath, pathToFileURL } from "node:url";

const viteModule = fileURLToPath(import.meta.resolve("@repo/vite-config"));
const script = path.join(path.dirname(viteModule), "effect-typecheck.ts");
const loaded = (await import(pathToFileURL(script).href)) as {
  startEffectTypecheckCli: () => number;
};
loaded.startEffectTypecheckCli();
