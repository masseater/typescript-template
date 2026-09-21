// oxlint-disable-next-line import/no-nodejs-modules
import { readdirSync, readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

const productionSources = readdirSync(sourceDirectory).filter(
  (name) => name.endsWith(".ts") && !name.includes(".test."),
);

describe("missing database rows", () => {
  it("does not coalesce an absent row to null", () => {
    expect.hasAssertions();
    const coalesced = productionSources.filter((name) =>
      /\?\?\s*null\b/u.test(readFileSync(path.join(sourceDirectory, name), "utf8")),
    );
    expect(coalesced).toStrictEqual([]);
  });
});
