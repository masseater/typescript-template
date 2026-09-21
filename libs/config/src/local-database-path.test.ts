// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import path from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  localDatabase,
  localDatabaseDirectory,
  localDatabaseVariable,
} from "./local-database-path.ts";

const overriddenDirectory = path.resolve("/tmp/template-db");
const blankEnvironment = { [localDatabaseVariable]: "" };
const missingEnvironment = {};
const overriddenEnvironment = { [localDatabaseVariable]: "/tmp/template-db" };

describe("localDatabaseDirectory", () => {
  const it = test.extend("persistedDirectory", () => localDatabaseDirectory(overriddenEnvironment));

  it("reads the persist directory from the environment passed in", ({ persistedDirectory }) => {
    expect(persistedDirectory).toBe(overriddenDirectory);
  });
});

describe("a blank database directory override", () => {
  const repositoryDefault = localDatabaseDirectory(missingEnvironment);
  const it = test.extend("persistedDirectory", () => localDatabaseDirectory(blankEnvironment));

  it("falls back to the repository directory", ({ persistedDirectory }) => {
    expect(persistedDirectory).toBe(repositoryDefault);
  });
});

describe("localDatabase", () => {
  const it = test.extend("sharedDatabase", () => localDatabase);

  it("names the shared local database", ({ sharedDatabase }) => {
    expect(sharedDatabase).toStrictEqual({
      binding: "DB",
      database_id: "00000000-0000-0000-0000-000000000001",
      database_name: "template-shared",
    });
  });
});
