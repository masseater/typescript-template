import { describe, expect, test } from "vite-plus/test";

import { effectTsgoNoEmit } from "./effect-typecheck.ts";

describe("effectTsgoNoEmit", () => {
  const it = test.extend("command", () => effectTsgoNoEmit("scenarios/tsconfig.json"));

  it("typechecks the named project through effect-tsgo without emitting", ({ command }) => {
    expect(command).toBe(
      '"$(effect-tsgo get-exe-path)" --pretty false --noEmit -p scenarios/tsconfig.json',
    );
  });
});
