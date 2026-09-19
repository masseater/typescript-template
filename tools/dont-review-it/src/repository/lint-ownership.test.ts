import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const lintSource = readFileSync(new URL("./lint.ts", import.meta.url), "utf-8");

describe("workspace lint ownership", () => {
  it("does not hardcode libs/ui design-system paths in root lint overrides", () => {
    expect.hasAssertions();
    expect(lintSource).not.toMatch(/libs\/ui\/src\/shared\/ui\/\*\*/u);
  });

  it("does not hardcode infra/cloudflare new-cap exceptions in root lint overrides", () => {
    expect.hasAssertions();
    expect(lintSource).not.toMatch(/ApiToken\|D1\|Email\|Workers\|Zone/u);
  });

  it("imports ui and cloudflare lint knowledge instead of owning it", () => {
    expect.hasAssertions();
    expect(lintSource).toMatch(/@repo\/ui\/lint-settings/u);
    expect(lintSource).toMatch(/@repo\/infra-cloudflare\/lint-overrides/u);
  });
});
