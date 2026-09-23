import { describe, expect, test } from "vite-plus/test";

import { parseOpenPullRequest } from "./parse-open-pr.ts";

describe("parseOpenPullRequest", () => {
  describe("a GitHub pull request payload that names a behind head", () => {
    const it = test.extend("theParsedBehindPullRequest", () =>
      parseOpenPullRequest(
        '{"baseRefName":"main","mergeStateStatus":"BEHIND","number":7,"url":"https://example.com/7"}',
      ));

    it("keeps the fields the instruction needs", ({ theParsedBehindPullRequest }) => {
      expect(theParsedBehindPullRequest).toStrictEqual({
        baseRefName: "main",
        mergeStateStatus: "BEHIND",
        number: 7,
        url: "https://example.com/7",
      });
    });
  });

  describe("payloads that are not an open pull request record", () => {
    const it = test
      .extend("theParseOfBrokenJson", () => parseOpenPullRequest("{"))
      .extend("theParseOfABareArray", () => parseOpenPullRequest("[]"))
      .extend("theParseOfANullRecord", () => parseOpenPullRequest("null"))
      .extend("theParseOfARecordMissingTheNumber", () =>
        parseOpenPullRequest(
          '{"baseRefName":"main","mergeStateStatus":"BEHIND","url":"https://example.com/7"}',
        ),
      )
      .extend("theParseOfARecordWhoseNumberIsAString", () =>
        parseOpenPullRequest(
          '{"baseRefName":"main","mergeStateStatus":"BEHIND","number":"7","url":"https://example.com/7"}',
        ),
      );

    it("rejects broken JSON", ({ theParseOfBrokenJson }) => {
      expect(theParseOfBrokenJson).toBe(undefined);
    });

    it("rejects a bare array", ({ theParseOfABareArray }) => {
      expect(theParseOfABareArray).toBe(undefined);
    });

    it("rejects null", ({ theParseOfANullRecord }) => {
      expect(theParseOfANullRecord).toBe(undefined);
    });

    it("rejects a record missing the number", ({ theParseOfARecordMissingTheNumber }) => {
      expect(theParseOfARecordMissingTheNumber).toBe(undefined);
    });

    it("rejects a record whose number is a string", ({ theParseOfARecordWhoseNumberIsAString }) => {
      expect(theParseOfARecordWhoseNumberIsAString).toBe(undefined);
    });
  });
});
