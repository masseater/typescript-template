import { describe, expect, it } from "vite-plus/test";

import {
  awaitingPresetPackages,
  softPresetPackages,
  lintOptions,
  overridePluginMismatches,
  templateWorkspaces,
} from "./lint.ts";
import { repositoryRoot } from "./repository-root.ts";
import { commands, reachable, taskNames } from "./tasks.ts";
import { typecheckProjects } from "./typecheck-projects.ts";

const manifests: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/package.json",
  { eager: true, import: "default" },
);

const tsconfigs: Readonly<Record<string, { readonly default?: unknown }>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/tsconfig.json",
  { eager: true },
);

const qualityTsconfig: Readonly<Record<string, { readonly default?: unknown }>> = import.meta.glob(
  "../../tsconfig.json",
  { eager: true },
);

const viteConfigs: Readonly<Record<string, unknown>> = import.meta.glob(
  "../../../../{apps,libs,infra,tools}/*/vite.config.ts",
  { eager: false },
);

const workspacePath = (key: string): string => {
  const resolved = ["tools", "dont-review-it", "src", "repository"];
  for (const segment of key.split("/")) {
    if (segment === "..") {
      resolved.pop();
    } else if (segment !== ".") {
      resolved.push(segment);
    }
  }
  return resolved.join("/");
};

const workspaceDirectories = Object.keys(manifests)
  .map((key) => workspacePath(key).replace(/\/package\.json$/u, ""))
  .toSorted();

const globPrefix = (pattern: string): string => {
  const cut = pattern.indexOf("/**");
  if (cut === -1) {
    return pattern;
  }
  return pattern.slice(0, cut);
};

const missingWorkspaceGlobs = (patterns: readonly string[]): string[] => {
  const directories = new Set(workspaceDirectories);
  return patterns
    .map(globPrefix)
    .filter((prefix) => prefix.includes("/") && !directories.has(prefix))
    .toSorted();
};

const extendsValue = (config: unknown): string | undefined => {
  if (typeof config !== "object" || config === null) {
    return undefined;
  }
  const value = Reflect.get(config, "extends");
  return typeof value === "string" ? value : undefined;
};

const includeValue = (config: unknown): readonly string[] | undefined => {
  if (typeof config !== "object" || config === null) {
    return undefined;
  }
  const value = Reflect.get(config, "include");
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
};

const relativeWorkspaceExtends = (): string[] => {
  const directories = new Set(workspaceDirectories);
  return Object.entries(tsconfigs).flatMap(([key, module]) => {
    const file = workspacePath(key);
    const relative = extendsValue(module.default);
    if (relative === undefined || !relative.startsWith(".")) {
      return [];
    }
    const from = file.replace(/\/tsconfig\.json$/u, "").split("/");
    const target = [...from];
    for (const segment of relative.split("/")) {
      if (segment === "..") {
        target.pop();
      } else if (segment !== "." && !segment.endsWith(".json")) {
        target.push(segment);
      }
    }
    const landed = target.slice(0, 2).join("/");
    if (!directories.has(landed)) {
      return [];
    }
    const owner = from.slice(0, 2).join("/");
    return owner === landed ? [] : [file];
  });
};

const viteConfigsOutsideInclude = (): string[] => {
  return Object.keys(viteConfigs).flatMap((key) => {
    const vite = workspacePath(key);
    const directory = vite.replace(/\/vite\.config\.ts$/u, "");
    const configKey = Object.keys(tsconfigs).find(
      (candidate) => workspacePath(candidate).replace(/\/tsconfig\.json$/u, "") === directory,
    );
    if (configKey === undefined) {
      return [vite];
    }
    const include = includeValue(tsconfigs[configKey]?.default);
    if (include === undefined || include.includes("vite.config.ts")) {
      return [];
    }
    return [vite];
  });
};

const qualityIncludesDoctor = (): boolean => {
  const [module] = Object.values(qualityTsconfig);
  const config = module?.default;
  if (typeof config !== "object" || config === null) {
    return false;
  }
  const include = includeValue(config);
  if (include === undefined) {
    return !("files" in config);
  }
  return include.includes("doctor.config.ts");
};

describe("inspection coverage", () => {
  it("keeps awaiting preset packages from growing silently", () => {
    expect.hasAssertions();
    expect(awaitingPresetPackages).toStrictEqual([]);
    expect(softPresetPackages).toStrictEqual([
      "apps/service-admin/**",
      "apps/service-member/**",
      "apps/internal-dashboard/**",
      "infra/cloudflare/**",
      "tools/dev/**",
      "tools/dont-review-it/**",
    ]);
  });

  it("points lint workspace globs at packages that exist", () => {
    expect.hasAssertions();
    expect(missingWorkspaceGlobs(templateWorkspaces)).toStrictEqual([]);
    expect(missingWorkspaceGlobs(awaitingPresetPackages)).toStrictEqual([]);
  });

  it("does not declare built-in plugin rules under an override that dropped that plugin", () => {
    expect.hasAssertions();
    expect(overridePluginMismatches(lintOptions.overrides)).toStrictEqual([]);
  });

  it("bans oxlint-disable the same way it bans eslint-disable", () => {
    expect.hasAssertions();
    const terms = lintOptions.overrides
      .flatMap((override) => Object.entries(override.rules ?? {}))
      .flatMap(([rule, setting]) =>
        rule === "no-warning-comments" && Array.isArray(setting) ? [setting[1]] : [],
      );
    expect(terms).toContainEqual(
      expect.objectContaining({
        terms: expect.arrayContaining(["eslint-disable", "oxlint-disable"]),
      }),
    );
  });

  it("keeps check:repository defined until its existing violations are cleared", () => {
    expect.hasAssertions();
    expect(taskNames(".")).toContain("check:repository");
    expect(reachable(".", ["prepush"])).not.toContain("check:repository");
    expect(reachable(".", ["premerge"])).not.toContain("check:repository");
  });

  it("typechecks every workspace even when oxlint ignorePatterns skip it", () => {
    expect.hasAssertions();
    const projects = typecheckProjects(repositoryRoot);
    const discovered = [
      "tsconfig.json",
      ...Object.keys(tsconfigs).map((key) => workspacePath(key)),
    ].toSorted();
    const skippedByLint = discovered.filter((project) =>
      lintOptions.ignorePatterns.some((pattern) => {
        const prefix = pattern.endsWith("/**") ? pattern.slice(0, -3) : undefined;
        return prefix !== undefined && project.startsWith(`${prefix}/`);
      }),
    );
    expect(projects).toStrictEqual(discovered);
    expect(
      skippedByLint.map((project) => project.replace(/\/tsconfig\.json$/u, "")).toSorted(),
    ).toStrictEqual(
      awaitingPresetPackages.map((pattern) => pattern.replace(/\/\*\*$/u, "")).toSorted(),
    );
    expect(commands(".", "check:types")).toStrictEqual(["dont-review-it-typecheck"]);
    expect(reachable(".", ["prepush", "prepr", "premerge"])).not.toContain("check:types");
  });

  it("typechecks workspace vite configs and the quality doctor config", () => {
    expect.hasAssertions();
    expect(viteConfigsOutsideInclude()).toStrictEqual([]);
    expect(qualityIncludesDoctor()).toBe(true);
  });

  it("does not extend another workspace tsconfig through a relative path", () => {
    expect.hasAssertions();
    expect(relativeWorkspaceExtends()).toStrictEqual([]);
  });

  it("turns import/no-default-export off in favor of the named-export rule", () => {
    expect.hasAssertions();
    expect(lintOptions.rules["import/no-default-export"]).toBe("off");
  });
});
