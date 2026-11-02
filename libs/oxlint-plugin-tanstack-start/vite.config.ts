import { defineConfig } from "vite-plus";

const local = (path: string): string => new URL(path, import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: {
      "@typescript-eslint/rule-tester": local("upstream/rule-tester.ts"),
      "../rules/no-async-client-component/no-async-client-component.rule": local(
        "upstream/rules/no-async-client-component.ts",
      ),
      "../rules/no-client-code-in-server-component/no-client-code-in-server-component.rule": local(
        "upstream/rules/no-client-code-in-server-component.ts",
      ),
      vitest: "vite-plus/test",
    },
  },
  test: {
    include: ["src/**/*.test.ts", "upstream/src/__tests__/*.test.ts"],
  },
});
