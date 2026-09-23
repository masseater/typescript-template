import { Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { searchValidator } from "./app-router.ts";

class UnreadableSearch extends Schema.TaggedError<UnreadableSearch>()("UnreadableSearch", {}) {}

const readPage = searchValidator(
  Schema.decodeUnknownOption(Schema.Struct({ page: Schema.optionalKey(Schema.Finite) })),
  () => new UnreadableSearch(),
);

describe("a search read through a validator", () => {
  const it = test
    .extend("theReadSearch", () => readPage({ page: 2 }))
    .extend("theRejection", () => {
      try {
        return readPage({ page: "second" });
      } catch (thrown) {
        return thrown;
      }
    });

  it("hands back the decoded search", ({ theReadSearch }) => {
    expect(theReadSearch).toStrictEqual({ page: 2 });
  });

  it("throws the invalid search failure for a search it cannot decode", ({ theRejection }) => {
    expect(theRejection).toStrictEqual(new UnreadableSearch());
  });
});
