import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repositoryRoot } from "@repo/config/repository-root";
import { describe, expect, it } from "vite-plus/test";

import { field, workspaceManifests } from "./dependencies.ts";

const localizedApps = ["service-member", "service-admin"] as const;
const locales = ["ja", "en"] as const;

const messageKeys = (
  app: (typeof localizedApps)[number],
  locale: (typeof locales)[number],
): string[] => {
  const raw = readFileSync(join(repositoryRoot, "apps", app, "messages", `${locale}.json`), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${app} ${locale} messages must be a JSON object`);
  }
  return Object.keys(parsed)
    .filter((key) => key !== "$schema")
    .toSorted();
};

describe("paraglide message catalogs", () => {
  it.for([...localizedApps])("keeps %s locale keys identical", (app) => {
    expect.hasAssertions();
    const [base, ...others] = locales.map((locale) => messageKeys(app, locale));
    for (const keys of others) {
      expect(keys).toStrictEqual(base);
    }
  });

  it.for([...localizedApps])("ships project.inlang settings for %s", (app) => {
    expect.hasAssertions();
    const settings = JSON.parse(
      readFileSync(join(repositoryRoot, "apps", app, "project.inlang", "settings.json"), "utf8"),
    ) as { baseLocale: string; locales: string[] };
    expect(settings.baseLocale).toBe("ja");
    expect(settings.locales).toStrictEqual(["ja", "en"]);
  });

  it.for([...localizedApps])("depends on @inlang/paraglide-js in %s", (app) => {
    expect.hasAssertions();
    const workspace = workspaceManifests.find(({ file }) => file === `apps/${app}/package.json`);
    expect(workspace).toBeDefined();
    expect(field(workspace?.manifest.dependencies, "@inlang/paraglide-js")).toBe("catalog:");
  });
});
