import { paraglideVitePlugin } from "@inlang/paraglide-js";

import type { PluginOption } from "vite-plus";

const paraglideStrategy = ["url", "cookie", "preferredLanguage", "baseLocale"] as const;

function paraglideAppPlugin(): PluginOption {
  return paraglideVitePlugin({
    cookieName: "PARAGLIDE_LOCALE",
    emitGitIgnore: false,
    emitPrettierIgnore: false,
    emitReadme: false,
    emitTsDeclarations: true,
    outdir: "./.paraglide",
    outputStructure: "message-modules",
    project: "./project.inlang",
    strategy: [...paraglideStrategy],
    urlPatterns: [
      {
        pattern: "/:path(.*)?",
        localized: [
          ["en", "/en/:path(.*)?"],
          ["ja", "/:path(.*)?"],
        ],
      },
    ],
  });
}

export { paraglideAppPlugin, paraglideStrategy };
