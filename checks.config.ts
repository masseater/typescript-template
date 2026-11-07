import type { ToolSections } from "@r_masseater/vp-tools";
import fsd from "@r_masseater/vp-tools/fsd";
import { Array as Arr, pipe } from "effect";
import type { UserConfig } from "vite-plus";

import { requiredStack } from "./lint.config.ts";

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
  steiger: [
    ...fsd.configs.recommended,
    {
      rules: {
        "fsd/no-cross-imports": "error",
        "fsd/no-higher-level-imports": "error",
        "fsd/no-wildcard-exports": "error",
      },
    },
  ],
  textlint: {
    ignores: ["AGENTS.md", ".agents/skills/**", ".claude/worktrees/**", "CHANGELOG.md"],
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

type Tasks = NonNullable<NonNullable<UserConfig["run"]>["tasks"]>;

const checkTasks: Tasks = {
  "dependency-rules": "vp-tools dependencies",
  "markdown-lint": [
    'markdownlint-cli2 "**/*.md"',
    "vp-tools textlint '*.md'",
    `vp-tools textlint --print-files '*.md' | xargs -0 -r -n 1 -P 4 python3 "$(skills ls --json | jq -r '.[] | select(.name == "yomiyasu").path')/scripts/yomiyasu_lint.py" --strict`,
  ],
  steiger: "vp-tools steiger apps/*/src",
  betterleaks: {
    command:
      'vp-tools betterleaks go run github.com/betterleaks/betterleaks/v2@v2.0.0-rc.7 git . --redact --no-banner --revision="$(git rev-parse -q --verify "$BETTERLEAKS_BASE" || echo origin/main)..HEAD"',
    cache: false,
  },
  "betterleaks:staged": {
    command:
      "git diff --cached --no-ext-diff --no-textconv --no-color --src-prefix=a/ --dst-prefix=b/ | vp-tools betterleaks go run github.com/betterleaks/betterleaks/v2@v2.0.0-rc.7 stdin --git-diff --redact --no-banner",
    cache: false,
  },
};

export { checkTasks, checks };
