import { describe, expect, it } from "vite-plus/test";

import { effectTsgoNoEmit } from "./effect-typecheck.ts";

describe("effectTsgoNoEmit", () => {
  it("typechecks the named project through effect-tsgo without emitting", () => {
    expect(effectTsgoNoEmit("scenarios/tsconfig.json")).toBe(
      '"$(effect-tsgo get-exe-path)" --pretty false --noEmit -p scenarios/tsconfig.json',
    );
  });
});
