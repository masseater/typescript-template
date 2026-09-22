import { describe, expect, test } from "vite-plus/test";

import { applications } from "./applications.ts";

describe("applications", () => {
  const it = test.extend("applicationNames", () => applications);

  it("uses the service and dashboard vocabulary", ({ applicationNames }) => {
    expect(applicationNames).toStrictEqual([
      "service-member",
      "service-admin",
      "internal-dashboard",
    ]);
  });
});
