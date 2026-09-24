import { coreEntrypoints } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import * as worker from "./worker.ts";

describe("worker module", () => {
  const it = test.extend("exportedEntrypoints", () => Object.keys(worker));

  it("exports the class of every contracted core entrypoint and the default entrypoint", ({
    exportedEntrypoints,
  }) => {
    expect(exportedEntrypoints).toStrictEqual([...Object.values(coreEntrypoints), "default"]);
  });
});
