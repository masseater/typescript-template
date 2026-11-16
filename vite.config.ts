import { repositoryConfig } from "@r_masseater/msch/config";
import { decisionRules, tracedRules } from "@r_masseater/msch/lint";
import { workspaceSettings } from "@r_masseater/msch/workspace-settings";
import { defineConfig } from "vite-plus";

const workspace = await workspaceSettings({
  root: import.meta.dirname,
  ruleSets: { decision: decisionRules, traced: tracedRules },
  dependencySets: {},
});

export default defineConfig({
  ...repositoryConfig({
    workspace,
    overrides: [
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
    ],
    textlint: {
      kanji: [
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
      rules: { "@r_masseater/preset-ja": { "no-taigendome": false } },
    },
    run: { tasks: { "db-check-all": "vp run -r db:check" } },
  }),
  markdownlint: { ignores: ["AGENTS.md", ".agents/skills/**", "CHANGELOG.md"] },
  msch: { workspaceAgentsMd: true },
});
