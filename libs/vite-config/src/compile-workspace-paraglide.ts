#!/usr/bin/env node
import { chdir, cwd } from "node:process";

import { compile } from "@inlang/paraglide-js";
import { repositoryRoot } from "@repo/config/repository-root";

import { paths } from "./host.ts";
import { paraglideCompileOptions } from "./paraglide-options.ts";

const localizedApps = ["service-member", "service-admin"] as const;
const startedIn = cwd();

try {
  for (const app of localizedApps) {
    chdir(paths.join(repositoryRoot, "apps", app));
    await compile(paraglideCompileOptions());
  }
} finally {
  chdir(startedIn);
}
