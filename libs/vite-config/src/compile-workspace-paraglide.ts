#!/usr/bin/env node
import { compile } from "@inlang/paraglide-js";
import { repositoryRoot } from "@repo/config/repository-root";

import { paths } from "./host.ts";
import { paraglideCompileOptions } from "./paraglide-options.ts";

const localizedApps = ["service-member", "service-admin"] as const;

await Promise.all(
  localizedApps.map((app) => {
    const appRoot = paths.join(repositoryRoot, "apps", app);
    return compile({
      ...paraglideCompileOptions(),
      outdir: paths.join(appRoot, ".paraglide"),
      project: paths.join(appRoot, "project.inlang"),
    });
  }),
);
