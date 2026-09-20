// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { localDatabaseDirectory, localDatabaseVariable } from "./local-database-path.ts";

describe("local database path", () => {
  it("reads the persist directory from the environment at call time", async () => {
    expect.hasAssertions();
    const directory = await mkdtemp(path.join(tmpdir(), "template-local-database-path-"));
    // oxlint-disable-next-line node/no-process-env
    const previous = process.env[localDatabaseVariable];
    try {
      // oxlint-disable-next-line node/no-process-env
      process.env[localDatabaseVariable] = directory;
      expect(localDatabaseDirectory()).toBe(path.resolve(directory));
    } finally {
      if (previous === undefined) {
        // oxlint-disable-next-line node/no-process-env
        delete process.env[localDatabaseVariable];
      } else {
        // oxlint-disable-next-line node/no-process-env
        process.env[localDatabaseVariable] = previous;
      }
      await rm(directory, { force: true, recursive: true });
    }
  });
});
