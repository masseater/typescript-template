import {
  decisionRules,
  decisionTestRules,
  generated,
  lint as preset,
  requiredStack,
  steigerRules,
  textlintPresets,
  tracedRules,
} from "@r_masseater/msch/lint";
import type { ToolSections } from "@r_masseater/msch/vite";
import { workspaceSettings } from "@r_masseater/msch/workspace-settings";
import type { RuleSets } from "@r_masseater/msch/workspace-settings";
import { Array as Arr, pipe } from "effect";
import { defineConfig } from "vite-plus";
import type { UserConfig } from "vite-plus";

import { fallow } from "./fallow.config.ts";

type LintConfig = NonNullable<UserConfig["lint"]>;

const ruleSets: RuleSets = { decision: decisionRules, traced: tracedRules };

const workspace = await workspaceSettings({
  root: import.meta.dirname,
  ruleSets,
  dependencySets: {},
});

const overrides = [
  {
    files: [...workspace.lint.shadcnUi],
    rules: { "react/jsx-props-no-spreading": "off" },
  },
  {
    files: [...workspace.lint.publicEntries],
    rules: { "import/no-default-export": "off" },
  },
  ...workspace.lint.overrides,
  {
    files: [".github/**/*.ts"],
    rules: {
      "baseline-js/use-baseline": "off",
      "effecttsgo/async-function": "off",
      "effecttsgo/global-console": "off",
      "effecttsgo/global-fetch": "off",
      "effecttsgo/global-json": "off",
      "effecttsgo/missing-pipeable-signature": "off",
      "effecttsgo/node-builtin-import": "off",
      "effecttsgo/prefer-effect-array": "off",
      "effecttsgo/prefer-effect-record": "off",
      "effecttsgo/prefer-effect-string": "off",
      "effecttsgo/process-env": "off",
      "eslint/no-console": "off",
      "eslint/no-undefined": "off",
      "import/no-relative-parent-imports": "off",
      "node/no-process-env": "off",
      "node/no-sync": "off",
      "oxc/no-async-await": "off",
      "unicorn/no-process-exit": "off",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: decisionTestRules,
  },
] satisfies LintConfig["overrides"];

const lint = {
  ...preset,
  ignorePatterns: [...generated, ...workspace.lint.ignorePatterns],
  overrides: [...preset.overrides, ...overrides],
} satisfies LintConfig;

const MARKDOWN_IGNORES = ["AGENTS.md", ".agents/skills/**", "CHANGELOG.md"];

const PUBLIC_VALUES = [String.raw`\bCF_BEACON_TOKEN = "[0-9a-f]{32}"`];

const checks: ToolSections = {
  commitlint: { extends: ["@commitlint/config-conventional"] },
  dependencyRules: { banned: requiredStack, peerRanges: "intersect" },
  betterleaks: {
    extend: { useDefault: true },
    filter: `matchesAny(finding.line, [${pipe(
      PUBLIC_VALUES,
      Arr.map((pattern) => `\`${pattern}\``),
      Arr.join(", "),
    )}])`,
  },
  steiger: {
    paths: ["apps/*/src"],
    rules: steigerRules,
  },
  markdownlint: { ignores: MARKDOWN_IGNORES },
  fallow,
  textlint: {
    ignores: MARKDOWN_IGNORES,
    presets: textlintPresets,
    rules: {
      "@textlint-ja/preset-ai-writing": true,
      "@r_masseater/preset-ja": { "no-taigendome": false },
      "preset-ja-technical-writing": {
        "sentence-length": { max: 120 },
        "ja-no-mixed-period": { allowPeriodMarks: [":"] },
        "no-mix-dearu-desumasu": { preferInBody: "である", preferInList: "である" },
        "max-kanji-continuous-len": {
          max: 6,
          allow: [
            "外国電子決済手段",
            "電子決済手段等取引業",
            "前払式支払手段",
            "犯罪収益移転防止法",
            "事業者間取引適正化等法",
            "個人情報保護法",
            "特定商取引法",
            "電気通信利用役務",
            "特定業務委託事業者",
          ],
        },
      },
    },
  },
};

export default defineConfig({
  ...checks,
  msch: { workspaceAgentsMd: true },
  test: { projects: [...workspace.testProjects], passWithNoTests: true },
  staged: {
    "*": "vp fmt --no-error-on-unmatched-pattern",
  },
  fmt: {
    ignorePatterns: lint.ignorePatterns,
    sortImports: true,
    sortTailwindcss: true,
    sortPackageJson: true,
  },
  lint,
  run: {
    cache: true,
    tasks: {
      "actions-lint":
        "ast-grep scan --rule .github/rules/no-full-history-checkout.yml .github/workflows",
      verify: {
        command: "vp check --deny-warnings",
        cache: {
          env: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_AI_GATEWAY_ID"],
          untrackedEnv: [
            "CLOUDFLARE_API_TOKEN",
            "CLAUDECODE",
            "CLAUDE_CODE_REMOTE",
            "HTTPS_PROXY",
            "https_proxy",
            "NO_PROXY",
            "no_proxy",
            "SSL_CERT_FILE",
            "NODE_EXTRA_CA_CERTS",
          ],
        },
        dependsOn: [
          ...workspace.tasks.verify,
          "test",
          "msch",
          "actions-lint",
          "db-check-all",
          "audit",
        ],
      },
      test: "vp test run",
      msch: { command: "msch", cache: false },
      "db-check-all": "vp run -r db:check",
      audit: {
        command:
          'before="$(cksum pnpm-workspace.yaml)"; vp pm audit --fix || exit; if [ "$before" != "$(cksum pnpm-workspace.yaml)" ]; then echo "vp pm audit --fix rewrote pnpm-workspace.yaml. Run vp install and commit the diff." >&2; exit 1; fi',
        cache: false,
      },
    },
  },
});
