import { describe, expect, test } from "vite-plus/test";

import { deploymentKey } from "./deployment-keys.ts";

describe("deploymentKey", () => {
  const it = test.extend("renamedKeys", () =>
    Object.entries(deploymentKey).filter(
      ([key, variable]) =>
        key !==
        variable
          .replace(/^TEMPLATE_/u, "")
          .toLowerCase()
          .replaceAll(/_([a-z])/gu, (_underscore, initial: string) => initial.toUpperCase()),
    ),
  );
  it("names every key after the variable it reads", ({ renamedKeys }) => {
    expect(renamedKeys).toStrictEqual([]);
  });
});
