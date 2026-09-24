import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { browserCommand } from "./browser.ts";
import { layer } from "./platform.ts";

describe("passing a command to the browser", () => {
  it("is refused before any browser starts when no command is given", () =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const refusal = yield* browserCommand("service-member", []).pipe(Effect.flip);
        expect(refusal.reason).toBe("browser_command_required");
      }).pipe(Effect.provide(layer)),
    ));
});
