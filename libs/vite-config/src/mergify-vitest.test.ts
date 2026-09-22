import { describe, expect, it } from "vite-plus/test";

import { mergifyVitest, RequiredMergifyReporter } from "./mergify-vitest.ts";

describe("mergifyVitest", () => {
  it("registers a reporter that fails closed when CI has a token but no sink", () => {
    expect.hasAssertions();
    const config = mergifyVitest();
    expect(config.reporters[0]).toBe("default");
    expect(config.reporters[1]).toBeInstanceOf(RequiredMergifyReporter);
  });
});
