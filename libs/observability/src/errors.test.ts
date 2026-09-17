import { describe, expect, it } from "vitest";
import { errorAttributes } from "./errors.ts";

describe("error attributes", () => {
  it("keeps useful error locations without messages, arguments or local directory names", () => {
    expect.hasAssertions();
    const error = new TypeError("private@example.test password=secret");
    error.stack =
      "TypeError: private@example.test password=secret\n at check (/Users/private/app.js:12:3)\n at https://app.test/assets/web.js:34:5";
    const attributes = errorAttributes(error);
    expect(attributes).toStrictEqual({
      "error.locations": "app.js:12:3\n/assets/web.js:34:5",
      "error.type": "TypeError",
    });
    expect(JSON.stringify(attributes)).not.toMatch(/private|secret|Users/u);
  });

  it("does not serialize thrown objects or custom error names", () => {
    expect.hasAssertions();
    expect(errorAttributes({ password: "secret" })).toStrictEqual({
      "error.locations": "",
      "error.type": "Error",
    });
    const error = new Error("secret");
    error.name = "private@example.test";
    expect(errorAttributes(error)["error.type"]).toBe("Error");
  });
});
