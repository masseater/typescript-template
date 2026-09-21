import { effectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";

const monitorWorkerVite = (): {
  readonly pack: {
    readonly deps: {
      readonly alwaysBundle: readonly string[];
      readonly onlyBundle: readonly string[];
    };
    readonly entry: { readonly index: string };
    readonly format: string;
    readonly outExtensions: () => { readonly js: ".js" };
    readonly platform: string;
    readonly target: string;
  };
  readonly run: { readonly tasks: Readonly<Record<string, unknown>> };
} => ({
  pack: {
    deps: {
      alwaysBundle: ["effect", "@repo/monitor"],
      onlyBundle: ["effect", "@repo/monitor"],
    },
    entry: { index: "src/worker.ts" },
    format: "esm",
    outExtensions: (): { readonly js: ".js" } => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectDiagnostics,
      build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
      ...lifecycle({
        prepush: ["check:effect"],
        prepr: ["build"],
      }),
    },
  },
});

export { monitorWorkerVite };
