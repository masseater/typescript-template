import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as baseTest } from "vite-plus/test";
import { smarthrTokens, tokenViolations, untouchedTokens } from "./design-system.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const stylesheet = path.join(root, "libs/ui/src/styles.css");
const components = path.join(root, "libs/ui/src/shared/ui");

const test = baseTest.extend<{ directory: string }>({
  directory: async ({}, provide) => {
    const directory = await mkdtemp(path.join(tmpdir(), "typescript-template-design-"));
    const plugin = createRequire(import.meta.url).resolve("@shadcn/lint");
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ name: "design-system-probe", type: "module" }),
    );
    await writeFile(
      path.join(directory, "components.json"),
      JSON.stringify({ tailwind: { css: stylesheet }, aliases: { ui: components } }),
    );
    await writeFile(
      path.join(directory, "vite.config.ts"),
      `export default {
        lint: {
          jsPlugins: [${JSON.stringify(plugin)}],
          settings: { shadcn: { ui: "@template/ui/ui" } },
          rules: {
            "shadcn/no-restyle": ["error", { allow: ["layout", "spacing"] }],
            "shadcn/no-raw-colors": "error",
            "shadcn/no-arbitrary-values": "error",
            "shadcn/no-unknown-classes": "error"
          }
        }
      };`,
    );
    try {
      await provide(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
});

test("the stylesheet carries the smarthr-ui token values", async () => {
  expect(tokenViolations(await readFile(stylesheet, "utf8"))).toEqual([]);
});

test.for(Object.keys(smarthrTokens))("reports %s when it drifts from smarthr-ui", (token) => {
  expect(tokenViolations(`:root { ${token}: rebeccapurple; }`)).toContainEqual(
    expect.stringContaining(token),
  );
});

test.for(untouchedTokens)("reports %s when it is redefined", (token) => {
  expect(tokenViolations(`@theme { ${token}: 8px; }`)).toContainEqual(
    expect.stringContaining(token),
  );
});

test.for([
  ["bg-destructive", "shadcn(no-restyle)"],
  ["text-red-500", "shadcn(no-raw-colors)"],
  ["text-[13px]", "shadcn(no-arbitrary-values)"],
  ["shadow-xs", "shadcn(no-unknown-classes)"],
] as const)(
  "the design-system lint rules report %s from the repository configuration",
  async ([className, diagnostic], { directory }) => {
    await writeFile(
      path.join(directory, "probe.tsx"),
      `import { Button } from "@template/ui/ui";\n` +
        `export const Probe = () => <Button className="${className}">probe</Button>;\n`,
    );
    const result = spawnSync("vp", ["lint", "probe.tsx"], {
      encoding: "utf8",
      cwd: directory,
      timeout: 60_000,
      env: {
        ...process.env,
        PATH: `${path.join(root, "node_modules/.bin")}${path.delimiter}${process.env["PATH"] ?? ""}`,
      },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toContain(diagnostic);
  },
);
