// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { homedir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { rolldown } from "vite/rolldown";

const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const DIGEST_LENGTH = 16;
const cacheDirectory = path.join(homedir(), ".cache", "vp-otel");
const workerdConditions = ["workerd", "worker", "browser", "import", "default"];

async function digest(code: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)),
  );
  return Array.from(bytes, (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0"))
    .join("")
    .slice(0, DIGEST_LENGTH);
}

async function cached(name: string, code: string): Promise<string> {
  const file = path.join(cacheDirectory, `${name}-${await digest(code)}.mjs`);
  await mkdir(cacheDirectory, { recursive: true });
  await writeFile(file, code, { flag: "wx" }).catch((error: unknown) => {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
      throw error;
    }
  });
  return file;
}

async function bundle(
  entry: string,
  target: {
    readonly conditionNames?: readonly string[];
    readonly define?: Readonly<Record<string, string>>;
    readonly platform: "browser" | "node";
  },
): Promise<string> {
  const { conditionNames, define, platform } = target;
  const build = await rolldown({
    external: [/^node:/u],
    input: fileURLToPath(new URL(entry, import.meta.url)),
    logLevel: "silent",
    platform,
    ...(conditionNames === undefined ? {} : { resolve: { conditionNames: [...conditionNames] } }),
    transform: { define: { ...define } },
  });
  const { output } = await build.generate({ codeSplitting: false, format: "esm" });
  await build.close();
  const [{ code }, ...rest] = output;
  if (rest.length > 0) {
    throw new Error(`${entry} bundled into ${String(output.length)} files`);
  }
  return cached(path.parse(entry).name, code);
}

async function instrumentationBundles(
  endpoint: string,
): Promise<{ readonly hook: string; readonly workerdSdk: string }> {
  const [hook, workerdSdk] = await Promise.all([
    bundle("hook.ts", { platform: "node" }),
    bundle("workerd-sdk.ts", {
      conditionNames: workerdConditions,
      define: { PERF_OTLP_TRACES_URL: JSON.stringify(`${endpoint}/v1/traces`) },
      platform: "browser",
    }),
  ]);
  return { hook, workerdSdk };
}

export { instrumentationBundles };
