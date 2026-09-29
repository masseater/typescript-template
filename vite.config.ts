import { defineConfig } from "vite-plus";

const generated = [
  "**/routeTree.gen.ts",
  "**/drizzle/**/snapshot.json",
  ".claude/skills/**",
  ".claude/hooks/fallow-gate.sh",
  ".intent/**",
  "AGENTS.md",
  "skills-lock.json",
];

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: generated,
  },
  lint: {
    ignorePatterns: generated,
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
