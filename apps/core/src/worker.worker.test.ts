import { applications } from "@repo/config";
import { coreEntrypoints } from "@repo/core-api/entrypoints";
import { describe, expect, test } from "vite-plus/test";

import * as worker from "./worker.ts";

const entrypointNames = ["MemberApi", "AdminApi", "InternalApi", "default"] as const;

describe("worker module", () => {
  const it = test.extend("exportedEntrypoints", () => Object.keys(worker));

  it("exports the contracted WorkerEntrypoint classes and the default entrypoint", ({
    exportedEntrypoints,
  }) => {
    expect(exportedEntrypoints).toStrictEqual([...entrypointNames]);
  });
});

describe("coreEntrypoints", () => {
  const it = test.extend("contractedEntrypoints", () =>
    applications.map((app) => coreEntrypoints[app]));

  it("names the worker classes", ({ contractedEntrypoints }) => {
    expect(contractedEntrypoints).toStrictEqual(["MemberApi", "AdminApi", "InternalApi"]);
  });
});
