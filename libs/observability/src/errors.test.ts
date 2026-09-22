import { describe, expect, test } from "vite-plus/test";

import { errorAttributes, errorFingerprint, fingerprintIdentity } from "./errors.ts";

class LocatedTypeError extends TypeError {
  public override readonly stack =
    "TypeError: private@example.test password=secret\n at check (/Users/private/app.js:12:3)\n at https://app.test/assets/web.js:34:5";

  public constructor() {
    super("private@example.test password=secret");
  }
}

describe("errorAttributes", () => {
  const it = test.extend("typedErrorAttributes", async () =>
    errorAttributes(new LocatedTypeError()));

  it("keeps useful error locations without secrets", ({ typedErrorAttributes }) => {
    expect(typedErrorAttributes).toStrictEqual({
      "error.fingerprint": errorFingerprint("TypeError", "app.js:12:3\n/assets/web.js:34:5"),
      "error.locations": "app.js:12:3\n/assets/web.js:34:5",
      "error.type": "TypeError",
    });
  });
});

describe("errorAttributes for a plain object", () => {
  const it = test.extend("plainObjectAttributes", async () =>
    errorAttributes({ password: "secret" }));

  it("does not serialize thrown objects", ({ plainObjectAttributes }) => {
    expect(plainObjectAttributes).toStrictEqual({
      "error.fingerprint": errorFingerprint(fingerprintIdentity({ password: "secret" }), ""),
      "error.locations": "",
    });
  });
});
