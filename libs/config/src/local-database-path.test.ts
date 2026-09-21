// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { localDatabaseDirectory, localDatabaseVariable } from "./local-database-path.ts";

describe("local database path", () => {
  it("reads the persist directory from the environment at call time", async () => {
    expect.hasAssertions();
    const directory = await mkdtemp(path.join(tmpdir(), "template-local-database-path-"));
    // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
    const previous = process.env[localDatabaseVariable];
    try {
      // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
      process.env[localDatabaseVariable] = directory;
      expect(localDatabaseDirectory()).toBe(path.resolve(directory));
    } finally {
      if (previous === undefined) {
        // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
        delete process.env[localDatabaseVariable];
      } else {
        // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
        process.env[localDatabaseVariable] = previous;
      }
      await rm(directory, { force: true, recursive: true });
    }
  });
});
