import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { localDatabaseDirectory, localDatabaseVariable } from "./local-database-path.ts";

describe("local database path", () => {
  it("reads the persist directory from the environment at call time", async () => {
    expect.hasAssertions();
    const directory = await mkdtemp(path.join(tmpdir(), "template-local-database-path-"));
    const previous = process.env[localDatabaseVariable];
    try {
      process.env[localDatabaseVariable] = directory;
      expect(localDatabaseDirectory()).toBe(path.resolve(directory));
    } finally {
      if (previous === undefined) {
        delete process.env[localDatabaseVariable];
      } else {
        process.env[localDatabaseVariable] = previous;
      }
      await rm(directory, { force: true, recursive: true });
    }
  });
});
