import { APPLICATION, type Application } from "@repo/config";

import { paths } from "./host.ts";
import { applicationsExcept } from "./private-path.ts";

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
        paths.join(repositoryRoot, "libs"),
        paths.join(repositoryRoot, "node_modules"),
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
        ...(application === APPLICATION.admin ? [] : ["**/libs/db/src/features/db/admin.*"]),
        "**/libs/db/src/features/db/remote*",
        "**/libs/db/src/features/db/bootstrap*",
        "**/libs/db/src/features/db/testing.*",
        "**/infra/**",
        "**/tools/**",
      ],
      strict: true,
    },
  },
});

export { serverOptions };
