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
  test: {
    projects: [
      ...workspace.testProjects,
      {
        test: {
          name: "actions",
          root: ".github/actions",
          include: ["*/*.test.ts"],
        },
      },
    ],
    passWithNoTests: true,
  },
  skills: {
    "artouc/stop-describe-ui": {
      commit: "251a859f6e40645030e1ae69fa4b501c851eac9c",
      root: "skills",
      skills: ["stop-describing-ui"],
    },
    "better-auth/skills": {
      commit: "20c9e88a5c007461a703f1c213572b073196113e",
      skills: [
        "better-auth-best-practices",
        "better-auth-security-best-practices",
        "email-and-password-best-practices",
      ],
    },
    "cloudflare/skills": {
      commit: "ff191de7d903788eceaf516a514ae7d3b56b924a",
      root: "skills",
      skills: ["cloudflare", "workers-best-practices"],
    },
    "Effect-TS/skills": {
      commit: "155c50c911f9c99c294ef8a4461981c5bbe6453e",
      root: "skills",
      skills: ["effect-ts"],
    },
    "elysiajs/skills": {
      commit: "1466d85aa4f2a0fec91f71311e65bbfa91aa7dc5",
      skills: ["elysiajs"],
    },
    "feature-sliced/skills": {
      commit: "5e95aaebb84541742686e56352b7569acf4306f1",
      skills: ["feature-sliced-design"],
    },
    "GoogleChrome/modern-web-guidance": {
      commit: "2b4aa13a72dd47cd135b06ce5abfccd92e19b24f",
      root: "skills",
      skills: ["modern-web-guidance"],
    },
    "masseater/skills": {
      commit: "9d812c205624a013fd80c045411aa78249a1c2e6",
      root: "plugins/masseater-skills/skills",
      skills: "all",
    },
    "mkosir/typescript-style-guide": {
      commit: "170074a0df9b07f4a4a78e3596ec1edf06a14da7",
      root: "skills",
      skills: ["typescript-discriminated-unions", "typescript-variables"],
    },
    "nanaism/yomiyasu": {
      commit: "3979c750b5e1fe9892bd47bb354f0fb51d534ff2",
      root: "skills",
      skills: ["yomiyasu"],
    },
    "obra/superpowers": {
      commit: "22f0b463e7a5e579904dd6211a520321035526f7",
      root: "skills",
      skills: ["systematic-debugging", "verification-before-completion"],
    },
    "philtzjp/skills": {
      commit: "c564444ab816e9f1eb69f6625831ceb3a4bcadad",
      root: ".agents/skills",
      skills: [
        "analytics",
        "api-design",
        "commit-and-git",
        "conventions",
        "cursor-hook-authoring",
        "data-migration",
        "db",
        "e2e-testing",
        "e2etest",
        "errorpage",
        "github",
        "google-analytics",
        "hono",
        "issue-branch-pr-flow",
        "japanese",
        "japanese-writing",
        "knowledge-elicitation",
        "m4l-project",
        "refresh-skills",
        "skill-escalation",
        "skill-selection",
        "turborepo",
        "typescript-monorepo",
      ],
    },
    "shadcn-ui/ui": {
      commit: "0e5b2e621a9ee4cf6a604bbe6c5c0d5b70561eb4",
      root: "skills",
      skills: ["shadcn"],
    },
  },
  markdownlint: { ignores: ["**/AGENTS.md", "**/CLAUDE.md", ".agents/skills/**"] },
  msch: { workspaceAgentsMd: true },
});
