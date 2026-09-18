import { describe, expect, test } from "vite-plus/test";

import { errorAttributes, errorFingerprint } from "./errors.ts";

class RecordedError extends Error {
  public override readonly name: string;
  public override readonly stack: string;

  public constructor(recorded: {
    readonly name: string;
    readonly message: string;
    readonly stack: string;
  }) {
    super(recorded.message);
    this.name = recorded.name;
    this.stack = recorded.stack;
  }
}

describe("errorAttributes", () => {
  describe("a TypeError whose message and stack carry private details", () => {
    const it = test.extend("attributes", () =>
      errorAttributes(
        new RecordedError({
          message: "private@example.test password=secret",
          name: "TypeError",
          stack:
            "TypeError: private@example.test password=secret\n at check (/Users/private/app.js:12:3)\n at https://app.test/assets/web.js:34:5",
        }),
      ));

    it("keeps the failure site without the message, the arguments or local directory names", ({
      attributes,
    }) => {
      expect(attributes).toStrictEqual({
        "error.fingerprint": "8cff9525",
        "error.locations": "app.js:12:3\n/assets/web.js:34:5",
        "error.type": "TypeError",
      });
    });
  });

  describe("a thrown object that is not an error", () => {
    const it = test.extend("attributes", () => errorAttributes({ password: "secret" }));

    it("serialises nothing the object carries", ({ attributes }) => {
      expect(attributes).toStrictEqual({
        "error.fingerprint": "62ee1f21",
        "error.locations": "",
        "error.type": "Error",
      });
    });
  });

  describe("an error whose name was replaced by private text", () => {
    const it = test.extend("attributes", () =>
      errorAttributes(
        new RecordedError({ message: "secret", name: "private@example.test", stack: "" }),
      ));

    it("reports the generic error type in place of the custom name", ({ attributes }) => {
      expect(attributes).toStrictEqual({
        "error.fingerprint": "62ee1f21",
        "error.locations": "",
        "error.type": "Error",
      });
    });
  });
});

describe("errorFingerprint", () => {
  describe.for([
    [
      "six frames at one site",
      "TypeError",
      ["a.js:1:1", "a.js:2:1", "a.js:3:1", "a.js:4:1", "a.js:5:1", "a.js:6:1"],
      "a9065e65",
    ],
    [
      "the same first five frames and a different sixth",
      "TypeError",
      ["a.js:1:1", "a.js:2:1", "a.js:3:1", "a.js:4:1", "a.js:5:1", "b.js:9:9"],
      "a9065e65",
    ],
    ["a TypeError at the first site", "TypeError", ["a.js:1:1"], "7812c12d"],
    ["a TypeError at a second site", "TypeError", ["a.js:2:1"], "31b0b2d8"],
    ["a RangeError without a site", "RangeError", [], "972f61ba"],
    ["a TypeError without a site", "TypeError", [], "a81128a9"],
  ] as const)("%s", ([, errorType, frames, expectedFingerprint]) => {
    const it = test.extend("fingerprint", () =>
      errorFingerprint({ errorType, locations: frames.join("\n") }));

    it("groups by type and the first five frames only", ({ fingerprint }) => {
      expect(fingerprint).toBe(expectedFingerprint);
    });
  });
});
