import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { passkeyRpId } from "./passkey-rp-id.ts";

describe("passkeyRpId", () => {
  it.effect("keeps the host when the origin is not nested under a project domain", () =>
    Effect.sync(() => {
      assert.strictEqual(
        passkeyRpId("https://publink-app.asunarocreate.dev"),
        "publink-app.asunarocreate.dev",
      );
      assert.strictEqual(passkeyRpId("http://localhost:3001"), "localhost");
      assert.strictEqual(passkeyRpId("https://wiki.example.com"), "wiki.example.com");
    }),
  );

  it.effect("uses the project parent when apps sit under hoge.prefix.zone", () =>
    Effect.sync(() => {
      assert.strictEqual(
        passkeyRpId("https://service-member.publink.asunarocreate.dev"),
        "publink.asunarocreate.dev",
      );
      assert.strictEqual(
        passkeyRpId("https://service-admin.publink.asunarocreate.dev"),
        "publink.asunarocreate.dev",
      );
      assert.strictEqual(
        passkeyRpId("https://internal-dashboard.publink.asunarocreate.dev"),
        "publink.asunarocreate.dev",
      );
    }),
  );
});
