import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { reportedRuleIds } from "./text-lint-test-fixture.ts";

const RULE = "no-other-document-location";

const locationSentences = [
  ["inline-code-aru", "手順は `docs/setup.md` にある。\n"],
  ["inline-code-arimasu", "手順は `docs/setup.md` にあります。\n"],
  ["inline-code-oku", "規則は `references/rule.md` に置く。\n"],
  ["inline-code-kaite-aru", "詳細は `docs/setup.md` に書いてある。\n"],
  ["inline-code-sansho", "`docs/setup.md` を参照。\n"],
  ["inline-code-anchor", "手順は `docs/setup.md#install` にある。\n"],
  ["link-aru", "手順は [設定](docs/setup.md) にある。\n"],
  ["list-item", "- 判断は `docs/setup.md` にある。\n"],
] as const;

const otherSentences = [
  ["continuative", "`.claude/skills/<name>/SKILL.md` に置き、frontmatter に名前を書く。\n"],
  ["update-together", "`docs/setup.md` を同じ変更で更新する。\n"],
  ["not-a-document", "設定は `config.ts` にある。\n"],
  ["path-only", "`docs/setup.md`\n"],
  ["link-to-page", "手順は [設定](https://example.com/setup) にある。\n"],
] as const;

describe("a sentence that points at another document", () => {
  it.for(locationSentences)("is reported: %s", ([_label, markdown]) =>
    Effect.runPromise(
      Effect.gen(function* reported() {
        expect.assertions(1);
        expect(yield* reportedRuleIds(markdown)).toStrictEqual([RULE]);
      }),
    ),
  );

  it.for(otherSentences)("is left alone: %s", ([_label, markdown]) =>
    Effect.runPromise(
      Effect.gen(function* leftAlone() {
        expect.assertions(1);
        expect(yield* reportedRuleIds(markdown)).toStrictEqual([]);
      }),
    ),
  );
});
