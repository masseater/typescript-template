import path from "node:path";

import { applicationsExcept } from "./private-path.ts";

import type { Application } from "@repo/config";
import type { UserConfig } from "vite-plus";

const serverOptions = ({
  application,
  applicationRoot,
  repositoryRoot,
}: Readonly<{
  application: Application;
  applicationRoot: string;
  repositoryRoot: string;
}>): UserConfig => ({
  server: {
    cors: false,
    fs: {
      allow: [
        applicationRoot,
        path.join(repositoryRoot, "libs"),
        path.join(repositoryRoot, "node_modules"),
      ],
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key}",
        "**/.git/**",
        "**/.dev.vars*",
        "**/.local/**",
        "**/.local-agents/**",
        ...applicationsExcept(application).map((foreign) => `**/apps/${foreign}/**`),
        ...(application === "service-admin" ? [] : ["**/libs/db/src/admin.*"]),
        "**/libs/db/src/remote*",
        "**/libs/db/src/bootstrap*",
        "**/libs/db/src/testing.*",
        "**/infra/**",
        "**/tools/**",
      ],
      strict: true,
    },
  },
});

export { serverOptions };
