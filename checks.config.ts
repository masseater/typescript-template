import type { ToolSections } from "@r_masseater/vite-plus-adopt";
import fsd from "@r_masseater/vite-plus-adopt/fsd";
import { Array as Arr, pipe } from "effect";
import type { UserConfig } from "vite-plus";

import { fallow } from "./fallow.config.ts";
import { requiredStack } from "./lint.config.ts";

const MARKDOWN_IGNORES = ["AGENTS.md", ".agents/skills/**", ".claude/worktrees/**", "CHANGELOG.md"];

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
    rules: [
      ...fsd.configs.recommended,
      {
        rules: {
          "fsd/no-cross-imports": "error",
          "fsd/no-higher-level-imports": "error",
          "fsd/no-wildcard-exports": "error",
        },
      },
    ],
  },
  markdownlint: { ignores: MARKDOWN_IGNORES },
  fallow,
  textlint: {
    ignores: MARKDOWN_IGNORES,
    rules: {
      "@textlint-ja/preset-ai-writing": true,
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

const markdownFiles = pipe(
  MARKDOWN_IGNORES,
  Arr.map((glob) => `':(glob,exclude)${glob}'`),
  Arr.join(" "),
);

const checkTasks: NonNullable<NonNullable<UserConfig["run"]>["tasks"]> = {
  vpa: { command: "vpa", cache: false },
  yomiyasu: `git ls-files -z '*.md' ${markdownFiles} | xargs -0 -r -n 1 -P 4 sh -c 'out="$(python3 "$0" --strict - < "$1")"; status=$?; printf "%s\\n%s\\n" "$1" "$out"; exit "$status"' "$(skills ls --json | jq -r '.[] | select(.name == "yomiyasu").path')/scripts/yomiyasu_lint.py"`,
};

export { checkTasks, checks };
